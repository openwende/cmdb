"""用 Ragas 的 faithfulness 给标注集打分，和自建评分模型放在同一把尺子上比较（A5）。

uv run --group eval python eval/ragas_faithfulness.py [--only L01,L02] [--concurrency 4]

- 输入和 judge.py 的忠实度维度完全相同：问题、回答、本题去重后的工具返回；模型同样是 deepseek-v4-pro
- Ragas 0.4 的 collections 指标通过 instructor 取结构化输出，OpenAI 兼容接口走 JSON 模式，
  DeepSeek 思考模式可以用；但默认 max_tokens=1024 会被思考过程吃掉，这里调大
- 每条两次调用：拆陈述、逐条 NLI 判定（0/1）。Ragas 只有"支持 / 不支持"两档，分不出写错和没依据
- 调用结果用 Ragas 自带的 DiskCacheBackend 缓存在 eval/results/ragas-cache/，重跑不重复花钱
- 结果写 eval/results/ragas-labeling-set.json；--report 只读结果，算检出率和 kappa
- --variant adapted：框架、打分方式、0/1 两档都不变，只在 Ragas 的两段提示词后面追加
  和 judge.py 相同的通用规则（建议 / 待确认不算陈述；没有 note 字段 = note 为空；允许常见近似），
  用来区分差距来自框架还是来自领域规则。结果写 ragas-adapted-labeling-set.json
"""

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path
from typing import Any

EVAL_DIR = Path(__file__).parent
sys.path.insert(0, str(EVAL_DIR))

from judge import JUDGE_MODEL, tool_evidence  # noqa: E402

LABELING = EVAL_DIR / "labeling"
OUT_PATHS = {
    "vanilla": EVAL_DIR / "results" / "ragas-labeling-set.json",
    "adapted": EVAL_DIR / "results" / "ragas-adapted-labeling-set.json",
}

# 与 judge.py 忠实度提示词里的规则一致，不含任何具体题目的内容
ADAPTED_STATEMENT_RULES = """
Only extract factual statements about hosts, businesses, modules, audit records, times, people,
counts and configuration, including any cause, reason or intention that the answer states as a
fact. Do not extract recommendations, questions that still need to be
verified, suggestions to contact someone, or anything the answer explicitly marks as a guess
or as needing confirmation. If the same fact appears several times, extract it once."""
ADAPTED_NLI_RULES = """
Conventions: the tool outputs omit empty fields, so an audit record without a `note` field means
its note is empty, and a statement that the note is empty / no reason was recorded is supported.
Judge the scope of a statement from its context (e.g. "the last record" when talking about one
host means that host's records). Time differences and counts may use common approximations
("about", "over", or counting from either timestamp); only clear miscalculations get 0.
Statements about motives, causes or intentions that the context does not record, or about things
the tool outputs never queried (e.g. "the CMDB has no ticket for this"), get 0."""
CACHE_DIR = EVAL_DIR / "results" / "ragas-cache"
DEEPSEEK_BASE_URL = "https://api.deepseek.com"
MAX_TOKENS = 16384  # 包含思考过程；1024（Ragas 默认）会截断


def build_metric(variant: str):
    from openai import AsyncOpenAI
    from ragas.cache import DiskCacheBackend
    from ragas.llms import llm_factory
    from ragas.metrics.collections import Faithfulness

    from cmdb_ai.config import get_settings

    settings = get_settings()
    client = AsyncOpenAI(
        api_key=settings.deepseek_api_key.get_secret_value(), base_url=DEEPSEEK_BASE_URL
    )
    llm = llm_factory(
        JUDGE_MODEL,
        client=client,
        cache=DiskCacheBackend(cache_dir=str(CACHE_DIR)),
        max_tokens=MAX_TOKENS,
    )
    metric = Faithfulness(llm=llm)
    if variant == "adapted":
        metric.statement_generator_prompt.instruction += ADAPTED_STATEMENT_RULES
        metric.nli_statement_prompt.instruction += ADAPTED_NLI_RULES
    return metric


async def score_item(metric, item: dict[str, Any]) -> dict[str, Any]:
    """拆开调用 Ragas 的两步（_create_statements / _create_verdicts，与 ascore 内部一致），
    为了把每条陈述的判定留下来做分歧分析；分数算法与 Faithfulness.ascore 相同。"""
    contexts = tool_evidence(item["tool_calls"]) or ["（本轮没有调用工具）"]
    statements = await metric._create_statements(item["question"], item["answer"])
    if not statements:
        return {"item": item["item"], "score": None, "statements": []}
    verdicts = await metric._create_verdicts(statements, "\n".join(contexts))
    judged = [
        {"statement": v.statement, "verdict": v.verdict, "reason": v.reason}
        for v in verdicts.statements
    ]
    supported = sum(1 for v in judged if v["verdict"] == 1)
    return {"item": item["item"], "score": supported / len(judged), "statements": judged}


async def run(only: set[str] | None, concurrency: int, variant: str) -> None:
    out_path = OUT_PATHS[variant]
    items = json.loads((LABELING / "set.json").read_text("utf-8"))
    if only:
        items = [it for it in items if it["item"] in only]
    done = {}
    if out_path.exists():
        done = {r["item"]: r for r in json.loads(out_path.read_text("utf-8"))["results"]}
    metric = build_metric(variant)
    semaphore = asyncio.Semaphore(concurrency)
    started = time.monotonic()

    async def one(item):
        async with semaphore:
            try:
                result = await score_item(metric, item)
            except Exception as exc:  # 单条失败不影响其他条，记下来
                result = {"item": item["item"], "error": f"{type(exc).__name__}: {exc}"[:500]}
        print("." if "error" not in result else "x", end="", flush=True)
        return result

    results = await asyncio.gather(*(one(it) for it in items))
    for r in results:
        done[r["item"]] = r
    out_path.write_text(
        json.dumps(
            {
                "model": JUDGE_MODEL,
                "max_tokens": MAX_TOKENS,
                "results": sorted(done.values(), key=lambda r: r["item"]),
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    errors = [r for r in results if "error" in r]
    print(
        f"\n{len(results)} 条，失败 {len(errors)} 条，"
        f"{time.monotonic() - started:.0f} 秒，写入 {out_path.name}"
    )
    for r in errors[:3]:
        print(f"  ✗ {r['item']}: {r['error']}")


def report(variant: str) -> None:
    from labeling.agreement import judge_labels, kappa

    ragas = {
        r["item"]: r
        for r in json.loads(OUT_PATHS[variant].read_text("utf-8"))["results"]
        if r.get("score") is not None
    }
    key = json.loads((LABELING / "key.json").read_text("utf-8"))
    flagged = {i: r["score"] < 1 for i, r in ragas.items()}
    perturbed = [i for i, k in key.items() if k["change"] and i in ragas]
    caught = [i for i in perturbed if flagged[i]]
    print(
        f"已评 {len(ragas)} 条；平均分 {sum(r['score'] for r in ragas.values()) / len(ragas):.3f}"
    )
    print(
        f"改坏的回答：{len(caught)}/{len(perturbed)} 判出"
        + (
            f"，漏掉 {', '.join(sorted(set(perturbed) - set(caught)))}"
            if len(caught) < len(perturbed)
            else ""
        )
    )
    originals = [i for i, k in key.items() if not k["change"] and i in ragas]
    print(f"原样回答：{sum(flagged[i] for i in originals)}/{len(originals)} 条被判为有不支持的陈述")

    sources = {"自建评分模型": {i: v["faithful"] == "no" for i, v in judge_labels().items()}}
    for name, path in (
        ("盲标子代理", "labels-claude.json"),
        ("裁定后标准答案", "labels-final.json"),
    ):
        labels = json.loads((LABELING / path).read_text("utf-8"))["labels"]
        sources[name] = {lb["item"]: lb["faithful"] == "no" for lb in labels}
    print("\n| 对照 | 条数 | 一致率 | kappa | Ragas 判有问题 / 对方判有问题 |")
    print("|---|---|---|---|---|")
    for name, other in sources.items():
        common = sorted(i for i in ragas if i in other)
        a, b = [flagged[i] for i in common], [other[i] for i in common]
        agree = sum(x == y for x, y in zip(a, b, strict=True)) / len(common)
        k = kappa(a, b)
        print(
            f"| Ragas vs {name} | {len(common)} | {agree:.0%} | "
            f"{'—' if k is None else f'{k:.2f}'} | {sum(a)} / {sum(b)} |"
        )
        diff = [i for i in common if flagged[i] != other[i]]
        if diff:
            print(f"|  分歧 | {', '.join(diff)} | | | |")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", help="只评这些条目，逗号分隔，如 L01,L02")
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--report", action="store_true", help="只读已有结果出报告，不调用模型")
    parser.add_argument("--variant", choices=sorted(OUT_PATHS), default="vanilla")
    args = parser.parse_args()
    if args.report:
        report(args.variant)
        return
    only = set(args.only.split(",")) if args.only else None
    asyncio.run(run(only, args.concurrency, args.variant))


if __name__ == "__main__":
    main()
