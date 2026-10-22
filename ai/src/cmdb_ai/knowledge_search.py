"""知识库检索：向量检索、关键词检索、RRF 融合、bge-reranker-v2-m3 重排。

    向量 top-N ─┐
                ├─ RRF 融合 → 前 N 个候选 → rerank → 前 k 个
    关键词 top-N ┘

关键词检索：查询用和入库相同的 jieba 分词，交给 to_tsvector('simple', …) 归一化成词位，
再用 OR 连成 tsquery（任意一个词命中就算候选），ts_rank 排序。用 OR 而不是 AND：
自然语言问题里总有正文里没有的词（"为什么""哪里"），AND 几乎什么都查不到。
"""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

import psycopg
from psycopg import sql

from cmdb_ai.knowledge_store import TABLE, to_vector_literal, tokenize

RERANK_MODEL = "BAAI/bge-reranker-v2-m3"
RERANK_REVISION = "953dc6f6f85a1b2dbfca4c34a2796e7dde08d41e"  # 固定版本
RRF_K = 60  # RRF 的平滑常数，沿用原论文的 60：排名靠前的差距被压平，不让单路第一名独占
CANDIDATES = 20  # 每一路取多少个参与融合、融合后取多少个给 rerank


@dataclass(frozen=True)
class Hit:
    id: str  # "<文档 title>#<小节标题>"
    score: float


def vector_search(
    conn: psycopg.Connection,
    schema: str,
    query_vector: Sequence[float],
    k: int = 10,
    table: str = TABLE,
) -> list[Hit]:
    """按余弦相似度取前 k 个小节（向量已归一化，相似度 = 1 - 余弦距离）。"""
    ident = sql.Identifier(schema)
    rows = conn.execute(
        sql.SQL(
            """
            SELECT id, 1 - (embedding OPERATOR({}.<=>) %s::{}.vector) AS score
            FROM {}.{}
            ORDER BY embedding OPERATOR({}.<=>) %s::{}.vector
            LIMIT %s
            """
        ).format(ident, ident, ident, sql.Identifier(table), ident, ident),
        (to_vector_literal(query_vector), to_vector_literal(query_vector), k),
    ).fetchall()
    return [Hit(id, float(score)) for id, score in rows]


def keyword_search(
    conn: psycopg.Connection,
    schema: str,
    query: str,
    k: int = 10,
    table: str = TABLE,
) -> list[Hit]:
    """jieba 分词 → 词位 OR 组成 tsquery → ts_rank 排序，取前 k 个。

    词位先经过 to_tsvector('simple', …) 归一化（转小写、按下划线拆开），和入库的 tsv 同一口径；
    拼 tsquery 时每个词位加引号，单引号和反斜杠转义，查询里的 `|`、`!`、`:` 不会被当成运算符。
    """
    rows = conn.execute(
        sql.SQL(
            r"""
            WITH q AS (
                SELECT string_agg(
                    '''' || replace(replace(lexeme, '\', '\\'), '''', '''''') || '''', ' | '
                )::tsquery AS query
                FROM unnest(to_tsvector('simple', %s))
            )
            SELECT c.id, ts_rank(c.tsv, q.query) AS score
            FROM {}.{} c, q
            WHERE c.tsv @@ q.query
            ORDER BY score DESC, c.id
            LIMIT %s
            """
        ).format(sql.Identifier(schema), sql.Identifier(table)),
        (tokenize(query), k),
    ).fetchall()
    return [Hit(id, float(score)) for id, score in rows]


def rrf(rankings: Sequence[Sequence[Hit]], k: int = RRF_K) -> list[Hit]:
    """Reciprocal Rank Fusion：每一路里排第 r 名得 1 / (k + r)，各路相加后排序。

    只看名次不看分数，所以余弦相似度和 ts_rank 量纲不同也能直接融合。
    """
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, hit in enumerate(ranking, 1):
            scores[hit.id] = scores.get(hit.id, 0.0) + 1 / (k + rank)
    return [Hit(id, s) for id, s in sorted(scores.items(), key=lambda x: (-x[1], x[0]))]


def fetch_passages(
    conn: psycopg.Connection, schema: str, ids: Sequence[str], table: str = TABLE
) -> dict[str, str]:
    """取小节的 rerank 输入文本，口径和向量化相同："文档 / 小节标题\\n正文"。"""
    rows = conn.execute(
        sql.SQL(
            "SELECT id, doc || ' / ' || title || E'\\n' || content FROM {}.{} WHERE id = ANY(%s)"
        ).format(sql.Identifier(schema), sql.Identifier(table)),
        (list(ids),),
    ).fetchall()
    return dict(rows)


class Reranker(Protocol):
    name: str

    def score(self, query: str, passages: Sequence[str]) -> list[float]: ...


class BgeReranker:
    """本地 bge-reranker-v2-m3 交叉编码器：查询和小节一起过模型打相关性分。"""

    name = RERANK_MODEL

    def __init__(self, model: str = RERANK_MODEL, revision: str = RERANK_REVISION):
        from sentence_transformers import CrossEncoder  # 导入 torch 要几秒，用到时再导

        # 小节最长不到 400 字，查询 + 小节在 512 token 以内，不会被截断
        self._model = CrossEncoder(model, revision=revision, max_length=512)

    def score(self, query: str, passages: Sequence[str]) -> list[float]:
        return self._model.predict([(query, p) for p in passages], batch_size=16).tolist()


def rerank(
    reranker: Reranker, query: str, hits: Sequence[Hit], passages: dict[str, str]
) -> list[Hit]:
    """按 reranker 分数重排候选，分数相同按原名次。"""
    scores = reranker.score(query, [passages[h.id] for h in hits])
    order = sorted(range(len(hits)), key=lambda i: (-scores[i], i))
    return [Hit(hits[i].id, float(scores[i])) for i in order]
