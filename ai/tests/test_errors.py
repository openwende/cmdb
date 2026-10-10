import httpx
import pytest

from cmdb_ai.agent import _retryable, _tool_failure_message
from cmdb_ai.mcp_tools import CMDBUnavailableError, explain_cmdb_errors


def failing(exc):
    async def handler(_):
        raise exc

    return handler


def http_error(status):
    request = httpx.Request("POST", "http://cmdb/mcp")
    return httpx.HTTPStatusError(
        "x", request=request, response=httpx.Response(status, request=request)
    )


async def test_connection_failure_inside_exception_group_is_explained():
    # 真实情况：httpx 的异常下面还挂着底层（httpcore）异常
    connect = httpx.ConnectError("refused")
    connect.__cause__ = OSError("connection refused")
    group = ExceptionGroup("unhandled errors in a TaskGroup", [connect])
    with pytest.raises(CMDBUnavailableError, match="不代表查无数据"):
        await explain_cmdb_errors(None, failing(group))
    assert _retryable(CMDBUnavailableError())


async def test_expired_login_is_not_retried():
    group = ExceptionGroup("g", [http_error(401)])
    with pytest.raises(PermissionError) as info:
        await explain_cmdb_errors(None, failing(group))
    assert not _retryable(info.value)


async def test_other_errors_pass_through():
    with pytest.raises(ValueError):
        await explain_cmdb_errors(None, failing(ValueError("bad")))


def test_failure_message_does_not_invite_retries():
    message = _tool_failure_message(CMDBUnavailableError("CMDB 服务暂时不可达"))
    assert "try again" not in message.lower() and "不要再换其他工具" in message
