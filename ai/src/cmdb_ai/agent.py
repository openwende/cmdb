"""调查助手 Agent：DeepSeek + CMDB MCP 工具 + 护栏中间件。"""

from datetime import datetime
from zoneinfo import ZoneInfo

from langchain.agents import create_agent
from langchain.agents.middleware import (
    ModelCallLimitMiddleware,
    ModelRequest,
    SummarizationMiddleware,
    ToolCallLimitMiddleware,
    ToolRetryMiddleware,
    dynamic_prompt,
)
from langchain_core.tools import BaseTool
from langchain_deepseek import ChatDeepSeek
from langgraph.types import Checkpointer

from cmdb_ai.cmdb import UserContext
from cmdb_ai.config import Settings
from cmdb_ai.middleware import WrapUpAtLimitMiddleware
from cmdb_ai.prompts import INVESTIGATOR_SYSTEM_PROMPT, with_current_date

# 只读取 messages 里这个节点的模型输出；摘要中间件内部的模型调用不推给用户
MODEL_NODE = "model"

BEIJING = ZoneInfo("Asia/Shanghai")


@dynamic_prompt
def investigator_prompt(request: ModelRequest) -> str:
    return with_current_date(INVESTIGATOR_SYSTEM_PROMPT, datetime.now(BEIJING).date())


def build_model(settings: Settings, *, streaming: bool = True) -> ChatDeepSeek:
    return ChatDeepSeek(
        model=settings.deepseek_model,
        api_key=settings.deepseek_api_key,
        streaming=streaming,
        stream_usage=True,
        max_retries=2,
    )


def _retryable(exc: BaseException) -> bool:
    # 缺少用户身份是确定性错误，重试没有意义
    return isinstance(exc, Exception) and not isinstance(exc, PermissionError)


def build_agent(settings: Settings, tools: list[BaseTool], checkpointer: Checkpointer = None):
    return create_agent(
        build_model(settings),
        tools,
        context_schema=UserContext,
        checkpointer=checkpointer,
        middleware=[
            investigator_prompt,
            SummarizationMiddleware(
                model=build_model(settings, streaming=False),
                trigger=("tokens", settings.summarize_trigger_tokens),
                keep=("messages", settings.summarize_keep_messages),
            ),
            # 最后一次允许的调用禁止工具、强制收尾；硬上限只作兜底，正常不会触发
            WrapUpAtLimitMiddleware(run_limit=settings.agent_model_call_limit),
            ModelCallLimitMiddleware(
                run_limit=settings.agent_model_call_limit, exit_behavior="end"
            ),
            ToolCallLimitMiddleware(run_limit=settings.agent_tool_call_limit),
            ToolRetryMiddleware(max_retries=2, retry_on=_retryable, on_failure="continue"),
        ],
    )
