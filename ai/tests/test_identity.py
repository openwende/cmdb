from types import SimpleNamespace

import pytest
from mcp.types import Tool

from cmdb_ai.cmdb import UserContext
from cmdb_ai.investigator import thread_id_for
from cmdb_ai.mcp_tools import MCPToolCallRequest, forward_user_jwt, to_langchain_tools

ALICE = UserContext(user_id="u-1", username="alice", jwt="jwt-alice")


def request(runtime):
    return MCPToolCallRequest(name="get_host", args={}, server_name="cmdb", runtime=runtime)


async def capture(req):
    return req


async def test_forwards_current_users_jwt():
    sent = await forward_user_jwt(request(SimpleNamespace(context=ALICE)), capture)
    assert sent.headers == {"Authorization": "Bearer jwt-alice"}


@pytest.mark.parametrize("runtime", [None, SimpleNamespace(context=None), SimpleNamespace()])
async def test_refuses_without_user(runtime):
    with pytest.raises(PermissionError):
        await forward_user_jwt(request(runtime), capture)


def test_tool_connection_has_no_credentials():
    tool = Tool(name="get_host", description="d", inputSchema={"type": "object", "properties": {}})
    [lc_tool] = to_langchain_tools("http://cmdb/mcp", [tool])
    # 连接配置在闭包里；确认没有任何 Authorization 头被固化进工具
    cells = [c.cell_contents for c in lc_tool.coroutine.__closure__ or []]
    connections = [c for c in cells if isinstance(c, dict) and "transport" in c]
    assert connections and all("headers" not in c for c in connections)


def test_thread_id_is_scoped_to_user():
    bob = UserContext(user_id="u-2", username="bob", jwt="jwt-bob")
    assert thread_id_for(ALICE, "c1") != thread_id_for(bob, "c1")


def test_user_context_repr_hides_jwt():
    assert "jwt-alice" not in repr(ALICE)
