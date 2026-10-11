"""Langfuse 可观测（可选）：Public Key 和 Secret Key 都配置了才启用，否则所有方法都是空操作，
不影响对话接口、评测和单元测试。

每次请求新建一个 LangChain CallbackHandler（它保存单次运行的状态，不能跨请求共用），
用 metadata 把 trace 归到用户和会话下。用户 JWT 只在运行时 context 里，不进 metadata、
也不在消息里，所以不会被上报。
"""

import logging
from typing import Any

from cmdb_ai.cmdb import UserContext
from cmdb_ai.config import Settings

logger = logging.getLogger(__name__)


class Tracing:
    def __init__(self, settings: Settings):
        self._client = None
        self._public_key = settings.langfuse_public_key
        if not (settings.langfuse_public_key and settings.langfuse_secret_key):
            return
        from langfuse import Langfuse

        self._client = Langfuse(
            public_key=settings.langfuse_public_key,
            secret_key=settings.langfuse_secret_key.get_secret_value(),
            base_url=settings.langfuse_base_url,
        )
        logger.info("Langfuse 已启用：%s", settings.langfuse_base_url)

    @property
    def enabled(self) -> bool:
        return self._client is not None

    def handler(self):
        if not self.enabled:
            return None
        from langfuse.langchain import CallbackHandler

        return CallbackHandler(public_key=self._public_key)

    @staticmethod
    def metadata(user: UserContext, session_id: str, tags: list[str]) -> dict[str, Any]:
        """trace 级属性：按用户名、会话聚合；tags 区分线上对话和评测。"""
        return {
            "langfuse_user_id": user.username,
            "langfuse_session_id": session_id,
            "langfuse_tags": tags,
        }

    def flush(self) -> None:
        if self.enabled:
            self._client.flush()

    def shutdown(self) -> None:
        if self.enabled:
            self._client.shutdown()
