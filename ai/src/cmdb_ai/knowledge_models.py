"""知识库用的向量模型和 rerank 模型：本地（sentence-transformers）或托管 API（硅基流动）。

两种来源是同一对模型（bge-m3 + bge-reranker-v2-m3）。托管 API 不占内存，给放不下本地模型
（约 4GB）的部署用，例如 207 演示机。`KNOWLEDGE_MODEL_PROVIDER=local | siliconflow` 选择。

向量模型的 `name` 会写进 `content_hash` 和 `embed_model` 列：托管 API 和本地权重的数值不完全相同，
名字带上来源，切换来源后重新入库会整体重算向量，不会出现"库里是本地向量、查询用 API 向量"。
"""

import time
from collections.abc import Sequence

import httpx

from cmdb_ai.config import Settings
from cmdb_ai.knowledge_search import RERANK_MODEL, BgeReranker, Reranker
from cmdb_ai.knowledge_store import EMBED_DIM, EMBED_MODEL, BgeM3Embedder, Embedder

EMBED_BATCH = 16  # 每次请求最多向量化多少段（入库一次 66 节，分几批发）
RETRY_STATUSES = {429, 500, 502, 503, 504}
RETRY_DELAYS = (1.0, 3.0)  # 限流 / 服务端错误重试两次；Agent 里的工具调用外面还有一层重试


class SiliconFlowClient:
    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.siliconflow.cn/v1",
        timeout: float = 30.0,
        transport: httpx.BaseTransport | None = None,
    ):
        self._client = httpx.Client(
            base_url=base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
            transport=transport,
        )

    def post(self, path: str, body: dict) -> dict:
        for delay in (*RETRY_DELAYS, None):
            try:
                response = self._client.post(path, json=body)
            except httpx.TransportError:
                if delay is None:
                    raise
            else:
                if response.status_code not in RETRY_STATUSES or delay is None:
                    response.raise_for_status()
                    return response.json()
            time.sleep(delay)
        raise AssertionError("unreachable")


class SiliconFlowEmbedder:
    """托管的 bge-m3：OpenAI 兼容的 /embeddings，返回的向量已归一化（实测模长 1.0）。"""

    name = f"siliconflow:{EMBED_MODEL}"

    def __init__(self, client: SiliconFlowClient, model: str = EMBED_MODEL):
        self._client = client
        self._model = model

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for i in range(0, len(texts), EMBED_BATCH):
            batch = list(texts[i : i + EMBED_BATCH])
            data = self._client.post(
                "/embeddings", {"model": self._model, "input": batch, "encoding_format": "float"}
            )["data"]
            data = sorted(data, key=lambda d: d["index"])
            if len(data) != len(batch) or any(len(d["embedding"]) != EMBED_DIM for d in data):
                raise ValueError(
                    f"向量接口返回 {len(data)} 条，应为 {len(batch)} 条 {EMBED_DIM} 维"
                )
            vectors.extend(d["embedding"] for d in data)
        return vectors


class SiliconFlowReranker:
    """托管的 bge-reranker-v2-m3：/rerank 按分数降序返回，用 index 还原成输入顺序。"""

    name = f"siliconflow:{RERANK_MODEL}"

    def __init__(self, client: SiliconFlowClient, model: str = RERANK_MODEL):
        self._client = client
        self._model = model

    def score(self, query: str, passages: Sequence[str]) -> list[float]:
        if not passages:
            return []
        results = self._client.post(
            "/rerank",
            {
                "model": self._model,
                "query": query,
                "documents": list(passages),
                "top_n": len(passages),
                "return_documents": False,
            },
        )["results"]
        scores = {r["index"]: float(r["relevance_score"]) for r in results}
        if len(scores) != len(passages):
            raise ValueError(f"rerank 接口返回 {len(scores)} 个分数，应为 {len(passages)} 个")
        return [scores[i] for i in range(len(passages))]


def _client(settings: Settings) -> SiliconFlowClient:
    if settings.siliconflow_api_key is None:
        raise ValueError("KNOWLEDGE_MODEL_PROVIDER=siliconflow 需要配置 SILICONFLOW_API_KEY")
    return SiliconFlowClient(
        settings.siliconflow_api_key.get_secret_value(), settings.siliconflow_base_url
    )


def make_embedder(settings: Settings) -> Embedder:
    if settings.knowledge_model_provider == "siliconflow":
        return SiliconFlowEmbedder(_client(settings))
    return BgeM3Embedder()


def make_reranker(settings: Settings) -> Reranker:
    if settings.knowledge_model_provider == "siliconflow":
        return SiliconFlowReranker(_client(settings))
    return BgeReranker()
