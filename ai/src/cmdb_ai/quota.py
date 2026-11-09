"""每天的提问次数限额：每个用户一份，全站一份，防止公开演示环境把 DeepSeek 额度刷完。

按"提问次数"计数而不是按 token：每次提问的模型调用已有上限（AGENT_MODEL_CALL_LIMIT），
花费有界；token 要等回答结束才知道，用户中途停止或断开时会漏记。次数在开始回答前就扣掉，
所以停止、断开、出错的提问也算一次。演示账号是大家共用的，"每个用户"对它就是全体访客。
"""

from dataclasses import dataclass
from datetime import date, datetime
from zoneinfo import ZoneInfo

from psycopg import sql
from psycopg_pool import AsyncConnectionPool

# 所有扣次数的事务按天串行：先拿这把锁，再读当天合计、判断、加一，不会两个请求同时通过
LOCK_KEY = "cmdb_ai.chat_quota"


@dataclass(frozen=True)
class QuotaExceeded:
    scope: str  # user：这个用户今天用完了；total：全站今天用完了
    limit: int

    @property
    def message(self) -> str:
        if self.scope == "user":
            return f"今天的 AI 提问次数已用完（每个账号每天 {self.limit} 次），请明天再来"
        return "今天 AI 助手的总提问次数已用完，请明天再来"


def today(timezone: str) -> date:
    return datetime.now(ZoneInfo(timezone)).date()


class QuotaStore:
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
                    CREATE TABLE IF NOT EXISTS {schema}.chat_quota (
                        day        date NOT NULL,
                        user_id    text NOT NULL,
                        questions  integer NOT NULL,
                        PRIMARY KEY (day, user_id)
                    )
                    """
                )
            )

    async def consume(
        self, user_id: str, day: date, per_user_limit: int, total_limit: int
    ) -> QuotaExceeded | None:
        """扣一次；超限时不扣，返回超的是哪一项。上限为 0 表示不限。"""
        async with self._pool.connection() as conn, conn.transaction():
            await conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (LOCK_KEY,))
            cur = await conn.execute(
                self._sql(
                    """
                    SELECT coalesce(sum(questions), 0) AS total,
                           coalesce(sum(questions) FILTER (WHERE user_id = %s), 0) AS mine
                    FROM {schema}.chat_quota WHERE day = %s
                    """
                ),
                (user_id, day),
            )
            used = await cur.fetchone()
            if per_user_limit and used["mine"] >= per_user_limit:
                return QuotaExceeded("user", per_user_limit)
            if total_limit and used["total"] >= total_limit:
                return QuotaExceeded("total", total_limit)
            await conn.execute(
                self._sql(
                    """
                    INSERT INTO {schema}.chat_quota (day, user_id, questions) VALUES (%s, %s, 1)
                    ON CONFLICT (day, user_id)
                    DO UPDATE SET questions = {schema}.chat_quota.questions + 1
                    """
                ),
                (day, user_id),
            )
            return None
