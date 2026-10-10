"""把 CMDB 的 MCP 工具转成 LangChain 工具，调用时按用户转发 JWT。

工具定义对所有用户相同，只拉取一次；连接配置里不保存任何凭证，每次工具调用由
`forward_user_jwt` 拦截器从运行时 context 取当前用户的 JWT 放进请求头。
拿不到用户身份时直接拒绝，绝不会以其他人的身份调用。

`explain_cmdb_errors` 把连接失败、登录过期翻译成模型看得懂的错误：MCP 客户端抛出的是
嵌套的 ExceptionGroup，字面上只有"unhandled errors in a TaskGroup"，模型分不清
"服务挂了"和"查无此机"，会换着工具反复尝试。
"""

import httpx
from langchain_core.tools import BaseTool
from langchain_mcp_adapters.interceptors import MCPToolCallRequest
from langchain_mcp_adapters.sessions import StreamableHttpConnection, create_session
from langchain_mcp_adapters.tools import convert_mcp_tool_to_langchain_tool
from mcp.types import Tool as MCPTool

from cmdb_ai.cmdb import UserContext

SERVER_NAME = "cmdb"


class CMDBUnavailableError(Exception):
    """CMDB 暂时连不上或服务端出错，可以重试。"""


def _exception_chain(exc: BaseException):
    """依次展开 ExceptionGroup 和 __cause__：httpx 的异常下面还挂着 httpcore 的异常，
    只看最底层会错过 httpx 的类型。"""
    seen = set()
    stack = [exc]
    while stack:
        current = stack.pop()
        if id(current) in seen:
            continue
        seen.add(id(current))
        yield current
        if isinstance(current, BaseExceptionGroup):
            stack.extend(reversed(current.exceptions))
        if current.__cause__ is not None:
            stack.append(current.__cause__)


async def explain_cmdb_errors(request: MCPToolCallRequest, handler):
    try:
        return await handler(request)
    except (PermissionError, CMDBUnavailableError):
        raise
    except Exception as exc:
        for cause in _exception_chain(exc):
            if isinstance(cause, httpx.HTTPStatusError) and cause.response.status_code in (
                401,
                403,
            ):
                # PermissionError 不重试，见 agent._retryable
                raise PermissionError("登录已失效或没有权限，请用户重新登录后再问") from exc
            if isinstance(cause, httpx.TransportError) or (
                isinstance(cause, httpx.HTTPStatusError) and cause.response.status_code >= 500
            ):
                raise CMDBUnavailableError(
                    f"CMDB 服务暂时不可达（{type(cause).__name__}），这不代表查无数据"
                ) from exc
        raise


async def forward_user_jwt(request: MCPToolCallRequest, handler):
    context = getattr(request.runtime, "context", None)
    if not isinstance(context, UserContext):
        raise PermissionError("工具调用缺少用户身份，已拒绝")
    headers = {**(request.headers or {}), "Authorization": f"Bearer {context.jwt}"}
    return await handler(request.override(headers=headers))


def _connection(url: str, jwt: str | None = None) -> StreamableHttpConnection:
    conn: StreamableHttpConnection = {"transport": "streamable_http", "url": url}
    if jwt:
        conn["headers"] = {"Authorization": f"Bearer {jwt}"}
    return conn


async def list_mcp_tools(url: str, jwt: str) -> list[MCPTool]:
    """用某个用户的 JWT 拉取工具定义（/mcp 要求认证）。"""
    async with create_session(_connection(url, jwt)) as session:
        await session.initialize()
        tools: list[MCPTool] = []
        cursor = None
        while True:
            page = await session.list_tools(cursor=cursor)
            tools.extend(page.tools)
            cursor = page.nextCursor
            if not cursor:
                return tools


def to_langchain_tools(url: str, mcp_tools: list[MCPTool]) -> list[BaseTool]:
    connection = _connection(url)  # 不带凭证
    return [
        convert_mcp_tool_to_langchain_tool(
            None,
            tool,
            connection=connection,
            tool_interceptors=[explain_cmdb_errors, forward_user_jwt],
            server_name=SERVER_NAME,
        )
        for tool in mcp_tools
    ]
