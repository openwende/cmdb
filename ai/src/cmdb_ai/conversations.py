"""会话列表和展示用的问答记录（前端的历史会话），表放在 AI 服务自己的 schema。

Agent 的完整状态在 LangGraph 检查点里，这里另存一份"用户看到的问答"：
检查点里的消息会被摘要中间件替换成摘要，内部格式也不该让前端依赖。
每轮开始时记用户问题，收到 final 时记最终回答；中途停止或出错的轮次只有问题。
会话按 (user_id, conversation_id) 隔离，别人即使知道会话 ID 也查不到。
"""

from typing import Any

from psycopg import sql
from psycopg_pool import AsyncConnectionPool

TITLE_CHARS = 60


class ConversationStore:
    def __init__(self, pool: AsyncConnectionPool, schema: str):
        self._pool = pool
        self._schema = sql.Identifier(schema)

    def _sql(self, query: str) -> sql.Composed:
        return sql.SQL(query).format(schema=self._schema)

    async def setup(self) -> None:
        async with self._pool.connection() as conn:
            await conn.execute(
                self._sql(
                    """
                    CREATE TABLE IF NOT EXISTS {schema}.conversations (
                        user_id         text NOT NULL,
                        conversation_id text NOT NULL,
                        title           text NOT NULL,       -- 第一条问题
                        created_at      timestamptz NOT NULL DEFAULT now(),
                        updated_at      timestamptz NOT NULL DEFAULT now(),
                        PRIMARY KEY (user_id, conversation_id)
                    )
                    """
                )
            )
            await conn.execute(
                self._sql(
                    """
                    CREATE TABLE IF NOT EXISTS {schema}.conversation_messages (
                        id              bigserial PRIMARY KEY,
                        user_id         text NOT NULL,
                        conversation_id text NOT NULL,
                        role            text NOT NULL CHECK (role IN ('user', 'assistant')),
                        content         text NOT NULL,
                        created_at      timestamptz NOT NULL DEFAULT now(),
                        FOREIGN KEY (user_id, conversation_id)
                            REFERENCES {schema}.conversations ON DELETE CASCADE
                    )
                    """
                )
            )
            await conn.execute(
                self._sql(
                    """
                    CREATE INDEX IF NOT EXISTS conversation_messages_conversation_idx
                    ON {schema}.conversation_messages (user_id, conversation_id, id)
                    """
                )
            )

    async def add_message(
        self, user_id: str, conversation_id: str, role: str, content: str
    ) -> None:
        """记一条问答；会话不存在时用这条（第一条问题）当标题创建。"""
        async with self._pool.connection() as conn, conn.transaction():
            await conn.execute(
                self._sql(
                    """
                    INSERT INTO {schema}.conversations (user_id, conversation_id, title)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id, conversation_id) DO UPDATE SET updated_at = now()
                    """
                ),
                (user_id, conversation_id, " ".join(content.split())[:TITLE_CHARS]),
            )
            await conn.execute(
                self._sql(
                    """
                    INSERT INTO {schema}.conversation_messages
                        (user_id, conversation_id, role, content)
                    VALUES (%s, %s, %s, %s)
                    """
                ),
                (user_id, conversation_id, role, content),
            )

    async def list_conversations(self, user_id: str, limit: int = 50) -> list[dict[str, Any]]:
        async with self._pool.connection() as conn:
            cur = await conn.execute(
                self._sql(
                    """
                    SELECT conversation_id, title, created_at, updated_at
                    FROM {schema}.conversations WHERE user_id = %s
                    ORDER BY updated_at DESC, conversation_id LIMIT %s
                    """
                ),
                (user_id, limit),
            )
            return await cur.fetchall()

    async def messages(self, user_id: str, conversation_id: str) -> list[dict[str, Any]] | None:
        """会话不存在（或不是这个用户的）返回 None。"""
        async with self._pool.connection() as conn:
            cur = await conn.execute(
                self._sql(
                    """
                    SELECT 1 FROM {schema}.conversations
                    WHERE user_id = %s AND conversation_id = %s
                    """
                ),
                (user_id, conversation_id),
            )
            if await cur.fetchone() is None:
                return None
            cur = await conn.execute(
                self._sql(
                    """
                    SELECT role, content, created_at FROM {schema}.conversation_messages
                    WHERE user_id = %s AND conversation_id = %s ORDER BY id
                    """
                ),
                (user_id, conversation_id),
            )
            return await cur.fetchall()

    async def delete(self, user_id: str, conversation_id: str) -> bool:
        async with self._pool.connection() as conn:
            cur = await conn.execute(
                self._sql(
                    "DELETE FROM {schema}.conversations WHERE user_id = %s AND conversation_id = %s"
                ),
                (user_id, conversation_id),
            )
            return cur.rowcount > 0

    async def knowledge_section(self, section_id: str) -> dict[str, Any] | None:
        """知识库小节原文，给前端点开 [doc=…] 引用用。"""
        async with self._pool.connection() as conn:
            cur = await conn.execute(
                self._sql(
                    "SELECT id, doc, title, content FROM {schema}.knowledge_chunks WHERE id = %s"
                ),
                (section_id,),
            )
            return await cur.fetchone()
