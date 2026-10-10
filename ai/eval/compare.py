"""对比多组评测结果：uv run python eval/compare.py baseline prompt-v2 [...]

每个参数是一个 label，汇总 eval/results/ 里所有该 label 的结果文件（同一配置建议跑 3 轮），
输出 Markdown 表格：总体指标取各轮平均值（括号内为最小值–最大值），逐题指标为通过次数和平均值。

检查项按当前的 cases.yaml 对保存下来的回答重新打分，不用结果文件里的旧结论：
修改检查规则后，新旧结果仍然按同一套规则比较，也不用重跑模型。
"""

import json
import statistics
import sys
from pathlib import Path
from typing import Any

import yaml
from run_eval import check_case

EVAL_DIR = Path(__file__).parent
RESULTS_DIR = EVAL_DIR / "results"
CASES = {c["id"]: c for c in yaml.safe_load((EVAL_DIR / "cases.yaml").read_text(encoding="utf-8"))}


def load(label: str) -> list[dict[str, Any]]:
    runs = []
    for path in sorted(RESULTS_DIR.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("label") == label:
            for r in data["results"]:
                if "answer" in r and r["id"] in CASES:
                    tools = [c["name"] for c in r["tool_calls"]]
                    r["checks"] = check_case(CASES[r["id"]], r["answer"], tools)
                    r["passed"] = all(c["ok"] for c in r["checks"])
            runs.append(data)
    if not runs:
        sys.exit(f"没有 label 为 {label!r} 的结果")
    return runs


def run_metrics(run: dict[str, Any]) -> dict[str, float]:
    results = run["results"]
    ok = [r for r in results if "usage" in r]
    checks = [c for r in results for c in r["checks"]]
    calls = [c for r in ok for c in r["tool_calls"]]
    n = len(ok) or 1
    return {
        "通过率": sum(r["passed"] for r in results) / len(results),
        "检查项通过率": sum(c["ok"] for c in checks) / len(checks),
        "工具调用/题": len(calls) / n,
        "失败的工具调用/题": sum(c["status"] == "error" for c in calls) / n,
        "模型调用/题": sum(r["model_calls"] for r in ok) / n,
        "输入 token/题": sum(r["usage"]["input_tokens"] for r in ok) / n,
        "输出 token/题": sum(r["usage"]["output_tokens"] for r in ok) / n,
        "耗时 秒/题": sum(r["elapsed_ms"] for r in ok) / 1000 / n,
    }


def fmt(name: str, values: list[float]) -> str:
    mean = statistics.mean(values)
    if "率" in name:
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
    labels = sys.argv[1:]
    if not labels:
        sys.exit(__doc__)
    groups = {label: load(label) for label in labels}

    print("| 指标 | " + " | ".join(f"{lb}（{len(groups[lb])} 轮）" for lb in labels) + " |")
    print("|---|" + "---|" * len(labels))
    per_run = {lb: [run_metrics(r) for r in runs] for lb, runs in groups.items()}
    for name in per_run[labels[0]][0]:
        cells = [fmt(name, [m[name] for m in per_run[lb]]) for lb in labels]
        print(f"| {name} | " + " | ".join(cells) + " |")

    print("\n| 用例 | " + " | ".join(f"{lb} 通过 / 工具 / 输入tok" for lb in labels) + " |")
    print("|---|" + "---|" * len(labels))
    case_ids = [r["id"] for r in groups[labels[0]][0]["results"]]
    for case_id in case_ids:
        cells = []
        for lb in labels:
            rs = [r for run in groups[lb] for r in run["results"] if r["id"] == case_id]
            ok = [r for r in rs if "usage" in r]
            passed = sum(r["passed"] for r in rs)
            tools = statistics.mean(len(r["tool_calls"]) for r in ok) if ok else 0
            tokens = statistics.mean(r["usage"]["input_tokens"] for r in ok) if ok else 0
            cells.append(f"{passed}/{len(rs)} / {tools:.1f} / {tokens / 1000:.1f}k")
        print(f"| {case_id} | " + " | ".join(cells) + " |")


if __name__ == "__main__":
    main()
