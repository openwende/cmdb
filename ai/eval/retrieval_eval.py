"""检索评测：uv run python eval/retrieval_eval.py [--mode vector] [--label 名称]

只测检索，不跑 Agent、不调用任何付费模型（向量化用本地 bge-m3）。
查询 = eval/retrieval_cases.yaml + cases.yaml 里带 passages 的题（用题目原文当查询）。

指标（对所有查询取平均，并按 style 分组）：
  Recall@k  标注的段落有多少比例出现在前 k 个结果里
  Hit@k     前 k 个结果里至少命中一个标注段落
  MRR       第一个命中的排名的倒数（前 10 名都没命中记 0）
结果写到 eval/results/retrieval-<时间>-<label>.json，含每个查询的前 10 名，方便看错在哪。
"""

import argparse
import json
import statistics
from datetime import datetime
from pathlib import Path
from typing import Any

import psycopg
import yaml

from cmdb_ai.config import get_settings
from cmdb_ai.knowledge_search import vector_search
from cmdb_ai.knowledge_store import BgeM3Embedder

EVAL_DIR = Path(__file__).parent
RESULTS_DIR = EVAL_DIR / "results"
KS = (1, 3, 5)
DEPTH = 10


def load_queries() -> list[dict[str, Any]]:
    queries = yaml.safe_load((EVAL_DIR / "retrieval_cases.yaml").read_text(encoding="utf-8"))
    for case in yaml.safe_load((EVAL_DIR / "cases.yaml").read_text(encoding="utf-8")):
        if "passages" in case:
            queries.append({"id": case["id"], "style": "e2e", "query": case["question"], **case})
    return queries


def score(ranked: list[str], gold: list[str]) -> dict[str, float]:
    out: dict[str, float] = {}
    for k in KS:
        top = set(ranked[:k])
        out[f"Recall@{k}"] = sum(p in top for p in gold) / len(gold)
        out[f"Hit@{k}"] = float(any(p in top for p in gold))
    first = next((i for i, h in enumerate(ranked[:DEPTH], 1) if h in gold), None)
    out["MRR"] = 1 / first if first else 0.0
    return out


def summarize(rows: list[dict[str, Any]]) -> dict[str, float]:
    names = rows[0]["metrics"].keys()
    return {n: statistics.mean(r["metrics"][n] for r in rows) for n in names}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--mode", default="vector", choices=["vector"])
    parser.add_argument("--label", default=None)
    args = parser.parse_args()

    settings = get_settings()
    queries = load_queries()
    embedder = BgeM3Embedder()
    vectors = embedder.embed([q["query"] for q in queries])

    rows = []
    with psycopg.connect(settings.database_url) as conn:
        for q, vec in zip(queries, vectors, strict=True):
            hits = vector_search(conn, settings.ai_db_schema, vec, DEPTH)
            ranked = [h.id for h in hits]
            rows.append(
                {
                    "id": q["id"],
                    "style": q["style"],
                    "query": q["query"],
                    "passages": q["passages"],
                    "ranked": ranked,
                    "metrics": score(ranked, q["passages"]),
                }
            )

    groups = {"全部": rows}
    for style in ("keyword", "paraphrase", "plain", "e2e"):
        groups[style] = [r for r in rows if r["style"] == style]
    summary = {name: summarize(rs) for name, rs in groups.items() if rs}

    cols = [*(f"Recall@{k}" for k in KS), *(f"Hit@{k}" for k in KS), "MRR"]
    print(f"模式 {args.mode}，查询 {len(rows)} 个\n")
    print("| 分组 | 查询数 | " + " | ".join(cols) + " |")
    print("|---|---|" + "---|" * len(cols))
    for name, m in summary.items():
        n = len(groups[name])
        print(f"| {name} | {n} | " + " | ".join(f"{m[c]:.2f}" for c in cols) + " |")

    misses = [r for r in rows if r["metrics"]["Hit@5"] == 0]
    if misses:
        print(f"\n前 5 名都没命中的查询（{len(misses)} 个）：")
        for r in misses:
            print(f"  {r['id']}：{r['query']}")
            print(f"    应命中 {r['passages']}\n    实际前 3 {r['ranked'][:3]}")

    label = args.label or args.mode
    RESULTS_DIR.mkdir(exist_ok=True)
    out = RESULTS_DIR / f"retrieval-{datetime.now():%Y%m%d-%H%M%S}-{label}.json"
    out.write_text(
        json.dumps(
            {"label": label, "mode": args.mode, "summary": summary, "rows": rows},
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"\n结果已写入 {out.relative_to(EVAL_DIR.parent)}")


if __name__ == "__main__":
    main()
