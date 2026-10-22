import json

import httpx
import pytest

from cmdb_ai import knowledge_models
from cmdb_ai.config import get_settings
from cmdb_ai.knowledge_models import (
    EMBED_BATCH,
    SiliconFlowClient,
    SiliconFlowEmbedder,
    SiliconFlowReranker,
    make_embedder,
)
from cmdb_ai.knowledge_store import EMBED_DIM


def _client(handler) -> tuple[SiliconFlowClient, list[dict]]:
    requests: list[dict] = []

    def record(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        requests.append({"path": request.url.path, "auth": request.headers["authorization"]} | body)
        return handler(body)

    return SiliconFlowClient("sk-test", transport=httpx.MockTransport(record)), requests


def test_embedder_batches_and_restores_input_order():
    def handler(body):
        # 故意倒序返回，按 index 还原
        data = [
            {"index": i, "embedding": [float(len(t))] * EMBED_DIM}
            for i, t in enumerate(body["input"])
        ]
        return httpx.Response(200, json={"data": data[::-1]})

    client, requests = _client(handler)
    texts = ["a" * (i + 1) for i in range(EMBED_BATCH + 3)]
    vectors = SiliconFlowEmbedder(client).embed(texts)

    assert [v[0] for v in vectors] == [float(i + 1) for i in range(len(texts))]
    assert [len(r["input"]) for r in requests] == [EMBED_BATCH, 3]
    assert requests[0]["path"] == "/v1/embeddings"
    assert requests[0]["model"] == "BAAI/bge-m3"
    assert requests[0]["auth"] == "Bearer sk-test"


def test_embedder_rejects_wrong_dimension():
    client, _ = _client(
        lambda body: httpx.Response(200, json={"data": [{"index": 0, "embedding": [0.1, 0.2]}]})
    )
    with pytest.raises(ValueError, match="1024 维"):
        SiliconFlowEmbedder(client).embed(["x"])


def test_reranker_maps_scores_back_to_input_order():
    def handler(body):
        assert body["top_n"] == 3 and body["return_documents"] is False
        results = [
            {"index": 2, "relevance_score": 0.9},
            {"index": 0, "relevance_score": 0.5},
            {"index": 1, "relevance_score": 0.1},
        ]
        return httpx.Response(200, json={"results": results})

    client, requests = _client(handler)
    reranker = SiliconFlowReranker(client)
    assert reranker.score("q", ["a", "b", "c"]) == [0.5, 0.1, 0.9]
    assert requests[0]["path"] == "/v1/rerank"
    assert requests[0]["model"] == "BAAI/bge-reranker-v2-m3"
    assert reranker.score("q", []) == []
    assert len(requests) == 1  # 空列表不发请求


def test_client_retries_rate_limit_then_gives_up(monkeypatch):
    monkeypatch.setattr(knowledge_models.time, "sleep", lambda _: None)
    statuses = iter([429, 503, 200])
    client, requests = _client(lambda body: httpx.Response(next(statuses), json={"results": []}))
    assert client.post("/rerank", {}) == {"results": []}
    assert len(requests) == 3

    client, requests = _client(lambda body: httpx.Response(429, json={}))
    with pytest.raises(httpx.HTTPStatusError):
        client.post("/rerank", {})
    assert len(requests) == 3

    client, requests = _client(lambda body: httpx.Response(401, json={}))
    with pytest.raises(httpx.HTTPStatusError):  # Key 错了不重试
        client.post("/rerank", {})
    assert len(requests) == 1


def test_siliconflow_provider_requires_key():
    settings = get_settings().model_copy(
        update={"knowledge_model_provider": "siliconflow", "siliconflow_api_key": None}
    )
    with pytest.raises(ValueError, match="SILICONFLOW_API_KEY"):
        make_embedder(settings)


def test_embedder_name_includes_provider():
    # 名字进 content_hash：从本地切到托管 API 后重新入库会重算全部向量
    assert SiliconFlowEmbedder.name == "siliconflow:BAAI/bge-m3"
