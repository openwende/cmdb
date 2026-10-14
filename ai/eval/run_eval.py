"""一键跑评测：uv run python eval/run_eval.py [--only id1,id2] [--concurrency 4] [--label 说明]

在进程内调用和 /chat 相同的 Investigator（检查点只放内存、不写数据库，每题一个独立会话），
用 .env 里的 CMDB_EVAL_USERNAME / CMDB_EVAL_PASSWORD 登录。
多轮题（cases.yaml 里带 turns 的，suite 为 multiturn）在同一会话里按顺序问，每轮单独检查；
只在 --suite multiturn 或 --only 指定时运行。
结果写到 eval/results/<时间>-<label>.json，记录每题的回答、工具调用（含完整返回内容）、token、
耗时和检查结果，
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
from citations import check_citations
from langgraph.checkpoint.memory import InMemorySaver

from cmdb_ai.cmdb import CMDBClient
from cmdb_ai.config import get_settings
from cmdb_ai.investigator import Investigator
from cmdb_ai.prompts import INVESTIGATOR_SYSTEM_PROMPT

EVAL_DIR = Path(__file__).parent


# [record_id=612]、[doc=…#…] 这类引用标记：max_chars 只数正文，不数引用
_CITATION = re.compile(r"\[\s*\w+\s*[=:：][^\]\n]*\]")


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
    if "min_tools" in case:
        ok = len(tool_names) >= case["min_tools"]
        results.append({"check": f"min_tools {case['min_tools']}", "ok": ok})
    if "max_chars" in case:
        ok = len(_CITATION.sub("", answer)) <= case["max_chars"]
        results.append({"check": f"max_chars {case['max_chars']}", "ok": ok})
    return results


async def ask(
    investigator: Investigator, user, conversation_id: str, question: str, tags: list[str]
):
    final, error = None, None
    async for sse in investigator.stream(
        conversation_id, question, user, include_tool_outputs=True, trace_tags=tags
    ):
        if sse.event == "final":
            final = sse.data
        elif sse.event == "error":
            error = sse.data["message"]
    return final, error


def score_turns(case: dict[str, Any], result: dict[str, Any]) -> None:
    """按 case 的 turns 给多轮结果的每一轮重新打分（compare.py 也用它）。

    引用核对用第 1 轮到本轮的全部工具返回：引用前面轮次查到的编号也算有依据。"""
    history: list[dict[str, Any]] = []
    for spec, turn in zip(case["turns"], result["turns"], strict=False):
        if "answer" not in turn:
            continue
        history.extend(turn["tool_calls"])
        turn["checks"] = check_case(spec, turn["answer"], [c["name"] for c in turn["tool_calls"]])
        turn["passed"] = all(c["ok"] for c in turn["checks"])
        turn["citations"] = check_citations(turn["answer"], history)
    result["passed"] = len(result["turns"]) == len(case["turns"]) and all(
        t["passed"] for t in result["turns"]
    )


def turn_rows(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """多轮结果展开成每轮一行（id 为 用例#轮次），单轮结果原样保留，用于汇总指标。"""
    rows = []
    for r in results:
        if "turns" in r:
            rows.extend({**t, "id": f"{r['id']}#{t['turn']}"} for t in r["turns"])
        else:
            rows.append(r)
    return rows


async def run_conversation(
    investigator: Investigator, user, case: dict[str, Any], run_id: str, label: str
):
    conversation_id = f"eval-{run_id}-{case['id']}"
    turns = []
    for i, spec in enumerate(case["turns"], 1):
        final, error = await ask(
            investigator, user, conversation_id, spec["question"], ["eval", label, case["id"]]
        )
        if final is None:
            turns.append(
                {
                    "turn": i,
                    "question": spec["question"],
                    "error": error,
                    "passed": False,
                    "checks": [],
                }
            )
            break  # 这一轮没有回答，后面的追问没有意义
        turns.append({"turn": i, "question": spec["question"], **final})
    result = {"id": case["id"], "story": case.get("story"), "turns": turns}
    score_turns(case, result)
    return result


async def run_case(investigator: Investigator, user, case: dict[str, Any], run_id: str, label: str):
    if "turns" in case:
        return await run_conversation(investigator, user, case, run_id, label)
    conversation_id = f"eval-{run_id}-{case['id']}"
    final, error = await ask(
        investigator, user, conversation_id, case["question"], ["eval", label, case["id"]]
    )
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
        "citations": check_citations(final["answer"], final["tool_calls"]),
        **final,
    }


def citation_metrics(results: list[dict[str, Any]]) -> dict[str, Any]:
    """引用幻觉率 = 工具返回里找不到的引用编号数 / 引用编号总数（每题内去重）。"""
    checked = [r["citations"] for r in results if r.get("citations") is not None]
    cited = sum(c["cited"] for c in checked)
    unsupported = sum(len(c["unsupported"]) for c in checked)
    docs = sum(c["cited_docs"] for c in checked)
    unsupported_docs = sum(len(c["unsupported_docs"]) for c in checked)
    return {
        "cited_ids": cited,
        "unsupported_ids": unsupported,
        "unsupported_rate": round(unsupported / cited, 4) if cited else 0,
        "answers_with_unsupported": sum(1 for c in checked if c["unsupported"]),
        "cited_docs": docs,
        "unsupported_docs": unsupported_docs,
    }


def multiturn_summary(results: list[dict[str, Any]]) -> dict[str, Any]:
    """多轮专有指标：整段对话全部轮次通过的比例，复用 / 重查两类轮次的工具调用是否符合预期。"""
    conversations = [r for r in results if "turns" in r]
    if not conversations:
        return {}
    cases = {c["id"]: c for c in load_cases()}

    def rate(check_name: str) -> tuple[int, int]:
        hits = [
            c["ok"]
            for r in conversations
            for spec, t in zip(cases[r["id"]]["turns"], r["turns"], strict=False)
            if check_name in spec
            for c in t["checks"]
            if c["check"].startswith(check_name)
        ]
        return sum(hits), len(hits)

    reuse_ok, reuse_n = rate("max_tools")
    recheck_ok, recheck_n = rate("min_tools")
    return {
        "conversations": len(conversations),
        "conversations_passed": sum(r["passed"] for r in conversations),
        "reuse_turns": reuse_n,
        "reuse_turns_ok": reuse_ok,
        "recheck_turns": recheck_n,
        "recheck_turns_ok": recheck_ok,
    }


def load_cases() -> list[dict[str, Any]]:
    return yaml.safe_load((EVAL_DIR / "cases.yaml").read_text(encoding="utf-8"))


def print_report(conversation_results: list[dict[str, Any]]) -> dict[str, Any]:
    results = turn_rows(conversation_results)
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
        if (r.get("citations") or {}).get("unsupported"):
            print(f"    ✗ 引用无依据: {', '.join(r['citations']['unsupported'])}")
        if (r.get("citations") or {}).get("unsupported_docs"):
            print(f"    ✗ doc 引用无依据: {', '.join(r['citations']['unsupported_docs'])}")
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
        **citation_metrics(ok_runs),
        **multiturn_summary(conversation_results),
    }
    print(
        f"\n通过 {summary['passed']}/{n}（{summary['pass_rate']:.0%}），"
        f"检查项通过率 {summary['check_pass_rate']:.0%}，错误 {summary['errors']}；"
        f"平均 {summary['avg_tool_calls']} 次工具调用、{summary['avg_model_calls']} 次模型调用、"
        f"输入 {summary['avg_input_tokens']} / 输出 {summary['avg_output_tokens']} token、"
        f"{summary['avg_seconds']} 秒；引用 {summary['cited_ids']} 个，"
        f"无依据 {summary['unsupported_ids']} 个（{summary['unsupported_rate']:.1%}）；"
        f"doc 引用 {summary['cited_docs']} 个，无依据 {summary['unsupported_docs']} 个"
    )
    if "conversations" in summary:
        print(
            f"多轮：对话全部轮次通过 {summary['conversations_passed']}/{summary['conversations']}；"
            f"该复用的轮次没有多余工具调用 {summary['reuse_turns_ok']}/{summary['reuse_turns']}，"
            f"该重查的轮次重新查了 {summary['recheck_turns_ok']}/{summary['recheck_turns']}"
            f"（上面的题数、平均值按轮次算）"
        )
    return summary


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--only", help="只跑这些用例 ID，逗号分隔")
    parser.add_argument(
        "--suite", help="只跑这一组题（cases.yaml 的 suite 字段，没写的是 investigation）"
    )
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--label", default="run", help="写进结果文件名，方便对比")
    args = parser.parse_args()

    settings = get_settings()
    if not (settings.cmdb_eval_username and settings.cmdb_eval_password):
        print("请在 .env 里设置 CMDB_EVAL_USERNAME / CMDB_EVAL_PASSWORD", file=sys.stderr)
        return 2

    cases = load_cases()
    if args.only:
        wanted = set(args.only.split(","))
        cases = [c for c in cases if c["id"] in wanted]
    if args.suite:
        cases = [c for c in cases if c.get("suite", "investigation") == args.suite]
    elif not args.only:
        cases = [c for c in cases if "turns" not in c]  # 默认全量不含多轮题，跑法和以前一致

    cmdb = CMDBClient(settings.cmdb_base_url, settings.cmdb_timeout_seconds)
    try:
        jwt = await cmdb.login(
            settings.cmdb_eval_username, settings.cmdb_eval_password.get_secret_value()
        )
        user = await cmdb.whoami(jwt)
    finally:
        await cmdb.aclose()

    # 内存检查点：多轮题的追问能接上前面的轮次；单轮题每题一个会话，和不带检查点等价
    investigator = Investigator(settings, checkpointer=InMemorySaver())
    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    semaphore = asyncio.Semaphore(args.concurrency)

    async def bounded(case):
        async with semaphore:
            result = await run_case(investigator, user, case, run_id, args.label)
            print(f"  {'✅' if result['passed'] else '❌'} {case['id']}", flush=True)
            return result

    # 知识库的本地模型先加载好（和 API 启动时一样），不算进第一题的耗时
    await asyncio.to_thread(investigator.knowledge.warm_up)
    print(
        f"运行 {len(cases)} 个用例，模型 {settings.deepseek_model}，并发 {args.concurrency}，"
        f"知识库检索 {settings.knowledge_search_mode}"
    )
    started = time.monotonic()
    results = await asyncio.gather(*(bounded(c) for c in cases))
    summary = print_report(results)
    investigator.tracing.flush()  # 评测进程马上退出，先把 trace 发完
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
                "knowledge_search_mode": settings.knowledge_search_mode,
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
