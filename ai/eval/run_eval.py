"""一键跑评测：uv run python eval/run_eval.py [--only id1,id2] [--concurrency 4] [--label 说明]

在进程内调用和 /chat 相同的 Investigator（不写检查点，每题一个独立会话），
用 .env 里的 CMDB_EVAL_USERNAME / CMDB_EVAL_PASSWORD 登录。
结果写到 eval/results/<时间>-<label>.json，记录每题的回答、工具调用、token、耗时和检查结果，
用于优化前后对比。
"""

import argparse
import asyncio
import hashlib
import json
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

from cmdb_ai.cmdb import CMDBClient
from cmdb_ai.config import get_settings
from cmdb_ai.investigator import Investigator
from cmdb_ai.prompts import INVESTIGATOR_SYSTEM_PROMPT

EVAL_DIR = Path(__file__).parent


def _mentions(answer: str, option: Any) -> bool:
    """以 re: 开头的按正则匹配（同一个意思有多种说法时用），其余按不区分大小写的子串匹配。"""
    text = str(option)
    if text.startswith("re:"):
        return re.search(text[3:], answer) is not None
    return text.lower() in answer.lower()


def check_case(case: dict[str, Any], answer: str, tool_names: list[str]) -> list[dict[str, Any]]:
    """返回每个检查项的结果：{check, ok}。"""
    results = []
    for ident in case.get("cite", []):
        ok = re.search(rf"(?<!\d){ident}(?!\d)", answer) is not None
        results.append({"check": f"cite {ident}", "ok": ok})
    for item in case.get("include", []):
        options = item if isinstance(item, list) else [item]
        ok = any(_mentions(answer, o) for o in options)
        results.append({"check": f"include {'|'.join(map(str, options))}", "ok": ok})
    for item in case.get("exclude", []):
        results.append({"check": f"exclude {item}", "ok": str(item) not in answer})
    for tool in case.get("tools", []):
        results.append({"check": f"tool {tool}", "ok": tool in tool_names})
    if "max_tools" in case:
        ok = len(tool_names) <= case["max_tools"]
        results.append({"check": f"max_tools {case['max_tools']}", "ok": ok})
    return results


async def run_case(investigator: Investigator, user, case: dict[str, Any], run_id: str):
    final, error = None, None
    async for sse in investigator.stream(f"eval-{run_id}-{case['id']}", case["question"], user):
        if sse.event == "final":
            final = sse.data
        elif sse.event == "error":
            error = sse.data["message"]
    if final is None:
        return {
            "id": case["id"],
            "story": case.get("story"),
            "question": case["question"],
            "error": error,
            "passed": False,
            "checks": [],
        }
    tool_names = [c["name"] for c in final["tool_calls"]]
    checks = check_case(case, final["answer"], tool_names)
    return {
        "id": case["id"],
        "story": case.get("story"),
        "question": case["question"],
        "passed": all(c["ok"] for c in checks),
        "checks": checks,
        **final,
    }


def print_report(results: list[dict[str, Any]]) -> dict[str, Any]:
    print(
        f"\n{'用例':<28}{'结果':<6}{'检查':<8}{'工具':<6}{'模型':<6}{'输入tok':>9}{'输出tok':>9}{'秒':>7}"
    )
    for r in results:
        checks = r["checks"]
        passed = sum(c["ok"] for c in checks)
        usage = r.get("usage", {})
        print(
            f"{r['id']:<30}{'✅' if r['passed'] else '❌':<5}{f'{passed}/{len(checks)}':<10}"
            f"{len(r.get('tool_calls', [])):<7}{r.get('model_calls', 0):<7}"
            f"{usage.get('input_tokens', 0):>9}{usage.get('output_tokens', 0):>9}"
            f"{r.get('elapsed_ms', 0) / 1000:>8.1f}"
        )
        for c in checks:
            if not c["ok"]:
                print(f"    ✗ {c['check']}")
        if r.get("error"):
            print(f"    ✗ error: {r['error']}")

    n = len(results)
    ok_runs = [r for r in results if "usage" in r]
    all_checks = [c for r in results for c in r["checks"]]

    def avg(values):
        return round(sum(values) / len(values), 1) if values else 0

    summary = {
        "cases": n,
        "passed": sum(r["passed"] for r in results),
        "pass_rate": round(sum(r["passed"] for r in results) / n, 3) if n else 0,
        "check_pass_rate": round(sum(c["ok"] for c in all_checks) / len(all_checks), 3)
        if all_checks
        else 0,
        "errors": sum(1 for r in results if r.get("error")),
        "avg_tool_calls": avg([len(r["tool_calls"]) for r in ok_runs]),
        "avg_model_calls": avg([r["model_calls"] for r in ok_runs]),
        "avg_input_tokens": avg([r["usage"]["input_tokens"] for r in ok_runs]),
        "avg_output_tokens": avg([r["usage"]["output_tokens"] for r in ok_runs]),
        "avg_seconds": avg([r["elapsed_ms"] / 1000 for r in ok_runs]),
        "total_input_tokens": sum(r["usage"]["input_tokens"] for r in ok_runs),
        "total_output_tokens": sum(r["usage"]["output_tokens"] for r in ok_runs),
    }
    print(
        f"\n通过 {summary['passed']}/{n}（{summary['pass_rate']:.0%}），"
        f"检查项通过率 {summary['check_pass_rate']:.0%}，错误 {summary['errors']}；"
        f"平均 {summary['avg_tool_calls']} 次工具调用、{summary['avg_model_calls']} 次模型调用、"
        f"输入 {summary['avg_input_tokens']} / 输出 {summary['avg_output_tokens']} token、"
        f"{summary['avg_seconds']} 秒"
    )
    return summary


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", help="只跑这些用例 ID，逗号分隔")
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--label", default="run", help="写进结果文件名，方便对比")
    args = parser.parse_args()

    settings = get_settings()
    if not (settings.cmdb_eval_username and settings.cmdb_eval_password):
        print("请在 .env 里设置 CMDB_EVAL_USERNAME / CMDB_EVAL_PASSWORD", file=sys.stderr)
        return 2

    cases = yaml.safe_load((EVAL_DIR / "cases.yaml").read_text(encoding="utf-8"))
    if args.only:
        wanted = set(args.only.split(","))
        cases = [c for c in cases if c["id"] in wanted]

    cmdb = CMDBClient(settings.cmdb_base_url, settings.cmdb_timeout_seconds)
    try:
        jwt = await cmdb.login(
            settings.cmdb_eval_username, settings.cmdb_eval_password.get_secret_value()
        )
        user = await cmdb.whoami(jwt)
    finally:
        await cmdb.aclose()

    investigator = Investigator(settings)
    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    semaphore = asyncio.Semaphore(args.concurrency)

    async def bounded(case):
        async with semaphore:
            result = await run_case(investigator, user, case, run_id)
            print(f"  {'✅' if result['passed'] else '❌'} {case['id']}", flush=True)
            return result

    print(f"运行 {len(cases)} 个用例，模型 {settings.deepseek_model}，并发 {args.concurrency}")
    started = time.monotonic()
    results = await asyncio.gather(*(bounded(c) for c in cases))
    summary = print_report(results)
    summary["wall_seconds"] = round(time.monotonic() - started, 1)

    out_dir = EVAL_DIR / "results"
    out_dir.mkdir(exist_ok=True)
    out = out_dir / f"{run_id}-{args.label}.json"
    prompt_hash = hashlib.sha256(INVESTIGATOR_SYSTEM_PROMPT.encode()).hexdigest()[:12]
    out.write_text(
        json.dumps(
            {
                "run_id": run_id,
                "label": args.label,
                "model": settings.deepseek_model,
                "prompt_sha": prompt_hash,
                "summary": summary,
                "results": results,
            },
            ensure_ascii=False,
            indent=2,
            default=str,
        ),
        encoding="utf-8",
    )
    print(f"结果已写入 {out.relative_to(EVAL_DIR.parent)}")
    return 0 if summary["errors"] == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
