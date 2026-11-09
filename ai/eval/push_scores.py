"""把评测分数写回 Langfuse trace：uv run python eval/push_scores.py <label 或结果文件> [...]

不调用模型：规则检查和引用核对按当前 cases.yaml 重算，LLM 评分只从 judge.py 的缓存里取
（没评过的题跳过这两项，先跑 judge.py）。只处理带 trace_id 的结果（接入 Langfuse 之后跑的评测）。

每道题写 4 个分数：rule_pass（规则检查是否全过）、unsupported_citations（无依据的引用数）、
correctness、faithfulness（后两项附扣分理由）。score_id 由 trace_id + 分数名算出，
重复推送是覆盖而不是新增。
"""

import hashlib
import sys
from pathlib import Path
from typing import Any

import yaml
from citations import check_citations
from judge import load_cache, load_results, lookup
from run_eval import check_case

from cmdb_ai.config import get_settings

EVAL_DIR = Path(__file__).parent


def score_id(trace_id: str, name: str) -> str:
    return hashlib.sha256(f"{trace_id}:{name}".encode()).hexdigest()[:32]


def problems(verdict: dict[str, Any]) -> str:
    """扣分理由：非 covered / supported 的条目，一条一行。"""
    items = verdict.get("points") or verdict.get("claims") or []
    lines = []
    for it in items:
        if it["verdict"] in ("covered", "supported"):
            continue
        what = f"要点 {it['id']}" if "id" in it else it["claim"]
        lines.append(f"[{it['verdict']}] {what}：{it.get('reason', '')}")
    return "\n".join(lines)


def scores_for(case: dict[str, Any], r: dict[str, Any], cache) -> list[dict[str, Any]]:
    tools = [c["name"] for c in r["tool_calls"]]
    checks = check_case(case, r["answer"], tools)
    failed = [c["check"] for c in checks if not c["ok"]]
    out = [
        {
            "name": "rule_pass",
            "value": 0 if failed else 1,
            "data_type": "BOOLEAN",
            "comment": "\n".join(failed) or None,
        }
    ]
    cites = check_citations(r["answer"], r["tool_calls"])
    if cites is not None:
        out.append(
            {
                "name": "unsupported_citations",
                "value": len(cites["unsupported"]),
                "data_type": "NUMERIC",
                "comment": ", ".join(cites["unsupported"]) or None,
            }
        )
    for dim in ("correctness", "faithfulness"):
        s = lookup(cache, dim, case, r)
        if s is not None:
            out.append(
                {
                    "name": dim,
                    "value": round(s["score"], 4),
                    "data_type": "NUMERIC",
                    "comment": problems(s["verdict"]) or None,
                }
            )
    return out


def main() -> int:
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    settings = get_settings()
    if not (settings.langfuse_public_key and settings.langfuse_secret_key):
        sys.exit("没有配置 LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY")
    from langfuse import Langfuse

    client = Langfuse(
        public_key=settings.langfuse_public_key,
        secret_key=settings.langfuse_secret_key.get_secret_value(),
        base_url=settings.langfuse_base_url,
    )
    cases = {c["id"]: c for c in yaml.safe_load((EVAL_DIR / "cases.yaml").read_text("utf-8"))}
    cache = load_cache()
    pushed = traced = skipped = 0
    for label in sys.argv[1:]:
        for run in load_results(label, None):
            for r in run["results"]:
                if "answer" not in r or r["id"] not in cases:
                    continue
                if not r.get("trace_id"):
                    skipped += 1
                    continue
                traced += 1
                for s in scores_for(cases[r["id"]], r, cache):
                    client.create_score(
                        trace_id=r["trace_id"],
                        score_id=score_id(r["trace_id"], s["name"]),
                        metadata={"label": run.get("label"), "case_id": r["id"]},
                        **s,
                    )
                    pushed += 1
    client.flush()
    print(f"{traced} 条带 trace 的结果，写入 {pushed} 个分数；{skipped} 条没有 trace_id，跳过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
