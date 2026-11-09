import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "eval"))

from citations import check_citations, cited_ids  # noqa: E402


def test_cited_ids_formats():
    answer = (
        "主机 pay-gw-01（host_id=43，8 核 / 32768 MB）[host_id=43]。"
        "两次转移 [record_id=612][record_id=613]，记录 [record_id=700、701, host_id=44]，"
        "批量 [record_id=800~802]，[record_id=900（10.20.1.11）、record_id=901（10.20.1.12）]，"
        "正文 record_id=950 也算；[record_id=960，2026-09-16 22:41 转移]"
    )
    assert cited_ids(answer) == {
        "record_id": {612, 613, 700, 701, 800, 802, 900, 901, 950, 960},
        "host_id": {43, 44},
    }


def test_check_citations_flags_ids_missing_from_tool_outputs():
    calls = [
        {"name": "get_host", "output": '{"host_id":43,"ip":"10.20.1.11"}'},
        {
            "name": "query_host_changes",
            "output": '{"changes":[{"record_id":612},{"record_id":613}]}',
        },
    ]
    answer = "[host_id=43] [record_id=612][record_id=613][record_id=999]"
    result = check_citations(answer, calls)
    assert result["cited"] == 4
    assert result["unsupported"] == ["record_id=999"]


def test_error_text_grounds_ids_and_old_results_are_skipped():
    calls = [{"name": "get_host", "output": '主机 not found（host_id=0 ip="10.99.99.99"）'}]
    assert check_citations("返回 not found（host_id=0）", calls)["unsupported"] == []
    assert check_citations("[record_id=612]", [{"name": "get_host"}]) is None  # 旧结果没有工具返回


def test_doc_citations_must_come_from_search_knowledge():
    calls = [
        {
            "name": "search_knowledge",
            "output": "[doc=主机流转规则#回收到资源池]\n回收会删掉……\n\n"
            "[doc=拓扑与空闲机池#删除和移动集群、模块]\n……",
        },
        {"name": "get_host", "output": '{"host_id":43}'},
    ]
    answer = (
        "回收会删掉所有归属 [doc=主机流转规则#回收到资源池]，"
        "[doc=拓扑与空闲机池#删除和移动集群、模块、host_id=43]，"
        "[doc=主机流转规则#回收到资源池；doc=角色与权限#系统角色]"
    )
    result = check_citations(answer, calls)
    assert result == {
        "cited": 1,
        "unsupported": [],
        "cited_docs": 3,
        "unsupported_docs": ["角色与权限#系统角色"],
    }
