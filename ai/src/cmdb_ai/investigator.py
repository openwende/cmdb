"""调查助手的运行入口：懒加载工具、组装 Agent、执行一轮对话并产出 SSE 事件。

对话接口和评测脚本都走这里，保证评测测到的就是线上的行为。
"""

import asyncio
import logging
from collections.abc import AsyncIterator

from langchain_core.messages import AIMessage, ToolMessage
from langgraph.types import Checkpointer

from cmdb_ai.agent import build_agent
from cmdb_ai.cmdb import UserContext
from cmdb_ai.config import Settings
from cmdb_ai.knowledge_tool import KnowledgeSearcher, build_knowledge_tool
from cmdb_ai.mcp_tools import list_mcp_tools, to_langchain_tools
from cmdb_ai.observability import Tracing
from cmdb_ai.streaming import EventTranslator, SSEEvent

logger = logging.getLogger(__name__)

INTERRUPTED_TOOL_RESULT = "（这次工具调用被用户中断，没有结果。如果仍然需要，重新调用。）"


def thread_id_for(user: UserContext, conversation_id: str) -> str:
    """检查点 thread_id 带上用户 ID：别人即使拿到会话 ID 也读不到这段对话。"""
    return f"{user.user_id}:{conversation_id}"


def unanswered_tool_calls(messages: list) -> list[dict]:
    """最后一条 AI 消息里还没有工具结果的调用（用户在工具执行中途断开时会留下）。"""
    for i in range(len(messages) - 1, -1, -1):
        if isinstance(messages[i], AIMessage):
            answered = {m.tool_call_id for m in messages[i + 1 :] if isinstance(m, ToolMessage)}
            return [c for c in messages[i].tool_calls if c["id"] not in answered]
    return []


class Investigator:
    def __init__(self, settings: Settings, checkpointer: Checkpointer = None):
        self._settings = settings
        self._checkpointer = checkpointer
        self._agent = None
        self._lock = asyncio.Lock()
        self.tracing = Tracing(settings)
        self.knowledge = KnowledgeSearcher(settings)

    async def _get_agent(self, user: UserContext):
        # /mcp 需要认证，服务本身没有凭证，所以用第一个请求者的 JWT 拉取工具定义。
        # 工具定义对所有角色相同，拉一次后缓存；之后的调用都转发各自用户的 JWT。
        if self._agent is None:
            async with self._lock:
                if self._agent is None:
                    mcp_tools = await list_mcp_tools(self._settings.cmdb_mcp_url, user.jwt)
                    tools = to_langchain_tools(self._settings.cmdb_mcp_url, mcp_tools)
                    logger.info("已加载 %d 个 MCP 工具: %s", len(tools), [t.name for t in tools])
                    tools.append(build_knowledge_tool(self.knowledge))
                    self._agent = build_agent(self._settings, tools, self._checkpointer)
        return self._agent

    async def _close_interrupted_tool_calls(self, agent, config: dict) -> None:
        """上一轮在工具执行中途被中断时，补上"已中断"的工具结果。

        模型 API 要求每个 tool_call 都有对应的工具结果，否则下一次请求直接报 400，
        这个会话就再也问不下去了。补在新问题之前，消息顺序才对。
        """
        if self._checkpointer is None:
            return
        state = await agent.aget_state(config)
        missing = unanswered_tool_calls(state.values.get("messages", []))
        if missing:
            results = [
                ToolMessage(
                    INTERRUPTED_TOOL_RESULT, tool_call_id=c["id"], name=c["name"], status="error"
                )
                for c in missing
            ]
            await agent.aupdate_state(config, {"messages": results}, as_node="tools")
            logger.info("补上 %d 个被中断的工具调用结果", len(results))

    async def delete_thread(self, user: UserContext, conversation_id: str) -> None:
        if self._checkpointer is not None:
            await self._checkpointer.adelete_thread(thread_id_for(user, conversation_id))

    async def stream(
        self,
        conversation_id: str,
        message: str,
        user: UserContext,
        include_tool_outputs: bool = False,
        trace_tags: list[str] | None = None,
    ) -> AsyncIterator[SSEEvent]:
        """include_tool_outputs：final 事件里带完整工具结果，供评测判断回答是否有依据。
        trace_tags：Langfuse trace 的标签，默认 ["chat"]，评测传 ["eval", label]。"""
        translator = EventTranslator(include_tool_outputs)
        thread_id = thread_id_for(user, conversation_id)
        config: dict = {"configurable": {"thread_id": thread_id}}
        handler = self.tracing.handler()
        if handler is not None:
            config["callbacks"] = [handler]
            config["metadata"] = self.tracing.metadata(user, thread_id, trace_tags or ["chat"])
        try:
            agent = await self._get_agent(user)
            await self._close_interrupted_tool_calls(agent, config)
            run = await agent.astream_events(
                {"messages": [{"role": "user", "content": message}]},
                config,
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
        final = translator.final_event()
        if handler is not None and handler.last_trace_id:
            final.data["trace_id"] = handler.last_trace_id
        yield final
