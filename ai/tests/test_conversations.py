import psycopg
import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage
from psycopg.rows import dict_row
from psycopg_pool import AsyncConnectionPool

from cmdb_ai.config import get_settings
from cmdb_ai.conversations import TITLE_CHARS, ConversationStore
from cmdb_ai.investigator import unanswered_tool_calls

SCHEMA = "ai_pytest_conversations"


@pytest.fixture
async def store():
    """在临时 schema 里建表，测完删掉；连不上本地库就跳过。"""
    url = get_settings().database_url
    try:
        with psycopg.connect(url, connect_timeout=2, autocommit=True) as conn:
            conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{SCHEMA}"')
    except psycopg.OperationalError:
        pytest.skip("本地数据库不可用")
    pool = AsyncConnectionPool(
        url, open=False, kwargs={"autocommit": True, "row_factory": dict_row}
    )
    await pool.open()
    try:
        s = ConversationStore(pool, SCHEMA)
        await s.setup()
        yield s
    finally:
        await pool.close()
        with psycopg.connect(url, autocommit=True) as conn:
            conn.execute(f'DROP SCHEMA "{SCHEMA}" CASCADE')


async def test_conversation_history_round_trip(store):
    long_question = "这台主机\n为什么同时在两个模块？" * 10
    await store.add_message("u1", "c1", "user", long_question)
    await store.add_message("u1", "c1", "assistant", "### 结论\n因为……")
    await store.add_message("u1", "c2", "user", "第二个会话")

    listed = await store.list_conversations("u1")
    assert [c["conversation_id"] for c in listed] == ["c2", "c1"]  # 最近更新的在前
    title = listed[1]["title"]
    assert len(title) == TITLE_CHARS and "\n" not in title

    msgs = await store.messages("u1", "c1")
    assert [(m["role"], m["content"]) for m in msgs] == [
        ("user", long_question),
        ("assistant", "### 结论\n因为……"),
    ]
    # 别的用户拿同一个会话 ID 查不到
    assert await store.messages("u2", "c1") is None
    assert await store.list_conversations("u2") == []
    assert await store.delete("u2", "c1") is False

    assert await store.delete("u1", "c1") is True
    assert await store.messages("u1", "c1") is None


def test_unanswered_tool_calls_only_looks_at_last_ai_message():
    calls = [{"id": "t1", "name": "get_host", "args": {}}, {"id": "t2", "name": "x", "args": {}}]
    msgs = [
        HumanMessage("问题"),
        AIMessage("", tool_calls=calls),
        ToolMessage("结果", tool_call_id="t1"),
    ]
    assert [c["id"] for c in unanswered_tool_calls(msgs)] == ["t2"]
    msgs.append(ToolMessage("结果", tool_call_id="t2"))
    assert unanswered_tool_calls(msgs) == []
    assert unanswered_tool_calls([HumanMessage("问题"), AIMessage("回答")]) == []
    assert unanswered_tool_calls([]) == []
