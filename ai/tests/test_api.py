import httpx
import pytest

from cmdb_ai.api import app
from cmdb_ai.cmdb import CMDBAuthError, UserContext
from cmdb_ai.streaming import SSEEvent


class FakeCMDB:
    async def whoami(self, jwt):
        if jwt != "good":
            raise CMDBAuthError("登录已失效，请重新登录")
        return UserContext(user_id="u-1", username="alice", jwt=jwt)


class FakeInvestigator:
    def __init__(self):
        self.calls = []

    async def stream(self, conversation_id, message, user):
        self.calls.append((conversation_id, message, user.username))
        yield SSEEvent("text", {"message_id": "m1", "delta": "你好"})
        yield SSEEvent("final", {"answer": "你好"})


@pytest.fixture
def client():
    # ASGITransport 不跑 lifespan，直接注入假的依赖，不连数据库和模型
    app.state.cmdb = FakeCMDB()
    app.state.investigator = FakeInvestigator()
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
