import pytest
from test_knowledge_search import SECTIONS, FakeReranker

from cmdb_ai.config import get_settings
from cmdb_ai.knowledge_store import embedding_text, sync
from cmdb_ai.knowledge_tool import (
    DISABLED_RESULT,
    TOOL_NAME,
    KnowledgeSearcher,
    Passage,
    build_knowledge_tool,
    format_passages,
)


def test_format_passages_puts_citation_marker_on_its_own_line():
    text = format_passages(
        [
            Passage("主机流转规则#回收到资源池", "主机流转规则 / 回收到资源池\n回收会删掉……", 0.9),
            Passage("资源池与目录#默认目录", "资源池与目录 / 默认目录\n第一行\n第二行", 0.5),
        ]
    )
    assert text == (
        "[doc=主机流转规则#回收到资源池]\n回收会删掉……\n\n[doc=资源池与目录#默认目录]\n第一行\n第二行"
    )
    assert format_passages([]) == "知识库里没有找到相关内容。"


def _searcher(conn, embedder, mode, reranker=None, top_k=2):
    connection, schema, table = conn
    sync(connection, schema, SECTIONS, embedder, table)
    connection.commit()  # 检索用自己的连接，要看得到这些行
    settings = get_settings().model_copy(update={"knowledge_search_mode": mode})
    searcher = KnowledgeSearcher(settings, top_k=top_k, table=table)
    searcher._embedder, searcher._reranker = embedder, reranker  # 不加载真模型
    return searcher


@pytest.mark.parametrize("mode", ["vector", "hybrid"])
def test_search_without_reranker(conn, embedder, mode):
    searcher = _searcher(conn, embedder, mode)
    # 假向量模型：查询文本和小节的向量化文本完全相同时余弦相似度为 1，排第一
    query = embedding_text(SECTIONS[2])
    passages = searcher.search(query)
    assert len(passages) == 2
    assert passages[0].id == "主机内置字段#硬件配置字段和单位"
    assert passages[0].text == query


async def test_rerank_mode_uses_reranker_order_and_tool_wraps_it(conn, embedder):
    texts = {embedding_text(s): score for s, score in zip(SECTIONS, [0.1, 0.9, 0.5], strict=True)}
    searcher = _searcher(conn, embedder, "rerank", FakeReranker(texts))
    tool = build_knowledge_tool(searcher)
    assert tool.name == TOOL_NAME
    assert list(tool.args) == ["query"]

    out = await tool.ainvoke({"query": "故障机"})
    assert out.startswith("[doc=拓扑与空闲机池#故障机模块]\n故障机是空闲机池下的内置模块")
    assert "[doc=主机内置字段#硬件配置字段和单位]" in out
    assert "主机流转规则" not in out  # top_k=2，分数最低的被截掉


async def test_off_mode_loads_no_model_and_tool_says_disabled():
    settings = get_settings().model_copy(update={"knowledge_search_mode": "off"})
    searcher = KnowledgeSearcher(settings)
    assert not searcher.enabled
    tool = build_knowledge_tool(searcher)
    assert tool.name == TOOL_NAME  # 仍然注册，提示词不用分两版
    assert await tool.ainvoke({"query": "故障机"}) == DISABLED_RESULT
    assert searcher._embedder is None and searcher._reranker is None
