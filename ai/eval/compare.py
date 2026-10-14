"""对比多组评测结果：uv run python eval/compare.py baseline prompt-v2 [...] [--suite knowledge]

每个参数是一个 label，汇总 eval/results/ 里所有该 label 的结果文件（同一配置建议跑 3 轮），
输出 Markdown 表格：总体指标取各轮平均值（括号内为最小值–最大值），逐题指标为通过次数和平均值。

检查项按当前的 cases.yaml 对保存下来的回答重新打分，不用结果文件里的旧结论：
修改检查规则后，新旧结果仍然按同一套规则比较，也不用重跑模型。
引用幻觉率同样按保存的回答和工具返回重新计算；第二阶段之前的结果没有保存工具返回，显示为"—"。
LLM 评分（正确性 / 忠实度）只从 judge.py 的缓存里取，不调用模型；有题没评过时显示为"—"。
--suite 只统计这一组题（cases.yaml 的 suite 字段，没写的是 investigation）；
题数不同的结果不要直接比均值。
多轮题（--suite multiturn）每一轮算一题（逐题表里是 用例#轮次），另外给出对话通过率和
复用 / 重查两类轮次的工具调用是否符合预期；多轮题不做 LLM 评分。
"""

import json
import statistics
import sys
from pathlib import Path
from typing import Any

import yaml
from citations import check_citations
from judge import load_cache, lookup
from run_eval import check_case, multiturn_summary, score_turns, turn_rows

EVAL_DIR = Path(__file__).parent
RESULTS_DIR = EVAL_DIR / "results"
CASES = {c["id"]: c for c in yaml.safe_load((EVAL_DIR / "cases.yaml").read_text(encoding="utf-8"))}
JUDGE_CACHE = load_cache()


def suite_of(case: dict[str, Any]) -> str:
    return case.get("suite", "investigation")


def load(label: str, suite: str | None = None) -> list[dict[str, Any]]:
    runs = []
    for path in sorted(RESULTS_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("label") == label:
            if suite:
                data["results"] = [
                    r
                    for r in data["results"]
                    if r["id"] in CASES and suite_of(CASES[r["id"]]) == suite
                ]
                if not data["results"]:
                    continue
            for r in data["results"]:
                if "turns" in r and r["id"] in CASES:
                    score_turns(CASES[r["id"]], r)
                elif "answer" in r and r["id"] in CASES:
                    tools = [c["name"] for c in r["tool_calls"]]
                    r["checks"] = check_case(CASES[r["id"]], r["answer"], tools)
                    r["passed"] = all(c["ok"] for c in r["checks"])
                    r["citations"] = check_citations(r["answer"], r["tool_calls"])
                    for dim in ("correctness", "faithfulness"):
                        r[dim] = lookup(JUDGE_CACHE, dim, CASES[r["id"]], r)
            runs.append(data)
    if not runs:
        sys.exit(f"没有 label 为 {label!r} 的结果" + (f"（suite={suite}）" if suite else ""))
    return runs


def run_metrics(run: dict[str, Any]) -> dict[str, float | None]:
    results = turn_rows(run["results"])
    ok = [r for r in results if "usage" in r]
    checks = [c for r in results for c in r["checks"]]
    calls = [c for r in ok for c in r["tool_calls"]]
    n = len(ok) or 1
    cites = [r["citations"] for r in ok]
    cited = sum(c["cited"] for c in cites) if None not in cites else 0
    docs = sum(c.get("cited_docs", 0) for c in cites) if None not in cites else 0
    return {
        "通过率": sum(r["passed"] for r in results) / len(results),
        "检查项通过率": sum(c["ok"] for c in checks) / len(checks),
        "工具调用/题": len(calls) / n,
        "失败的工具调用/题": sum(c["status"] == "error" for c in calls) / n,
        "模型调用/题": sum(r["model_calls"] for r in ok) / n,
        "输入 token/题": sum(r["usage"]["input_tokens"] for r in ok) / n,
        "输出 token/题": sum(r["usage"]["output_tokens"] for r in ok) / n,
        "耗时 秒/题": sum(r["elapsed_ms"] for r in ok) / 1000 / n,
        "引用幻觉率": sum(len(c["unsupported"]) for c in cites) / cited if cited else None,
        "知识库查询/题": sum(c["name"] == "search_knowledge" for c in calls) / n,
        "doc 引用/题": sum(c.get("cited_docs", 0) for c in cites) / n
        if None not in cites
        else None,
        "doc 引用幻觉率": (
            sum(len(c.get("unsupported_docs", [])) for c in cites) / docs if docs else None
        ),
        **judge_metrics(ok),
        **conversation_metrics(run["results"]),
    }


def conversation_metrics(results: list[dict[str, Any]]) -> dict[str, float | None]:
    mt = multiturn_summary(results)
    if not mt:
        return {}
    return {
        "对话通过率": mt["conversations_passed"] / mt["conversations"],
        "复用轮无多余工具调用率": (
            mt["reuse_turns_ok"] / mt["reuse_turns"] if mt["reuse_turns"] else None
        ),
        "重查轮有重新查询率": (
            mt["recheck_turns_ok"] / mt["recheck_turns"] if mt["recheck_turns"] else None
        ),
    }


def judge_metrics(ok: list[dict[str, Any]]) -> dict[str, float | None]:
    """一轮里所有题都评过才出数，否则为 None，避免只评了一部分的平均分被误读。"""
    corr = [r.get("correctness") for r in ok]
    faith = [r.get("faithfulness") for r in ok]
    corr = corr if corr and None not in corr else None
    faith = faith if faith and None not in faith else None
    return {
        "正确性均分": statistics.mean(s["score"] for s in corr) if corr else None,
        "要点矛盾的回答率": sum(s["contradicted"] > 0 for s in corr) / len(corr) if corr else None,
        "忠实度均分": statistics.mean(s["score"] for s in faith) if faith else None,
        "含错误陈述的回答率": (
            sum(s["contradicted"] + s["unsupported"] > 0 for s in faith) / len(faith)
            if faith
            else None
        ),
    }


def fmt(name: str, values: list[float | None]) -> str:
    if None in values:
        return "—"
    if "幻觉率" in name:
        mean = statistics.mean(values)
        return (
            f"{mean:.1%}（{min(values):.1%}–{max(values):.1%}）"
            if len(values) > 1
            else f"{mean:.1%}"
        )
    mean = statistics.mean(values)
    if "均分" in name:
        text, lo, hi = f"{mean:.3f}", f"{min(values):.3f}", f"{max(values):.3f}"
    elif "率" in name:
        text, lo, hi = f"{mean:.0%}", f"{min(values):.0%}", f"{max(values):.0%}"
    elif "token" in name:
        text, lo, hi = (
            f"{mean / 1000:.1f}k",
            f"{min(values) / 1000:.1f}",
            f"{max(values) / 1000:.1f}",
        )
    else:
        text, lo, hi = f"{mean:.1f}", f"{min(values):.1f}", f"{max(values):.1f}"
    return f"{text}（{lo}–{hi}）" if len(values) > 1 else text


def main() -> None:
    args = sys.argv[1:]
    suite = None
    if "--suite" in args:
        i = args.index("--suite")
        suite = args[i + 1]
        del args[i : i + 2]
    labels = args
    if not labels:
        sys.exit(__doc__)
    groups = {label: load(label, suite) for label in labels}

    print("| 指标 | " + " | ".join(f"{lb}（{len(groups[lb])} 轮）" for lb in labels) + " |")
    print("|---|" + "---|" * len(labels))
    per_run = {lb: [run_metrics(r) for r in runs] for lb, runs in groups.items()}
    for name in per_run[labels[0]][0]:
        cells = [fmt(name, [m[name] for m in per_run[lb]]) for lb in labels]
        print(f"| {name} | " + " | ".join(cells) + " |")

    print("\n| 用例 | " + " | ".join(f"{lb} 通过 / 工具 / 输入tok" for lb in labels) + " |")
    print("|---|" + "---|" * len(labels))
    case_ids = [r["id"] for r in turn_rows(groups[labels[0]][0]["results"])]
    for case_id in case_ids:
        cells = []
        for lb in labels:
            rs = [r for run in groups[lb] for r in turn_rows(run["results"]) if r["id"] == case_id]
            ok = [r for r in rs if "usage" in r]
            passed = sum(r["passed"] for r in rs)
            tools = statistics.mean(len(r["tool_calls"]) for r in ok) if ok else 0
            tokens = statistics.mean(r["usage"]["input_tokens"] for r in ok) if ok else 0
            cells.append(f"{passed}/{len(rs)} / {tools:.1f} / {tokens / 1000:.1f}k")
        print(f"| {case_id} | " + " | ".join(cells) + " |")


if __name__ == "__main__":
    main()
