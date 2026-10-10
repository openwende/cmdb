"""调查助手的运行入口：懒加载工具、组装 Agent、执行一轮对话并产出 SSE 事件。

对话接口和评测脚本都走这里，保证评测测到的就是线上的行为。
"""

import asyncio
import logging
from collections.abc import AsyncIterator

from langgraph.types import Checkpointer

from cmdb_ai.agent import build_agent
from cmdb_ai.cmdb import UserContext
from cmdb_ai.config import Settings
from cmdb_ai.mcp_tools import list_mcp_tools, to_langchain_tools
from cmdb_ai.streaming import EventTranslator, SSEEvent

logger = logging.getLogger(__name__)


def thread_id_for(user: UserContext, conversation_id: str) -> str:
    """检查点 thread_id 带上用户 ID：别人即使拿到会话 ID 也读不到这段对话。"""
    return f"{user.user_id}:{conversation_id}"


class Investigator:
    def __init__(self, settings: Settings, checkpointer: Checkpointer = None):
        self._settings = settings
        self._checkpointer = checkpointer
        self._agent = None
        self._lock = asyncio.Lock()

    async def _get_agent(self, user: UserContext):
        # /mcp 需要认证，服务本身没有凭证，所以用第一个请求者的 JWT 拉取工具定义。
        # 工具定义对所有角色相同，拉一次后缓存；之后的调用都转发各自用户的 JWT。
        if self._agent is None:
            async with self._lock:
                if self._agent is None:
                    mcp_tools = await list_mcp_tools(self._settings.cmdb_mcp_url, user.jwt)
                    tools = to_langchain_tools(self._settings.cmdb_mcp_url, mcp_tools)
                    logger.info("已加载 %d 个 MCP 工具: %s", len(tools), [t.name for t in tools])
                    self._agent = build_agent(self._settings, tools, self._checkpointer)
        return self._agent

    async def stream(
        self, conversation_id: str, message: str, user: UserContext
    ) -> AsyncIterator[SSEEvent]:
        translator = EventTranslator()
        try:
            agent = await self._get_agent(user)
            run = await agent.astream_events(
                {"messages": [{"role": "user", "content": message}]},
                {"configurable": {"thread_id": thread_id_for(user, conversation_id)}},
                version="v3",
                context=user,
            )
            async with run:
                async for event in run:
                    for sse in translator.translate(event):
                        yield sse
        except Exception as exc:
            logger.exception("对话执行失败 conversation_id=%s", conversation_id)
            yield SSEEvent("error", {"message": f"{type(exc).__name__}: {exc}"})
            return
        yield translator.final_event()
