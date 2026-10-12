from cmdb_ai.knowledge import Section
from cmdb_ai.knowledge_search import Hit, fetch_passages, keyword_search, rerank, rrf, vector_search
from cmdb_ai.knowledge_store import sync

SECTIONS = [
    Section("主机流转规则", "回收到资源池", "回收会删掉主机所有的业务归属，回到资源池默认目录。"),
    Section(
        "拓扑与空闲机池", "故障机模块", "故障机是空闲机池下的内置模块，移入故障机只是一次转移。"
    ),
    Section("主机内置字段", "硬件配置字段和单位", "memory_mb 的单位是 MB，disk_gb 的单位是 GB。"),
]


def test_rrf_sums_reciprocal_ranks():
    a = [Hit("x", 0.9), Hit("y", 0.8)]
    b = [Hit("y", 12.0), Hit("z", 3.0)]
    fused = rrf([a, b], k=60)
    assert [h.id for h in fused] == ["y", "x", "z"]  # y 两路都有：1/62 + 1/61
    assert fused[0].score == 1 / 62 + 1 / 61


def test_rrf_breaks_ties_by_id():
    assert [h.id for h in rrf([[Hit("b", 1)], [Hit("a", 1)]])] == ["a", "b"]


def test_keyword_search_matches_any_word(conn, embedder):
    connection, schema, table = conn
    sync(connection, schema, SECTIONS, embedder, table)

    # OR 查询：问题里的"为什么""哪里"正文里没有，也不影响命中
    hits = keyword_search(connection, schema, "主机为什么进了故障机？在哪里", 10, table)
    assert hits[0].id == "拓扑与空闲机池#故障机模块"

    # 英文标识符按下划线拆开，入库和查询同一口径；大小写不敏感
    hits = keyword_search(connection, schema, "Memory_MB 是什么单位", 10, table)
    assert hits[0].id == "主机内置字段#硬件配置字段和单位"


def test_keyword_search_escapes_tsquery_syntax(conn, embedder):
    connection, schema, table = conn
    sync(connection, schema, SECTIONS, embedder, table)
    for query in ["回收' | !资源池", "a:* & (b", "\\'", "？！", ""]:
        keyword_search(connection, schema, query, 10, table)  # 不报语法错误
    assert keyword_search(connection, schema, "？！", 10, table) == []


def test_vector_search_and_fetch_passages(conn, embedder):
    connection, schema, table = conn
    sync(connection, schema, SECTIONS, embedder, table)
    target = embedder.embed(
        ["主机内置字段 / 硬件配置字段和单位\nmemory_mb 的单位是 MB，disk_gb 的单位是 GB。"]
    )
    hits = vector_search(connection, schema, target[0], 2, table)
    assert hits[0].id == "主机内置字段#硬件配置字段和单位"
    assert abs(hits[0].score - 1) < 1e-5

    passages = fetch_passages(connection, schema, ["主机流转规则#回收到资源池", "不存在#x"], table)
    assert passages == {
        "主机流转规则#回收到资源池": "主机流转规则 / 回收到资源池\n"
        "回收会删掉主机所有的业务归属，回到资源池默认目录。"
    }


class FakeReranker:
    def __init__(self, scores: dict[str, float]):
        self.scores = scores
        self.seen: list[tuple[str, str]] = []

    def score(self, query, passages):
        self.seen += [(query, p) for p in passages]
        return [self.scores[p] for p in passages]


def test_rerank_orders_by_reranker_score_keeping_original_order_on_ties():
    hits = [Hit("a", 0.3), Hit("b", 0.2), Hit("c", 0.1)]
    reranker = FakeReranker({"A": 0.1, "B": 0.9, "C": 0.1})
    out = rerank(reranker, "q", hits, {"a": "A", "b": "B", "c": "C"})
    assert [h.id for h in out] == ["b", "a", "c"]
    assert out[0].score == 0.9
    assert reranker.seen == [("q", "A"), ("q", "B"), ("q", "C")]
