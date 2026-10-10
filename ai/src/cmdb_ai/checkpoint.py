"""会话检查点：LangGraph AsyncPostgresSaver，表放在独立 schema（默认 `ai`）。

表结构由本服务自己 `setup()` 创建和迁移，不走 Go 端的 golang-migrate。
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg import AsyncConnection, sql
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool


async def ensure_schema(database_url: str, schema: str) -> None:
    async with await AsyncConnection.connect(database_url, autocommit=True) as conn:
        await conn.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(sql.Identifier(schema)))


@asynccontextmanager
async def open_checkpointer(database_url: str, schema: str) -> AsyncIterator[AsyncPostgresSaver]:
    await ensure_schema(database_url, schema)
    async with AsyncConnectionPool(
        database_url,
        min_size=1,
        max_size=10,
        open=False,
        kwargs={
            "autocommit": True,
            "prepare_threshold": 0,
            "row_factory": dict_row,
            # schema 已由 Settings 限制为简单标识符
            "options": f"-c search_path={schema}",
        },
    ) as pool:
        saver = AsyncPostgresSaver(pool)
        await saver.setup()
        yield saver
