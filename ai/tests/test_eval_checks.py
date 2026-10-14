import importlib.util
import sys
from pathlib import Path

import yaml

EVAL_DIR = Path(__file__).parents[1] / "eval"
sys.path.insert(0, str(EVAL_DIR))  # run_eval 会导入同目录的 citations
_spec = importlib.util.spec_from_file_location("run_eval", EVAL_DIR / "run_eval.py")
run_eval = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(run_eval)


def failed(case, answer, tools=()):
    return [c["check"] for c in run_eval.check_case(case, answer, list(tools)) if not c["ok"]]


def test_cite_matches_whole_numbers_only():
    case = {"cite": [612]}
    assert failed(case, "依据 [record_id=612]") == []
    assert failed(case, "record_id=514/531/612/613") == []
    assert failed(case, "record_id=6120") == ["cite 612"]


def test_include_alternatives_exclude_and_tools():
    case = {
        "include": ["zhangwei", ["没有记录原因", "note 为空"]],
        "exclude": ["支付清算"],
        "tools": ["query_host_changes"],
        "max_tools": 2,
    }
    answer = "zhangwei 操作，NOTE 为空，业务 支付清结算"
    assert failed(case, answer, ["get_host", "query_host_changes"]) == []
    assert failed(case, "业务 支付清算", ["a", "b", "c"]) == [
        "include zhangwei",
        "include 没有记录原因|note 为空",
        "exclude 支付清算",
        "tool query_host_changes",
        "max_tools 2",
    ]


def test_include_regex_option():
    case = {"include": [["re:(没有|未)(记录|写明?|说明).{0,4}原因", "note 为空"]]}
    assert failed(case, "审计中未记录操作原因") == []
    assert failed(case, "没有写明原因") == []
    assert failed(case, "原因不明") != []


def test_min_tools_and_max_chars():
    case = {"min_tools": 1, "max_chars": 10}
    assert failed(case, "短回答", ["get_host"]) == []
    assert failed(case, "这是一个超过十个字的回答，太长了", []) == ["min_tools 1", "max_chars 10"]
    assert failed(case, "短回答 [record_id=623][doc=审计记录说明#时间和时区]", ["get_host"]) == []


def test_score_turns_checks_each_turn_and_cites_earlier_tool_outputs():
    case = {
        "turns": [
            {"question": "q1", "cite": [612]},
            {"question": "q2", "include": ["zhangwei"], "max_tools": 0},
        ]
    }
    first = {"name": "query_host_changes", "output": '{"record_id": 612}'}
    result = {
        "turns": [
            {"turn": 1, "answer": "[record_id=612]", "tool_calls": [first]},
            {"turn": 2, "answer": "zhangwei [record_id=612]", "tool_calls": []},
        ]
    }
    run_eval.score_turns(case, result)
    assert result["passed"]
    assert result["turns"][1]["citations"]["unsupported"] == []  # 第 1 轮查到的编号也算有依据

    result["turns"][1]["tool_calls"] = [{"name": "get_host", "output": ""}]
    run_eval.score_turns(case, result)
    assert not result["passed"]
    assert [c["check"] for c in result["turns"][1]["checks"] if not c["ok"]] == ["max_tools 0"]

    del result["turns"][1]  # 第 2 轮出错没跑完，整段不算通过
    run_eval.score_turns(case, result)
    assert not result["passed"]


def test_turn_rows_flattens_conversations():
    results = [{"id": "a", "passed": True}, {"id": "m", "turns": [{"turn": 1}, {"turn": 2}]}]
    assert [r["id"] for r in run_eval.turn_rows(results)] == ["a", "m#1", "m#2"]


CHECK_FIELDS = {
    "question",
    "reference",
    "cite",
    "include",
    "exclude",
    "tools",
    "max_tools",
    "min_tools",
    "max_chars",
}


def _assert_well_formed(case_id, case):
    assert run_eval.check_case(case, "", []), f"{case_id} 没有任何检查项"
    reference = case.get("reference")
    assert reference and all(isinstance(p, str) and p for p in reference), case_id
    assert case.get("question"), case_id


def test_cases_file_is_well_formed():
    cases = yaml.safe_load((EVAL_DIR / "cases.yaml").read_text(encoding="utf-8"))
    ids = [c["id"] for c in cases]
    assert len(ids) == len(set(ids)) >= 20
    for case in cases:
        if "turns" in case:
            assert set(case) <= {"id", "story", "suite", "turns"}, case["id"]
            assert case["suite"] == "multiturn" and len(case["turns"]) >= 2, case["id"]
            for i, turn in enumerate(case["turns"], 1):
                assert set(turn) <= CHECK_FIELDS, f"{case['id']}#{i}"
                _assert_well_formed(f"{case['id']}#{i}", turn)
        else:
            assert set(case) <= CHECK_FIELDS | {"id", "story", "suite", "passages"}, case["id"]
            _assert_well_formed(case["id"], case)
