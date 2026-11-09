"""LLM 评分：uv run python eval/judge.py <label> [--only id1,id2] [--runs 1] [--dims correctness]

规则检查只能判断"有没有提到"，这里用评分模型（deepseek-v4-pro，被测的是 deepseek-flash）判断
"说得对不对"，分两个维度、分开调用：

- correctness（正确性）：只给问题、参考要点（cases.yaml 的 reference）、回答；逐条要点判
  covered / partial / missing / contradicted，得分 = (covered + 0.5 × partial) / 要点数
- faithfulness（忠实度）：只给问题、本题的工具返回、回答；把回答拆成事实陈述，逐条判
  supported / unsupported / contradicted，得分 = supported / 陈述数。旧结果没有保存工具返回，跳过

省钱规则：同样的输入不重复打分。缓存键包含维度、评分提示词、评分模型及参数、
问题、回答、参考要点或工具返回；任何一项变了才重新调用。缓存在 eval/results/judge-cache.jsonl，
compare.py 直接读缓存出分，不调用模型。先用 --only 挑 5 题调提示词，稳定后再跑全量。
"""

import argparse
import asyncio
import hashlib
import json
import sys
import time
from pathlib import Path
from typing import Any, Literal

import yaml
from langchain_deepseek import ChatDeepSeek
from pydantic import BaseModel

EVAL_DIR = Path(__file__).parent
RESULTS_DIR = EVAL_DIR / "results"
CACHE_PATH = RESULTS_DIR / "judge-cache.jsonl"

JUDGE_MODEL = "deepseek-v4-pro"
JUDGE_PARAMS: dict[str, Any] = {}  # 思考模式下不支持 temperature 等采样参数，保持默认

CORRECTNESS_PROMPT = """你是 CMDB 调查助手的评测员，判断回答是否覆盖了参考要点。

输入包括用户问题、参考要点（编号列表，是标准答案）和助手的回答。逐条判断每个要点：
- covered：回答明确表达了这个要点。措辞、单位换算（如 32768 MB 与 32G）、时间写法不同都不影响；
  括号里的 record 编号只是出处，回答没写编号不扣分
- partial：只覆盖了一部分，而且覆盖到的部分没有说错（例如列举时漏了几项）
- missing：回答没有提到
- contradicted：要点里的任何细节说错了（时间、人员、数字、名称、变更方向），或者说了与要点
  相反、不一致的内容（例如把开启说成关闭、把不该算的算进去、要点说"没有记录原因"而回答给出了
  一个原因）。同时出现正确和矛盾的说法时，也判 contradicted

要点里的"只有…""不算…""不能…"是限制条件：回答多列了不该列的内容，判 contradicted。
只依据参考要点判断，不要用你自己的知识补充或纠正参考要点。

只输出 JSON：{"points": [{"id": 要点编号, "verdict": "covered|partial|missing|contradicted",
"reason": "一句话依据，covered 时可以为空字符串"}]}，每个要点一项，按编号顺序。"""

FAITHFULNESS_PROMPT = """你是 CMDB 调查助手的评测员，判断回答里的事实是否都有工具返回作为依据。

输入包括用户问题、助手本轮调用工具得到的全部返回（编号列表）和助手的回答。
第一步，把回答拆成事实陈述：关于主机、业务、模块、审计记录、时间、人员、数量、配置的具体说法；
同一事实在回答里重复出现只算一条；建议、待确认的问题、对用户的提醒不算事实陈述。
第二步，逐条判断：
- supported：工具返回里能直接找到，或者能从中直接推出（如两个时间相减、数条数）。
  计算类陈述要自己验算；时间差、数量允许常见口径的近似（如"约""多"，或按其中一个时间点算），
  明显算错才判 contradicted
- unsupported：工具返回里找不到依据，例如推测的动机、原因、意图，或没有查过的情况。
  如果回答明确把它标成推测或待核查（如"可能""需要确认"），不算事实陈述，不要列出
- contradicted：与工具返回不一致（数字、时间、人员、名称、先后顺序写错）

两条约定：工具返回会省略空值字段，审计记录里没有 note 字段就表示 note 为空，
"note 为空 / 审计没有记录原因"这类陈述算 supported。按上下文理解陈述的范围，
例如在说某台主机时提到的"最后一条记录"，指这台主机的记录。

只输出 JSON：{"claims": [{"claim": "陈述内容（简短）",
"verdict": "supported|unsupported|contradicted",
"reason": "一句话依据，supported 时可以为空字符串"}]}。"""


class PointVerdict(BaseModel):
    id: int
    verdict: Literal["covered", "partial", "missing", "contradicted"]
    reason: str = ""


class CorrectnessResult(BaseModel):
    points: list[PointVerdict]


class ClaimVerdict(BaseModel):
    claim: str
    verdict: Literal["supported", "unsupported", "contradicted"]
    reason: str = ""


class FaithfulnessResult(BaseModel):
    claims: list[ClaimVerdict]


DIMS = {
    "correctness": (CORRECTNESS_PROMPT, CorrectnessResult),
    "faithfulness": (FAITHFULNESS_PROMPT, FaithfulnessResult),
}


def tool_evidence(tool_calls: list[dict[str, Any]]) -> list[str] | None:
    """本题的工具返回，相同调用（工具名、参数、返回都相同）只保留一次；旧结果没有返回时为 None。"""
    if any("output" not in c for c in tool_calls):
        return None
    seen, items = set(), []
    for c in tool_calls:
        args = json.dumps(c["input"], ensure_ascii=False, sort_keys=True)
        key = (c["name"], args, c["output"])
        if key not in seen:
            seen.add(key)
            status = "" if c["status"] == "success" else f"（{c['status']}）"
            items.append(f"{c['name']}({args}){status} →\n{c['output']}")
    return items


def build_input(dim: str, case: dict[str, Any], result: dict[str, Any]) -> str | None:
    """只给这个维度需要的依据：正确性不看工具返回，忠实度不看参考要点。"""
    parts = [f"## 用户问题\n{case['question']}"]
    if dim == "correctness":
        points = "\n".join(f"{i}. {p}" for i, p in enumerate(case["reference"], 1))
        parts.append(f"## 参考要点\n{points}")
    else:
        evidence = tool_evidence(result["tool_calls"])
        if evidence is None:
            return None
        listed = "\n\n".join(f"[{i}] {e}" for i, e in enumerate(evidence, 1))
        listed = listed or "（本轮没有调用工具）"
        parts.append(f"## 工具返回\n{listed}")
    parts.append(f"## 助手的回答\n{result['answer']}")
    return "\n\n".join(parts)


def cache_key(dim: str, user_input: str) -> str:
    system_prompt = DIMS[dim][0]
    payload = json.dumps(
        [dim, JUDGE_MODEL, JUDGE_PARAMS, system_prompt, user_input], ensure_ascii=False
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def load_cache() -> dict[str, dict[str, Any]]:
    cache = {}
    if CACHE_PATH.exists():
        for line in CACHE_PATH.read_text(encoding="utf-8").splitlines():
            if line.strip():
                entry = json.loads(line)
                cache[entry["key"]] = entry
    return cache


def score(dim: str, verdict: dict[str, Any], n_reference: int | None = None) -> dict[str, Any]:
    if dim == "correctness":
        verdicts = [p["verdict"] for p in verdict["points"]]
        n = n_reference or len(verdicts)
        value = (verdicts.count("covered") + 0.5 * verdicts.count("partial")) / n if n else 0
        return {"score": value, "contradicted": verdicts.count("contradicted")}
    verdicts = [c["verdict"] for c in verdict["claims"]]
    n = len(verdicts)
    return {
        "score": verdicts.count("supported") / n if n else 1.0,
        "claims": n,
        "unsupported": verdicts.count("unsupported"),
        "contradicted": verdicts.count("contradicted"),
    }


def lookup(
    cache: dict[str, dict[str, Any]], dim: str, case: dict[str, Any], result: dict[str, Any]
) -> dict[str, Any] | None:
    """从缓存取分数；没评过或无法评（旧结果没有工具返回）时返回 None。compare.py 也用它。"""
    if "answer" not in result:
        return None
    user_input = build_input(dim, case, result)
    if user_input is None:
        return None
    entry = cache.get(cache_key(dim, user_input))
    if entry is None:
        return None
    return {**score(dim, entry["verdict"], len(case["reference"])), "verdict": entry["verdict"]}


async def judge_one(model, dim: str, user_input: str) -> tuple[dict[str, Any], dict[str, int]]:
    system_prompt, schema = DIMS[dim]
    structured = model.with_structured_output(schema, method="json_mode", include_raw=True)
    last_error = None
    for _ in range(2):  # JSON 偶尔不合法，重试一次
        out = await structured.ainvoke(
            [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_input}]
        )
        usage = out["raw"].usage_metadata or {}
        if out["parsed"] is not None:
            return out["parsed"].model_dump(), {
                "input_tokens": usage.get("input_tokens", 0),
                "output_tokens": usage.get("output_tokens", 0),
            }
        last_error = out.get("parsing_error")
    raise RuntimeError(f"评分输出无法解析：{last_error}")


def load_results(label: str, runs: int | None) -> list[dict[str, Any]]:
    """label 也可以直接是结果文件的路径（如 eval/labeling/results-set.json）。"""
    if Path(label).is_file():
        return [json.loads(Path(label).read_text(encoding="utf-8"))]
    files = [
        p
        for p in sorted(RESULTS_DIR.glob("*.json"))
        if json.loads(p.read_text(encoding="utf-8")).get("label") == label
    ]
    if not files:
        sys.exit(f"没有 label 为 {label!r} 的结果")
    files = files[:runs] if runs else files
    return [json.loads(p.read_text(encoding="utf-8")) for p in files]


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("label", help="结果的 label，或结果文件路径")
    parser.add_argument("--only", help="只评这些用例 ID，逗号分隔")
    parser.add_argument("--runs", type=int, help="只评该 label 的前 N 个结果文件")
    parser.add_argument("--dims", default="correctness,faithfulness")
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--dry-run", action="store_true", help="只估算要调用多少次，不调用")
    parser.add_argument("--show", action="store_true", help="打印每题的逐条判定")
    args = parser.parse_args()

    from cmdb_ai.config import get_settings  # 放在这里：--help / --dry-run 不需要 .env

    dims = args.dims.split(",")
    cases = {c["id"]: c for c in yaml.safe_load((EVAL_DIR / "cases.yaml").read_text("utf-8"))}
    wanted = set(args.only.split(",")) if args.only else None
    cache = load_cache()

    jobs, hits, skipped = {}, 0, 0
    targets = []
    for run in load_results(args.label, args.runs):
        for r in run["results"]:
            if r["id"] not in cases or (wanted and r["id"] not in wanted) or "answer" not in r:
                continue
            for dim in dims:
                user_input = build_input(dim, cases[r["id"]], r)
                if user_input is None:
                    skipped += 1
                    continue
                key = cache_key(dim, user_input)
                targets.append((run["run_id"], r["id"], dim))
                if key in cache:
                    hits += 1
                elif key not in jobs:
                    jobs[key] = (dim, user_input)
    print(
        f"{len(targets)} 项评分：缓存命中 {hits}，需要调用 {len(jobs)} 次 {JUDGE_MODEL}"
        + (f"，{skipped} 项无工具返回、跳过" if skipped else "")
    )
    if args.dry_run:
        return 0

    if jobs:
        settings = get_settings()
        model = ChatDeepSeek(
            model=JUDGE_MODEL, api_key=settings.deepseek_api_key, max_retries=2, **JUDGE_PARAMS
        )
        semaphore = asyncio.Semaphore(args.concurrency)
        started = time.monotonic()
        usage_total = {"input_tokens": 0, "output_tokens": 0}

        async def run_job(key: str, dim: str, user_input: str) -> None:
            async with semaphore:
                verdict, usage = await judge_one(model, dim, user_input)
            entry = {
                "key": key,
                "dim": dim,
                "model": JUDGE_MODEL,
                "verdict": verdict,
                "usage": usage,
            }
            cache[key] = entry
            with CACHE_PATH.open("a", encoding="utf-8") as f:  # 逐条追加，中途失败也不丢已评的
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            for k in usage_total:
                usage_total[k] += usage[k]
            print(".", end="", flush=True)

        outcomes = await asyncio.gather(
            *(run_job(k, d, u) for k, (d, u) in jobs.items()), return_exceptions=True
        )
        errors = [o for o in outcomes if isinstance(o, Exception)]
        print(
            f"\n调用 {len(jobs) - len(errors)} 次，失败 {len(errors)} 次，"
            f"输入 {usage_total['input_tokens']} / 输出 {usage_total['output_tokens']} token，"
            f"{time.monotonic() - started:.0f} 秒"
        )
        for e in errors[:3]:
            print(f"  ✗ {type(e).__name__}: {e}")

    # 汇总：每题各维度的平均分（多轮取平均）
    rows: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for run in load_results(args.label, args.runs):
        for r in run["results"]:
            if r["id"] not in cases or (wanted and r["id"] not in wanted):
                continue
            for dim in dims:
                s = lookup(cache, dim, cases[r["id"]], r)
                if s is not None:
                    rows.setdefault(r["id"], {}).setdefault(dim, []).append(s)
    print(f"\n{'用例':<40}" + "".join(f"{d:>16}" for d in dims))
    for case_id, by_dim in rows.items():
        cells = []
        for d in dims:
            ss = by_dim.get(d, [])
            cells.append(f"{sum(s['score'] for s in ss) / len(ss):>16.2f}" if ss else f"{'—':>16}")
        print(f"{case_id:<40}" + "".join(cells))
        if args.show:
            for d, ss in by_dim.items():
                for s in ss:
                    items = s["verdict"].get("points") or s["verdict"].get("claims")
                    for it in items:
                        bad = it["verdict"] not in ("covered", "supported")
                        if bad:
                            label = it.get("id", it.get("claim"))
                            print(f"    [{d}] {it['verdict']}: {label} — {it['reason']}")
    for d in dims:
        all_scores = [s["score"] for by_dim in rows.values() for s in by_dim.get(d, [])]
        if all_scores:
            print(f"{d} 平均 {sum(all_scores) / len(all_scores):.3f}（{len(all_scores)} 项）")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
