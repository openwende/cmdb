"""知识库检索。C5 在这里加关键词检索、RRF 融合和 rerank；目前只有向量检索。"""

from collections.abc import Sequence
from dataclasses import dataclass

import psycopg
from psycopg import sql

from cmdb_ai.knowledge_store import TABLE, to_vector_literal


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
