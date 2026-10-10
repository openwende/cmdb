"""自定义中间件。"""

from langchain.agents.middleware import AgentMiddleware, ModelRequest
from langchain_core.messages import HumanMessage

WRAP_UP_INSTRUCTION = """【系统提示：调用次数已到上限】
这是本轮最后一次回答机会，不能再调用工具。请基于上面已经拿到的工具结果，按原有结构给出回答：
在"结论"开头说明调查因调用次数上限提前结束；已经查到的事实照常列出并标注依据；
没来得及查的内容放进"缺失证据"，并建议用户缩小问题范围后再问。"""


class WrapUpAtLimitMiddleware(AgentMiddleware):
    """单轮模型调用快到上限时，强制模型基于已有证据收尾。

    `ModelCallLimitMiddleware(exit_behavior="end")` 到上限时直接结束，用户只收到一句
    "Model call limits exceeded"，前面查到的证据全部丢失。这里在最后一次允许的调用上
    禁止调用工具并追加收尾要求，让模型必然给出文字回答，循环自然结束；硬上限仍保留作兜底。

    依赖 `ModelCallLimitMiddleware` 在状态里维护的 `run_model_call_count`（每轮清零）。
    """

    def __init__(self, run_limit: int):
        super().__init__()
        self.run_limit = run_limit

    def _wrap_up(self, request: ModelRequest) -> ModelRequest:
        calls_made = request.state.get("run_model_call_count", 0)
        if calls_made < self.run_limit - 1:
            return request
        # 收尾要求作为最后一条消息临时加在本次请求里（不写进会话状态）：放在系统提示词末尾时
        # 模型会忽略；同时用 tool_choice 禁止调用。工具定义要保留，去掉的话 DeepSeek 看到历史里
        # 的工具调用，会把调用标记（<｜DSML｜…>）当成正文输出
        return request.override(
            tool_choice="none",
            messages=[*request.messages, HumanMessage(content=WRAP_UP_INSTRUCTION)],
        )

    def wrap_model_call(self, request, handler):
        return handler(self._wrap_up(request))

    async def awrap_model_call(self, request, handler):
        return await handler(self._wrap_up(request))
