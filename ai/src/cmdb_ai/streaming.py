"""把 `astream_events(version="v3")` 的协议事件翻译成对话接口的 SSE 事件。

SSE 事件（data 均为 JSON）：
- message_start  {message_id}                         一次模型调用开始
- reasoning      {message_id, delta}                  思考过程增量
- text           {message_id, delta}                  回答文本增量
- message_end    {message_id, finish_reason, usage}   一次模型调用结束及其 token 用量
- tool_start     {tool_call_id, name, input}
- tool_end       {tool_call_id, name, status, output} status 为 success / error
- final          {answer, tool_calls, usage, model_calls, elapsed_ms}
                 评测时 tool_calls 每项额外带完整 output（对话接口不带）
- error          {message}

同时累计统计数据，供 final 事件和评测脚本使用。
"""

import time
from dataclasses import dataclass, field
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from cmdb_ai.agent import MODEL_NODE

TOOL_OUTPUT_PREVIEW_CHARS = 4000


@dataclass
class SSEEvent:
    event: str
    data: dict[str, Any]


@dataclass
class ToolCallRecord:
    tool_call_id: str
    name: str
    input: Any
    status: str = "running"
    output: str | None = None
    elapsed_ms: int | None = None
    started_at: float = field(default_factory=time.monotonic, repr=False)


@dataclass
class Usage:
    input_tokens: int = 0
    output_tokens: int = 0
    reasoning_tokens: int = 0
    cache_read_tokens: int = 0

    def add(self, raw: dict[str, Any] | None) -> dict[str, int]:
        raw = raw or {}
        one = {
            "input_tokens": raw.get("input_tokens", 0),
            "output_tokens": raw.get("output_tokens", 0),
            "reasoning_tokens": (raw.get("output_token_details") or {}).get("reasoning", 0),
            "cache_read_tokens": (raw.get("input_token_details") or {}).get("cache_read", 0),
        }
        self.input_tokens += one["input_tokens"]
        self.output_tokens += one["output_tokens"]
        self.reasoning_tokens += one["reasoning_tokens"]
        self.cache_read_tokens += one["cache_read_tokens"]
        return one

    def as_dict(self) -> dict[str, int]:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "reasoning_tokens": self.reasoning_tokens,
            "cache_read_tokens": self.cache_read_tokens,
        }


class EventTranslator:
    def __init__(self, include_tool_outputs: bool = False) -> None:
        self.include_tool_outputs = include_tool_outputs
        self.started_at = time.monotonic()
        self.usage = Usage()
        self.model_calls = 0
        self.tool_calls: dict[str, ToolCallRecord] = {}
        self._message_id: str | None = None
        self._latest_values: dict[str, Any] | None = None

    def translate(self, event: dict[str, Any]) -> list[SSEEvent]:
        params = event["params"]
        if params["namespace"]:  # 只处理根图事件
            return []
        method, data = event["method"], params["data"]
        if method == "values":
            self._latest_values = data
            return []
        if method == "messages":
            payload, metadata = data
            if metadata.get("langgraph_node") != MODEL_NODE:
                return []
            return self._on_message(payload)
        if method == "tools":
            return self._on_tool(data)
        return []

    def _on_message(self, payload: dict[str, Any]) -> list[SSEEvent]:
        kind = payload["event"]
        if kind == "message-start":
            self._message_id = payload.get("id")
            self.model_calls += 1
            return [SSEEvent("message_start", {"message_id": self._message_id})]
        if kind == "content-block-delta":
            delta = payload["delta"]
            if delta["type"] == "text-delta" and delta["text"]:
                return [SSEEvent("text", {"message_id": self._message_id, "delta": delta["text"]})]
            if delta["type"] == "reasoning-delta" and delta["reasoning"]:
                return [
                    SSEEvent(
                        "reasoning", {"message_id": self._message_id, "delta": delta["reasoning"]}
                    )
                ]
            return []
        if kind == "message-finish":
            usage = self.usage.add(payload.get("usage"))
            finish_reason = (payload.get("metadata") or {}).get("finish_reason")
            return [
                SSEEvent(
                    "message_end",
                    {
                        "message_id": self._message_id,
                        "finish_reason": finish_reason,
                        "usage": usage,
                    },
                )
            ]
        return []

    def _on_tool(self, data: dict[str, Any]) -> list[SSEEvent]:
        kind = data["event"]
        call_id = data["tool_call_id"]
        if kind == "tool-started":
            record = ToolCallRecord(call_id, data["tool_name"], data.get("input"))
            self.tool_calls[call_id] = record
            return [
                SSEEvent(
                    "tool_start",
                    {"tool_call_id": call_id, "name": record.name, "input": record.input},
                )
            ]
        record = self.tool_calls.get(call_id)
        if record is None:
            return []
        record.elapsed_ms = int((time.monotonic() - record.started_at) * 1000)
        if kind == "tool-finished":
            output = data["output"]
            if isinstance(output, ToolMessage):
                status, text = output.status, output.text
            else:
                status, text = "success", str(output)
        else:  # tool-error
            status, text = "error", data.get("message", "")
        record.status, record.output = status, text
        return [
            SSEEvent(
                "tool_end",
                {
                    "tool_call_id": call_id,
                    "name": record.name,
                    "status": status,
                    "output": text[:TOOL_OUTPUT_PREVIEW_CHARS],
                },
            )
        ]

    def answer(self) -> str:
        """本轮最后一条 AI 消息的文本（不会取到之前轮次的回答）。"""
        messages = (self._latest_values or {}).get("messages", [])
        for message in reversed(messages):
            if isinstance(message, HumanMessage):
                break
            if isinstance(message, AIMessage):
                return message.text
        return ""

    def _tool_call_summary(self, r: ToolCallRecord) -> dict[str, Any]:
        item = {"name": r.name, "input": r.input, "status": r.status, "elapsed_ms": r.elapsed_ms}
        if self.include_tool_outputs:
            item["output"] = r.output
        return item

    def summary(self) -> dict[str, Any]:
        return {
            "answer": self.answer(),
            "tool_calls": [self._tool_call_summary(r) for r in self.tool_calls.values()],
            "usage": self.usage.as_dict(),
            "model_calls": self.model_calls,
            "elapsed_ms": int((time.monotonic() - self.started_at) * 1000),
        }

    def final_event(self) -> SSEEvent:
        return SSEEvent("final", self.summary())
