import httpx
import pytest

from cmdb_ai.api import app
from cmdb_ai.cmdb import CMDBAuthError, UserContext
from cmdb_ai.quota import QuotaExceeded
from cmdb_ai.streaming import SSEEvent


class FakeCMDB:
    async def whoami(self, jwt):
        if jwt != "good":
            raise CMDBAuthError("登录已失效，请重新登录")
        return UserContext(user_id="u-1", username="alice", jwt=jwt)


class FakeKnowledge:
    enabled = True


class FakeInvestigator:
    def __init__(self):
        self.calls = []
        self.deleted = []
        self.knowledge = FakeKnowledge()

    async def stream(self, conversation_id, message, user):
        self.calls.append((conversation_id, message, user.username))
        yield SSEEvent("text", {"message_id": "m1", "delta": "你好"})
        yield SSEEvent("final", {"answer": "你好"})

    async def delete_thread(self, user, conversation_id):
        self.deleted.append((user.user_id, conversation_id))


class FakeStore:
    def __init__(self):
        self.messages_log = []

    async def add_message(self, user_id, conversation_id, role, content):
        self.messages_log.append((user_id, conversation_id, role, content))

    async def list_conversations(self, user_id):
        return [{"conversation_id": "c-1", "title": "问题"}] if user_id == "u-1" else []

    async def messages(self, user_id, conversation_id):
        if (user_id, conversation_id) != ("u-1", "c-1"):
            return None
        return [{"role": "user", "content": "问题"}, {"role": "assistant", "content": "回答"}]

    async def delete(self, user_id, conversation_id):
        return (user_id, conversation_id) == ("u-1", "c-1")

    async def knowledge_section(self, section_id):
        if section_id == "主机流转规则#回收到资源池":
            return {
                "id": section_id,
                "doc": "主机流转规则",
                "title": "回收到资源池",
                "content": "…",
            }
        return None


class FakeQuota:
    def __init__(self, exceeded=None):
        self.exceeded = exceeded
        self.consumed = []

    async def consume(self, user_id, day, per_user_limit, total_limit):
        if self.exceeded is None:
            self.consumed.append(user_id)
        return self.exceeded


AUTH = {"Authorization": "Bearer good"}


@pytest.fixture
def client():
    # ASGITransport 不跑 lifespan，直接注入假的依赖，不连数据库和模型
    app.state.cmdb = FakeCMDB()
    app.state.investigator = FakeInvestigator()
    app.state.store = FakeStore()
    app.state.quota = FakeQuota()
    app.state.active_threads = set()
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


BODY = {"conversation_id": "c-1", "message": "10.20.1.11 为什么同时在两个模块？"}


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer bad"}])
async def test_chat_requires_valid_jwt(client, headers):
    async with client:
        resp = await client.post("/chat", json=BODY, headers=headers)
    assert resp.status_code == 401


async def test_chat_rejects_bad_conversation_id(client):
    async with client:
        resp = await client.post(
            "/chat",
            json={**BODY, "conversation_id": "../x"},
            headers={"Authorization": "Bearer good"},
        )
    assert resp.status_code == 422


async def test_chat_streams_sse(client):
    async with client:
        resp = await client.post("/chat", json=BODY, headers={"Authorization": "Bearer good"})
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/event-stream")
    assert "event: text" in resp.text
    assert 'data: {"message_id": "m1", "delta": "你好"}' in resp.text
    assert "event: final" in resp.text
    assert app.state.investigator.calls == [("c-1", BODY["message"], "alice")]
    # 问题和最终回答都记进会话历史
    assert app.state.store.messages_log == [
        ("u-1", "c-1", "user", BODY["message"]),
        ("u-1", "c-1", "assistant", "你好"),
    ]
    assert app.state.active_threads == set()  # 结束后释放


async def test_chat_rejects_concurrent_turn_in_same_conversation(client):
    app.state.active_threads.add("u-1:c-1")
    async with client:
        busy = await client.post("/chat", json=BODY, headers=AUTH)
        other = await client.post("/chat", json={**BODY, "conversation_id": "c-2"}, headers=AUTH)
    assert busy.status_code == 409
    assert other.status_code == 200
    assert app.state.store.messages_log[0][1] == "c-2"  # 被拒绝的那条不记
    assert app.state.quota.consumed == ["u-1"]  # 也不扣次数


async def test_chat_rejects_when_daily_quota_used_up(client):
    app.state.quota = FakeQuota(QuotaExceeded("user", 30))
    async with client:
        resp = await client.post("/chat", json=BODY, headers=AUTH)
    assert resp.status_code == 429
    assert "每个账号每天 30 次" in resp.json()["detail"]
    assert app.state.investigator.calls == []
    assert app.state.store.messages_log == []


async def test_conversation_endpoints_are_scoped_to_user(client):
    async with client:
        listed = await client.get("/conversations", headers=AUTH)
        mine = await client.get("/conversations/c-1/messages", headers=AUTH)
        missing = await client.get("/conversations/c-9/messages", headers=AUTH)
        bad_id = await client.get("/conversations/..%2Fx/messages", headers=AUTH)
        no_auth = await client.get("/conversations")
    assert listed.json() == {"items": [{"conversation_id": "c-1", "title": "问题"}]}
    assert [m["role"] for m in mine.json()["items"]] == ["user", "assistant"]
    assert missing.status_code == 404
    assert bad_id.status_code in (404, 422)
    assert no_auth.status_code == 401


async def test_delete_conversation_also_drops_checkpoints(client):
    async with client:
        ok = await client.delete("/conversations/c-1", headers=AUTH)
        missing = await client.delete("/conversations/c-9", headers=AUTH)
    assert ok.status_code == 204
    assert missing.status_code == 404
    assert app.state.investigator.deleted == [("u-1", "c-1")]


async def test_knowledge_section(client):
    async with client:
        found = await client.get(
            "/knowledge/sections", params={"id": "主机流转规则#回收到资源池"}, headers=AUTH
        )
        missing = await client.get("/knowledge/sections", params={"id": "x#y"}, headers=AUTH)
    assert found.json()["title"] == "回收到资源池"
    assert missing.status_code == 404


async def test_knowledge_section_is_404_when_knowledge_is_off(client):
    app.state.investigator.knowledge.enabled = False
    async with client:
        resp = await client.get(
            "/knowledge/sections", params={"id": "主机流转规则#回收到资源池"}, headers=AUTH
        )
    assert resp.status_code == 404


async def test_cors_preflight_allows_local_frontend(client):
    async with client:
        resp = await client.options(
            "/chat",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        evil = await client.options(
            "/chat",
            headers={"Origin": "http://evil.test", "Access-Control-Request-Method": "POST"},
        )
    assert resp.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert "access-control-allow-origin" not in evil.headers
