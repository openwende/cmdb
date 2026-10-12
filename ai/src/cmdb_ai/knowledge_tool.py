"""search_knowledge：Agent 查领域知识库的本地工具（不走 MCP）。

知识库是 AI 服务自己的数据（`ai.knowledge_chunks`），和用户权限无关，所以直接在 Python 侧
检索，不经过 Go 后端。检索流程用 C5 评测最好的配置：向量 + 关键词各取前 20 → RRF 融合 →
bge-reranker-v2-m3 重排 → 前 5 节（62 个查询 Recall@5 0.95、Hit@5 1.00）。
`KNOWLEDGE_SEARCH_MODE=vector | hybrid` 只用于端到端逐项对比。

两个本地模型约 4GB，第一次调用时才加载（几秒到十几秒），之后常驻；torch 推理是同步的，
放到线程里跑，不阻塞事件循环。同一个模型对象不保证线程安全，推理加锁串行。
"""

import asyncio
import threading
from dataclasses import dataclass

import psycopg
from langchain_core.tools import BaseTool, StructuredTool

from cmdb_ai.config import Settings
from cmdb_ai.knowledge_search import (
    CANDIDATES,
    BgeReranker,
    fetch_passages,
    keyword_search,
    rerank,
    rrf,
    vector_search,
)
from cmdb_ai.knowledge_store import TABLE, BgeM3Embedder

TOP_K = 5
TOOL_NAME = "search_knowledge"

TOOL_DESCRIPTION = """\
查 CMDB 领域知识库：概念和规则，不含具体主机、业务的数据。
覆盖：业务拓扑和空闲机池（空闲机 / 故障机 / 待回收）、资源池和目录、
主机流转规则（导入、分配、转移、回收）及后端实际做不做校验、主机内置字段和自定义字段的含义与取值约定、
审计记录怎么读（记了什么、没记什么）、角色与权限、动态分组、资源类型。
返回最相关的 5 个小节，每节以 [doc=文档#小节] 开头，引用时照抄这个标记。
query 写成完整的问题或描述（例如"主机还在别的模块时能不能回收到资源池"），不要只写一个词。"""


@dataclass(frozen=True)
class Passage:
    id: str  # "<文档 title>#<小节标题>"
    text: str  # "文档 / 小节标题\n正文"
    score: float  # rerank 模式是 reranker 分数，其余模式是向量相似度或 RRF 分数


class KnowledgeSearcher:
    def __init__(self, settings: Settings, top_k: int = TOP_K, table: str = TABLE):
        self._database_url = settings.database_url
        self._schema = settings.ai_db_schema
        self._table = table
        self._mode = settings.knowledge_search_mode
        self._top_k = top_k
        self._embedder: BgeM3Embedder | None = None
        self._reranker: BgeReranker | None = None
        self._lock = threading.Lock()

    def warm_up(self) -> tuple[BgeM3Embedder, BgeReranker | None]:
        with self._lock:
            if self._embedder is None:
                self._embedder = BgeM3Embedder()
            if self._reranker is None and self._mode == "rerank":
                self._reranker = BgeReranker()
            return self._embedder, self._reranker

    def search(self, query: str) -> list[Passage]:
        embedder, reranker = self.warm_up()
        with psycopg.connect(self._database_url) as conn:
            with self._lock:
                vector = embedder.embed([query])[0]
            hits = vector_search(conn, self._schema, vector, CANDIDATES, self._table)
            if self._mode != "vector":
                keyword = keyword_search(conn, self._schema, query, CANDIDATES, self._table)
                hits = rrf([hits, keyword])
                hits = hits[:CANDIDATES]
            texts = fetch_passages(conn, self._schema, [h.id for h in hits], self._table)
        if reranker is not None:
            with self._lock:
                hits = rerank(reranker, query, hits, texts)
        return [Passage(h.id, texts[h.id], h.score) for h in hits[: self._top_k]]

    async def asearch(self, query: str) -> list[Passage]:
        return await asyncio.to_thread(self.search, query)


def format_passages(passages: list[Passage]) -> str:
    """每节一个 [doc=…] 标记 + 正文。标记单独成行，引用核对按它找依据。"""
    if not passages:
        return "知识库里没有找到相关内容。"
    blocks = []
    for p in passages:
        body = p.text.split("\n", 1)[1] if "\n" in p.text else p.text  # 标题已在标记里
        blocks.append(f"[doc={p.id}]\n{body}")
    return "\n\n".join(blocks)


def build_knowledge_tool(searcher: KnowledgeSearcher) -> BaseTool:
    async def search_knowledge(query: str) -> str:
        return format_passages(await searcher.asearch(query))

    return StructuredTool.from_function(
        coroutine=search_knowledge, name=TOOL_NAME, description=TOOL_DESCRIPTION
    )
