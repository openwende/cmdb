import asyncio
from datetime import date

import psycopg
import pytest
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from cmdb_ai.config import get_settings
from cmdb_ai.quota import QuotaStore

SCHEMA = "ai_pytest_quota"
DAY = date(2026, 10, 21)


@pytest.fixture
async def quota():
    """在临时 schema 里建表，测完删掉；连不上本地库就跳过。"""
    url = get_settings().database_url
    try:
        with psycopg.connect(url, connect_timeout=2, autocommit=True) as conn:
            conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"')
    except psycopg.OperationalError:
        pytest.skip("本地数据库不可用")
    pool = AsyncConnectionPool(
        url, open=False, max_size=10, kwargs={"autocommit": True, "row_factory": dict_row}
    )
    await pool.open()
    try:
        q = QuotaStore(pool, SCHEMA)
        await q.setup()
        yield q
    finally:
        await pool.close()
        with psycopg.connect(url, autocommit=True) as conn:
            conn.execute(f'DROP SCHEMA "{SCHEMA}" CASCADE')


async def test_per_user_limit_then_next_day_resets(quota):
    assert await quota.consume("u1", DAY, 2, 0) is None
    assert await quota.consume("u1", DAY, 2, 0) is None
    exceeded = await quota.consume("u1", DAY, 2, 0)
    assert (exceeded.scope, exceeded.limit) == ("user", 2)
    assert await quota.consume("u2", DAY, 2, 0) is None  # 别的账号不受影响
    assert await quota.consume("u1", date(2026, 10, 22), 2, 0) is None  # 第二天重新计


async def test_total_limit_across_users(quota):
    assert await quota.consume("u1", DAY, 0, 2) is None
    assert await quota.consume("u2", DAY, 0, 2) is None
    exceeded = await quota.consume("u3", DAY, 0, 2)
    assert exceeded.scope == "total"
    assert "总提问次数" in exceeded.message


async def test_concurrent_requests_never_exceed_limit(quota):
    results = await asyncio.gather(*(quota.consume("u1", DAY, 5, 0) for _ in range(20)))
    assert sum(r is None for r in results) == 5
