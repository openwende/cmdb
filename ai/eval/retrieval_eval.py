"""检索评测：uv run python eval/retrieval_eval.py [--mode 模式] [--label 名称]

只测检索，不跑 Agent、不调用任何付费模型（向量化、rerank 都用本地模型）。
查询 = eval/retrieval_cases.yaml + cases.yaml 里带 passages 的题（用题目原文当查询）。

模式：
  vector         只用向量检索
  keyword        只用关键词检索（jieba 分词 → OR tsquery → ts_rank）
  hybrid         两路各取前 20，RRF 融合
  rerank         hybrid 的前 20 用 bge-reranker-v2-m3 重排
  vector-rerank  向量前 20 直接重排（看关键词那一路在 rerank 之后还有没有用）
  all            依次跑上面全部，最后打印对比表；--label 作为前缀（<label>-<mode>）

指标（对所有查询取平均，并按 style 分组）：
  Recall@k  标注的段落有多少比例出现在前 k 个结果里
  Hit@k     前 k 个结果里至少命中一个标注段落
  MRR       第一个命中的排名的倒数（前 10 名都没命中记 0）
结果写到 eval/results/retrieval-<时间>-<label>.json，含每个查询的前 10 名，方便看错在哪。
检索是确定性的，同一配置跑多次结果相同，不需要跑 3 轮。
"""

import argparse
import json
import statistics
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import psycopg
import yaml

from cmdb_ai.config import get_settings
from cmdb_ai.knowledge_search import (
    CANDIDATES,
    BgeReranker,
    Hit,
    fetch_passages,
    keyword_search,
    rerank,
    rrf,
    vector_search,
)
from cmdb_ai.knowledge_store import BgeM3Embedder

EVAL_DIR = Path(__file__).parent
RESULTS_DIR = EVAL_DIR / "results"
KS = (1, 3, 5)
DEPTH = 10
MODES = ["vector", "keyword", "hybrid", "rerank", "vector-rerank"]
STYLES = ("keyword", "paraphrase", "plain", "e2e")
COLS = [*(f"Recall@{k}" for k in KS), *(f"Hit@{k}" for k in KS), "MRR"]


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


class Retriever:
    """按模式检索；向量模型、reranker 只加载一次，查询向量预先算好。"""

    def __init__(self, conn: psycopg.Connection, schema: str, queries: list[dict[str, Any]]):
        self.conn, self.schema = conn, schema
        texts = [q["query"] for q in queries]
        self.vectors = dict(zip(texts, BgeM3Embedder().embed(texts), strict=True))
        self._reranker: BgeReranker | None = None

    @property
    def reranker(self) -> BgeReranker:
        if self._reranker is None:
            self._reranker = BgeReranker()
        return self._reranker

    def _rerank(self, query: str, hits: list[Hit]) -> list[Hit]:
        passages = fetch_passages(self.conn, self.schema, [h.id for h in hits])
        return rerank(self.reranker, query, hits, passages)

    def search(self, mode: str, query: str) -> list[Hit]:
        def vec(k: int) -> list[Hit]:
            return vector_search(self.conn, self.schema, self.vectors[query], k)

        def kw(k: int) -> list[Hit]:
            return keyword_search(self.conn, self.schema, query, k)

        match mode:
            case "vector":
                return vec(DEPTH)
            case "keyword":
                return kw(DEPTH)
            case "hybrid":
                return rrf([vec(CANDIDATES), kw(CANDIDATES)])[:DEPTH]
            case "rerank":
                return self._rerank(query, rrf([vec(CANDIDATES), kw(CANDIDATES)])[:CANDIDATES])
            case "vector-rerank":
                return self._rerank(query, vec(CANDIDATES))
        raise ValueError(mode)


def run_mode(
    retriever: Retriever, queries: list[dict[str, Any]], mode: str, label: str
) -> dict[str, Any]:
    start = time.perf_counter()
    rows = []
    for q in queries:
        ranked = [h.id for h in retriever.search(mode, q["query"])][:DEPTH]
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
    elapsed = time.perf_counter() - start

    groups = {"全部": rows} | {s: [r for r in rows if r["style"] == s] for s in STYLES}
    summary = {name: summarize(rs) for name, rs in groups.items() if rs}

    print(f"## 模式 {mode}，查询 {len(rows)} 个，检索耗时 {elapsed:.1f} 秒\n")
    print("| 分组 | 查询数 | " + " | ".join(COLS) + " |")
    print("|---|---|" + "---|" * len(COLS))
    for name, m in summary.items():
        n = len(groups[name])
        print(f"| {name} | {n} | " + " | ".join(f"{m[c]:.2f}" for c in COLS) + " |")

    misses = [r for r in rows if r["metrics"]["Hit@5"] == 0]
    if misses:
        print(f"\n前 5 名都没命中的查询（{len(misses)} 个）：")
        for r in misses:
            print(f"  {r['id']}：{r['query']}")
            print(f"    应命中 {r['passages']}\n    实际前 3 {r['ranked'][:3]}")

    RESULTS_DIR.mkdir(exist_ok=True)
    out = RESULTS_DIR / f"retrieval-{datetime.now():%Y%m%d-%H%M%S}-{label}.json"
    out.write_text(
        json.dumps(
            {"label": label, "mode": mode, "seconds": elapsed, "summary": summary, "rows": rows},
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"\n结果已写入 {out.relative_to(EVAL_DIR.parent)}\n")
    return {"mode": mode, "seconds": elapsed, "summary": summary}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--mode", default="vector", choices=[*MODES, "all"])
    parser.add_argument("--label", default=None)
    args = parser.parse_args()

    settings = get_settings()
    queries = load_queries()
    modes = MODES if args.mode == "all" else [args.mode]

    with psycopg.connect(settings.database_url) as conn:
        retriever = Retriever(conn, settings.ai_db_schema, queries)
        results = []
        for mode in modes:
            if args.mode == "all":
                label = f"{args.label}-{mode}" if args.label else mode
            else:
                label = args.label or mode
            results.append(run_mode(retriever, queries, mode, label))

    if len(results) > 1:
        cols = ["Recall@1", "Recall@5", "Hit@1", "Hit@5", "MRR"]
        print("## 对比（全部查询；后几列是各分组的 MRR）\n")
        print(
            "| 模式 | " + " | ".join(cols) + " | " + " | ".join(f"MRR {s}" for s in STYLES) + " |"
        )
        print("|---|" + "---|" * (len(cols) + len(STYLES)))
        for r in results:
            s = r["summary"]
            print(
                f"| {r['mode']} | "
                + " | ".join(f"{s['全部'][c]:.2f}" for c in cols)
                + " | "
                + " | ".join(f"{s[st]['MRR']:.2f}" for st in STYLES)
                + " |"
            )


if __name__ == "__main__":
    main()
