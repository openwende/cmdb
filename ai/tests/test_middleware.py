from langchain.agents.middleware import ModelRequest
from langchain_core.messages import HumanMessage, ToolMessage

from cmdb_ai.middleware import (
    WRAP_UP_INSTRUCTION,
    PlainTextToolResultMiddleware,
    WrapUpAtLimitMiddleware,
)


def request(calls_made: int) -> ModelRequest:
    return ModelRequest(
        model=None,
        messages=[HumanMessage("10.20.1.11 为什么同时在两个模块？")],
        tools=["get_host"],
        state={"messages": [], "run_model_call_count": calls_made},
        runtime=None,
    )


async def capture(req):
    return req


async def test_untouched_before_last_call():
    mw = WrapUpAtLimitMiddleware(run_limit=3)
    for calls_made in (0, 1):
        req = request(calls_made)
        assert await mw.awrap_model_call(req, capture) is req


async def test_last_call_forbids_tools_and_asks_to_wrap_up():
    mw = WrapUpAtLimitMiddleware(run_limit=3)
    original = request(2)
    sent = await mw.awrap_model_call(original, capture)

    assert sent.tool_choice == "none"
    assert sent.tools == ["get_host"]  # 工具定义保留，见 middleware 里的说明
    assert sent.messages[-1].content == WRAP_UP_INSTRUCTION
    # 收尾要求只加在这次请求上，不改动原请求（也就不会写进会话状态）
    assert len(original.messages) == 1


async def test_tool_text_blocks_are_flattened_to_a_string():
    mw = PlainTextToolResultMiddleware()
    blocks = ToolMessage(
        content=[{"type": "text", "text": '{"name":"支付清结算"}'}],
        tool_call_id="c1",
        artifact={"structured_content": {}},
    )

    async def handler(_):
        return blocks

    out = await mw.awrap_tool_call(None, handler)
    assert out.content == '{"name":"支付清结算"}'
    assert out.artifact == {"structured_content": {}} and out.tool_call_id == "c1"

    image = ToolMessage(content=[{"type": "image", "url": "x"}], tool_call_id="c2")

    async def image_handler(_):
        return image

    assert await mw.awrap_tool_call(None, image_handler) is image  # 非纯文本保持原样
