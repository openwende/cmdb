from cmdb_ai.knowledge import Section
from cmdb_ai.knowledge_store import (
    EMBED_DIM,
    content_hash,
    embedding_text,
    sync,
    to_vector_literal,
    tokenize,
)


def test_tokenize_keeps_domain_words():
    words = tokenize("故障机和待回收有什么区别？空闲机池和资源池").split()
    for word in ("故障机", "待回收", "空闲机池", "资源池"):
        assert word in words
    assert "机和待" not in words
    assert "？" not in words


def test_tokenize_lowercases_identifiers():
    assert "custom" in tokenize("Custom_Fields.备份").split()


def test_embedding_text_and_hash_include_title_and_model():
    s = Section("主机流转规则", "回收到资源池", "正文")
    assert embedding_text(s) == "主机流转规则 / 回收到资源池\n正文"
    assert content_hash(s, "m1") != content_hash(s, "m2")


def test_vector_literal():
    assert to_vector_literal([0.5, -1.0, 1e-8]) == "[0.5,-1,1e-08]"


def test_sync_only_reembeds_changed_sections(conn, embedder):
    connection, schema, table = conn
    a, b = Section("文档", "甲", "空闲机池"), Section("文档", "乙", "故障机")

    assert sync(connection, schema, [a, b], embedder, table) == {
        "sections": 2,
        "embedded": 2,
        "removed": 0,
    }
    b2 = Section("文档", "乙", "待回收")
    assert sync(connection, schema, [a, b2], embedder, table)["embedded"] == 1
    assert embedder.calls[-1] == [embedding_text(b2)]

    assert sync(connection, schema, [a], embedder, table)["removed"] == 1
    rows = connection.execute(
        f'SELECT id, "{schema}".vector_dims(embedding) FROM "{schema}"."{table}"'
    ).fetchall()
    assert rows == [("文档#甲", EMBED_DIM)]
    hits = connection.execute(
        f"""SELECT id FROM "{schema}"."{table}" WHERE tsv @@ to_tsquery('simple', '空闲机池')"""
    ).fetchall()
    assert hits == [("文档#甲",)]
