import importlib.util
from pathlib import Path

import yaml

EVAL_DIR = Path(__file__).parents[1] / "eval"
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


def test_cases_file_is_well_formed():
    cases = yaml.safe_load((EVAL_DIR / "cases.yaml").read_text(encoding="utf-8"))
    ids = [c["id"] for c in cases]
    assert len(ids) == len(set(ids)) >= 20
    allowed = {"id", "story", "question", "cite", "include", "exclude", "tools", "max_tools"}
    for case in cases:
        assert set(case) <= allowed, case["id"]
        assert run_eval.check_case(case, "", []), f"{case['id']} 没有任何检查项"
