"""知识库入库：小节 → jieba 分词 + bge-m3 向量 → ai.knowledge_chunks。

    uv run python -m cmdb_ai.knowledge_store      # 同步 knowledge/*.md 到数据库

向量模型按 KNOWLEDGE_MODEL_PROVIDER 选本地或托管 API；换了来源再运行一次，全部小节重新向量化。

每个 `##` 小节一行（小节平均 200 字左右，不再往下切）。同步是幂等的：正文和向量模型都没变的
小节不重新向量化，只刷新分词（词表改了也能生效）；文档里删掉的小节从表里删除。

关键词检索不装中文分词扩展（zhparser / pg_jieba）：入库和查询都先用 jieba 切好词、空格连接，
再交给 `to_tsvector('simple', …)`。simple 解析器只按空白和标点拆、转小写，所以两边口径一致；
英文标识符（custom_fields、memory_mb）会被它按下划线拆开，查询端同样拆开，照样能匹配。

只有 66 行，向量检索直接精确扫描，不建 HNSW / IVFFlat 索引：近似索引在几万行以上才有意义，
这里建了也不会被用上，还会让召回从"精确"变成"近似"。
"""

import hashlib
import logging
import re
from collections.abc import Sequence
from functools import cache
from typing import Protocol

import jieba
import psycopg
from psycopg import sql

from cmdb_ai.config import get_settings
from cmdb_ai.knowledge import Section, load_sections

EMBED_MODEL = "BAAI/bge-m3"
EMBED_REVISION = "5617a9f61b028005a4858fdac845db406aefb181"  # 固定版本，入库和查询用同一份权重
EMBED_DIM = 1024
TABLE = "knowledge_chunks"

# jieba 默认词典会把"空闲机池"切成"空闲 / 机池"、"故障机和待回收"切成"故障 / 机和待 / 回收"。
# 补上领域词；cut_for_search 仍会额外输出词里的子词（如"空闲机池"→"空闲""空闲机"），不影响召回。
DOMAIN_WORDS = [
    "空闲机池", "空闲机", "故障机", "待回收", "资源池", "资源池目录", "默认目录", "主机池",
    "业务模块", "服务模块", "业务拓扑", "拓扑树", "固资编号", "责任团队", "故障原因", "自定义字段",
    "内置字段", "管控区域", "云厂商", "动态分组", "资源类型", "主线类型", "业务人员", "只读用户",
    "编辑者", "管理员", "调查助手", "归属变更", "配置变更", "审计记录", "操作人", "操作原因",
    "导入资源池", "分配到业务", "回收到资源池", "归还主机池", "转入待回收", "维护窗口", "重点保障",
    "待升级", "试运行", "预发", "已销毁", "软删除", "主机数", "生命周期", "停运", "归档",
]  # fmt: skip


_WORD = re.compile(r"\w")  # 只含标点、空白的切分结果不要


class Embedder(Protocol):
    name: str

    def embed(self, texts: Sequence[str]) -> list[list[float]]: ...


def import_sentence_transformers():
    """本地模型才用到 sentence-transformers（连带 torch，导入要几秒），用到时再导。

    它在可选依赖组 local-models 里，用托管 API 的环境（包括默认构建的镜像）没装。
    """
    try:
        import sentence_transformers
    except ImportError as e:
        raise ImportError(
            "KNOWLEDGE_MODEL_PROVIDER=local 需要本地模型依赖：uv sync --extra local-models"
            "（Docker 镜像构建时加 --build-arg INSTALL_LOCAL_MODELS=true）；"
            "或改用托管 API：KNOWLEDGE_MODEL_PROVIDER=siliconflow"
        ) from e
    return sentence_transformers


class BgeM3Embedder:
    """本地 bge-m3 稠密向量（1024 维，已归一化，用余弦距离）。bge-m3 的查询不需要加指令前缀。"""

    name = EMBED_MODEL

    def __init__(self, model: str = EMBED_MODEL, revision: str = EMBED_REVISION):
        st = import_sentence_transformers()
        self._model = st.SentenceTransformer(model, revision=revision)

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        vectors = self._model.encode(list(texts), normalize_embeddings=True, batch_size=16)
        return vectors.tolist()


@cache
def _init_jieba() -> None:
    jieba.setLogLevel(logging.WARNING)
    for word in DOMAIN_WORDS:
        jieba.add_word(word)


def tokenize(text: str) -> str:
    """jieba 搜索模式分词，空格连接，交给 to_tsvector('simple', …)。"""
    _init_jieba()
    return " ".join(w for w in jieba.cut_for_search(text.lower()) if _WORD.search(w))


def embedding_text(section: Section) -> str:
    """向量化的文本带上文档名和小节标题：正文里常省略主语，标题补上"在说什么"。"""
    return f"{section.doc} / {section.title}\n{section.text}"


def content_hash(section: Section, model: str) -> str:
    return hashlib.sha256(f"{model}\n{embedding_text(section)}".encode()).hexdigest()


def to_vector_literal(vector: Sequence[float]) -> str:
    return "[" + ",".join(f"{x:.7g}" for x in vector) + "]"


def setup(conn: psycopg.Connection, schema: str, table: str = TABLE) -> None:
    """建扩展和表（幂等）。扩展和表都只放在 AI 服务自己的 schema 里。"""
    ident = sql.Identifier(schema)
    name = sql.Identifier(table)
    conn.execute(sql.SQL("CREATE SCHEMA IF NOT EXISTS {}").format(ident))
    conn.execute(sql.SQL("CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA {}").format(ident))
    conn.execute(
        sql.SQL(
            """
            CREATE TABLE IF NOT EXISTS {}.{} (
                id           text PRIMARY KEY,           -- "<文档 title>#<小节标题>"
                doc          text NOT NULL,
                title        text NOT NULL,
                content      text NOT NULL,
                tokens       text NOT NULL,              -- jieba 分词结果，空格连接
                tsv          tsvector GENERATED ALWAYS AS (to_tsvector('simple', tokens)) STORED,
                embedding    {}.vector({}) NOT NULL,
                embed_model  text NOT NULL,
                content_hash text NOT NULL,              -- 向量化输入 + 模型的哈希，变了才重算向量
                updated_at   timestamptz NOT NULL DEFAULT now()
            )
            """
        ).format(ident, name, ident, sql.Literal(EMBED_DIM))
    )
    conn.execute(
        sql.SQL("CREATE INDEX IF NOT EXISTS {} ON {}.{} USING gin (tsv)").format(
            sql.Identifier(f"{table}_tsv_idx"), ident, name
        )
    )


def sync(
    conn: psycopg.Connection,
    schema: str,
    sections: Sequence[Section],
    embedder: Embedder,
    table_name: str = TABLE,
) -> dict[str, int]:
    """把小节同步到表里，返回各类行数。调用方负责提交事务。"""
    table = sql.SQL("{}.{}").format(sql.Identifier(schema), sql.Identifier(table_name))
    existing = dict(
        conn.execute(sql.SQL("SELECT id, content_hash FROM {}").format(table)).fetchall()
    )

    hashes = {s.id: content_hash(s, embedder.name) for s in sections}
    stale = [s for s in sections if existing.get(s.id) != hashes[s.id]]
    vectors = dict(
        zip([s.id for s in stale], embedder.embed([embedding_text(s) for s in stale]), strict=True)
    )

    for s in sections:
        tokens = tokenize(f"{s.doc} {s.title} {s.text}")
        if s.id in vectors:
            conn.execute(
                sql.SQL(
                    """
                    INSERT INTO {} (id, doc, title, content, tokens,
                                    embedding, embed_model, content_hash)
                    VALUES (%s, %s, %s, %s, %s, %s::{}.vector, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        doc = EXCLUDED.doc, title = EXCLUDED.title, content = EXCLUDED.content,
                        tokens = EXCLUDED.tokens, embedding = EXCLUDED.embedding,
                        embed_model = EXCLUDED.embed_model, content_hash = EXCLUDED.content_hash,
                        updated_at = now()
                    """
                ).format(table, sql.Identifier(schema)),
                (s.id, s.doc, s.title, s.text, tokens, to_vector_literal(vectors[s.id]),
                 embedder.name, hashes[s.id]),
            )  # fmt: skip
        else:
            conn.execute(
                sql.SQL("UPDATE {} SET tokens = %s WHERE id = %s AND tokens <> %s").format(table),
                (tokens, s.id, tokens),
            )

    removed = [i for i in existing if i not in hashes]
    if removed:
        conn.execute(sql.SQL("DELETE FROM {} WHERE id = ANY(%s)").format(table), (removed,))
    return {"sections": len(sections), "embedded": len(stale), "removed": len(removed)}


def indexed_models(conn: psycopg.Connection, schema: str, table: str = TABLE) -> set[str]:
    """表里的向量出自哪些模型（`Embedder.name`）。"""
    rows = conn.execute(
        sql.SQL("SELECT DISTINCT embed_model FROM {}.{}").format(
            sql.Identifier(schema), sql.Identifier(table)
        )
    ).fetchall()
    return {r[0] for r in rows}


def main() -> None:
    from cmdb_ai.knowledge_models import make_embedder  # 它反过来导入本模块

    settings = get_settings()
    sections = load_sections()
    embedder = make_embedder(settings)
    with psycopg.connect(settings.database_url) as conn:
        setup(conn, settings.ai_db_schema)
        stats = sync(conn, settings.ai_db_schema, sections, embedder)
    print(
        f"向量模型 {embedder.name}：小节 {stats['sections']}，"
        f"重新向量化 {stats['embedded']}，删除 {stats['removed']}"
    )


if __name__ == "__main__":
    main()
