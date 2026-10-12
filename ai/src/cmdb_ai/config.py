"""服务配置：从环境变量和 .env 读取。"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # 大模型
    deepseek_api_key: SecretStr
    deepseek_model: str = "deepseek-flash"

    # Go CMDB 后端
    cmdb_base_url: str = "http://localhost:8080"
    cmdb_mcp_url: str = "http://localhost:8080/mcp"
    cmdb_timeout_seconds: float = 30.0

    # 会话 / 检查点存储
    database_url: str = "postgresql://cmdb:password@localhost:5432/cmdb"
    # 拼进 search_path 和 DDL，只允许简单标识符
    ai_db_schema: str = Field(default="ai", pattern=r"^[a-z_][a-z0-9_]{0,62}$")

    # 知识库检索（search_knowledge 工具）：rerank = 向量 + 关键词 RRF 融合后重排；
    # vector、hybrid 只用于端到端逐项对比
    knowledge_search_mode: Literal["vector", "hybrid", "rerank"] = "rerank"

    # Agent 护栏：单次提问内的模型 / 工具调用上限
    agent_model_call_limit: int = 15
    agent_tool_call_limit: int = 25
    # 对话历史超过这个 token 数时压缩成摘要，保留最近若干条消息
    summarize_trigger_tokens: int = 60_000
    summarize_keep_messages: int = 20

    # 可观测（Langfuse，可选）：Public Key 和 Secret Key 都配置了才启用
    langfuse_base_url: str = "http://localhost:3100"
    langfuse_public_key: str | None = None
    langfuse_secret_key: SecretStr | None = None

    # 评测脚本用的本地账号
    cmdb_eval_username: str | None = None
    cmdb_eval_password: SecretStr | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
