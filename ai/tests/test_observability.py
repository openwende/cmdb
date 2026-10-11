import sys
from pathlib import Path

from pydantic import SecretStr

from cmdb_ai.cmdb import UserContext
from cmdb_ai.config import Settings
from cmdb_ai.observability import Tracing

sys.path.insert(0, str(Path(__file__).parents[1] / "eval"))

from push_scores import problems, score_id  # noqa: E402


def settings(**kw) -> Settings:
    return Settings(_env_file=None, deepseek_api_key=SecretStr("x"), **kw)


def test_tracing_is_off_without_keys():
    t = Tracing(settings(langfuse_public_key="pk-lf-x"))  # 只有 public key 也不启用
    assert not t.enabled
    assert t.handler() is None
    t.flush()
    t.shutdown()


def test_trace_metadata_never_carries_the_jwt():
    user = UserContext(user_id="u1", username="chenjing", jwt="eyJ.secret.token")
    meta = Tracing.metadata(user, "u1:conv-1", ["eval", "p2"])
    assert meta == {
        "langfuse_user_id": "chenjing",
        "langfuse_session_id": "u1:conv-1",
        "langfuse_tags": ["eval", "p2"],
    }
    assert "eyJ" not in repr(meta)


def test_score_id_is_stable_and_problems_list_only_misses():
    assert score_id("t1", "correctness") == score_id("t1", "correctness")
    assert score_id("t1", "correctness") != score_id("t1", "faithfulness")
    verdict = {
        "points": [
            {"id": 1, "verdict": "covered", "reason": ""},
            {"id": 2, "verdict": "contradicted", "reason": "时间写错"},
        ]
    }
    assert problems(verdict) == "[contradicted] 要点 2：时间写错"
    claims = {
        "claims": [{"claim": "CMDB 中没有工单", "verdict": "unsupported", "reason": "没查过"}]
    }
    assert problems(claims) == "[unsupported] CMDB 中没有工单：没查过"
