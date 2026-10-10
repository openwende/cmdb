from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from cmdb_ai.streaming import EventTranslator

MODEL_META = {"langgraph_node": "model"}


def ev(method, data, namespace=None):
    return {
        "type": "event",
        "method": method,
        "params": {"namespace": namespace or [], "data": data},
    }


def msg(payload, meta=MODEL_META):
    return ev("messages", (payload, meta))


def test_text_reasoning_and_usage():
    t = EventTranslator()
    out = []
    for e in [
        msg({"event": "message-start", "id": "m1"}),
        msg(
            {
                "event": "content-block-delta",
                "delta": {"type": "reasoning-delta", "reasoning": "想"},
            }
        ),
        msg({"event": "content-block-delta", "delta": {"type": "text-delta", "text": "你好"}}),
        msg({"event": "content-block-delta", "delta": {"type": "text-delta", "text": ""}}),
        msg(
            {
                "event": "message-finish",
                "usage": {
                    "input_tokens": 100,
                    "output_tokens": 20,
                    "input_token_details": {"cache_read": 64},
                    "output_token_details": {"reasoning": 5},
                },
                "metadata": {"finish_reason": "stop"},
            }
        ),
    ]:
        out += t.translate(e)

    assert [s.event for s in out] == ["message_start", "reasoning", "text", "message_end"]
    assert out[2].data == {"message_id": "m1", "delta": "你好"}
    assert out[3].data["finish_reason"] == "stop"
    assert t.usage.as_dict() == {
        "input_tokens": 100,
        "output_tokens": 20,
        "reasoning_tokens": 5,
        "cache_read_tokens": 64,
    }
    assert t.model_calls == 1


def test_ignores_other_nodes_and_subgraphs():
    t = EventTranslator()
    summarizer = {"langgraph_node": "SummarizationMiddleware.before_model"}
    assert t.translate(msg({"event": "message-start", "id": "s"}, summarizer)) == []
    assert t.translate(ev("messages", ({"event": "message-start"}, MODEL_META), ["sub:1"])) == []
    assert t.model_calls == 0


def test_tool_lifecycle_success_and_error():
    t = EventTranslator()
    start = t.translate(
        ev(
            "tools",
            {
                "event": "tool-started",
                "tool_call_id": "c1",
                "tool_name": "get_host",
                "input": {"ip": "10.20.1.11"},
            },
        )
    )
    assert start[0].event == "tool_start"
    assert start[0].data == {
        "tool_call_id": "c1",
        "name": "get_host",
        "input": {"ip": "10.20.1.11"},
    }

    done = t.translate(
        ev(
            "tools",
            {
                "event": "tool-finished",
                "tool_call_id": "c1",
                "output": ToolMessage(content="x" * 5000, tool_call_id="c1"),
            },
        )
    )
    assert done[0].data["status"] == "success"
    assert done[0].data["name"] == "get_host"
    assert len(done[0].data["output"]) == 4000  # 截断预览

    t.translate(ev("tools", {"event": "tool-started", "tool_call_id": "c2", "tool_name": "q"}))
    err = t.translate(ev("tools", {"event": "tool-error", "tool_call_id": "c2", "message": "boom"}))
    assert err[0].data == {"tool_call_id": "c2", "name": "q", "status": "error", "output": "boom"}

    mcp_error = ToolMessage(content="bad args", tool_call_id="c3", status="error")
    t.translate(ev("tools", {"event": "tool-started", "tool_call_id": "c3", "tool_name": "q"}))
    out = t.translate(
        ev("tools", {"event": "tool-finished", "tool_call_id": "c3", "output": mcp_error})
    )
    assert out[0].data["status"] == "error"

    assert [c["status"] for c in t.summary()["tool_calls"]] == ["success", "error", "error"]


def test_answer_is_from_current_turn_only():
    t = EventTranslator()
    history = [HumanMessage("第一问"), AIMessage("第一答"), HumanMessage("第二问")]
    t.translate(ev("values", {"messages": history}))
    assert t.answer() == ""  # 本轮还没有回答，不能拿上一轮的

    t.translate(ev("values", {"messages": [*history, AIMessage("第二答")]}))
    assert t.final_event().data["answer"] == "第二答"
