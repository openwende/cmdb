from datetime import date

from cmdb_ai.prompts import INVESTIGATOR_SYSTEM_PROMPT, with_current_date


def test_current_date_is_appended():
    assert with_current_date("P", date(2026, 9, 21)).endswith("当前日期：2026-09-21（北京时间）\n")


def test_prompt_does_not_leak_eval_answers():
    for leaked in ("612", "613", "支付清结算", "10.20.1.11"):
        assert leaked not in INVESTIGATOR_SYSTEM_PROMPT
