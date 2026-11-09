"""生成人工标注集：uv run python eval/labeling/make_set.py <原样回答结果> <改坏用的结果>

用来校准 LLM 评分（A4）。标注集 = 30 个原样回答 + 10 个故意改坏的回答：
真实回答几乎都对，只标真实回答时一致率会虚高、kappa 也算不出来，所以混入改坏的回答。
改法都是真实会犯的错（时间、人、数字写错，多列、漏列，把推测当事实），只做字符串替换。

输出（都在本目录）：
- set.json        标注集，不含"是否改过"
- key.json        答案：每条来自哪一轮、哪一题，改过什么。标注完之前不要打开
- results-set.json 与 run_eval 结果同格式，供 judge.py 评分（label: labeling-set）
- label.html      标注页面，浏览器直接打开；?who=user 只显示用户盲标的 15 条
"""

import json
import random
import sys
from pathlib import Path

import yaml

HERE = Path(__file__).parent
EVAL_DIR = HERE.parent
SEED = 20261010

# (题目, [(原文, 改成)], 说明)。原文必须在回答里出现，否则报错
PERTURBATIONS = [
    (
        "s1-memory-upgrade",
        [("2026-09-03 15:20", "2026-09-03 16:20")],
        "修改时间写错（15:20 → 16:20）",
    ),
    ("s2-time-in-faulty", [("4 天 7 小时 13 分钟", "3 天 7 小时 13 分钟")], "时长算错（少一天）"),
    ("s2-disk-replacer", [("**chenjing** 换的", "**liuyang** 换的")], "结论里的操作人写错"),
    (
        "s4-backup-status",
        [
            (
                "该字段是在 2026-09-21 23:31 由 zhangwei 从 true 改为 false 的 [record_id=627]。",
                "该字段是在 2026-09-21 23:31 由 zhangwei 从 true 改为 false 的 [record_id=627]。"
                "关闭原因是当晚要在维护窗口做主从切换，切换完成后忘了恢复。",
            )
        ],
        "把推测的原因当成事实",
    ),
    ("s5-pool-capacity", [("共 35 台", "共 33 台")], "数量写错（35 → 33）"),
    (
        "s5-directory-left",
        [
            ("**5 台**", "**6 台**"),
            ("其中 5 台", "其中 6 台"),
            ("共有 5 台主机，运行中 5 台", "共有 6 台主机，运行中 6 台"),
        ],
        "数量写错（5 → 6）",
    ),
    (
        "operator-day",
        [
            (
                '共做了 2 次主机归属变更，都是"转移"：'
                "上午把 10.10.3.11（mall-order-01）从文德商城/订单服务转到网关服务，晚上把",
                "只做了 1 次主机归属变更：晚上把",
            ),
            ("转到风控服务 [record_id=612][record_id=871]。", "转到风控服务 [record_id=612]。"),
            ("共 2 条 [record_id=612][record_id=871]", "共 1 条 [record_id=612]"),
        ],
        "漏掉上午 mall-order-01 那条，并说当天只有 1 条",
        # 另外删掉 871 那一行，见 _drop_lines
    ),
    (
        "hard-time-window-morning",
        [
            ("共有 4 条归属变更记录", "共有 5 条归属变更记录"),
            (
                "- 两台主机目前仍归属",
                '- 11:05，10.30.2.17（obs-log-07，host_id=72）从"支付清结算 / 故障机"转回'
                '"支付清结算 / 风控服务"，操作人 zhangwei。[record_id=859]\n- 两台主机目前仍归属',
            ),
        ],
        "多列了一条不在上午的记录（859 实际是 09-14）",
    ),
    (
        "hard-multi-hop-mall-gw-01",
        [
            (
                "回收到 **资源池 / 默认目录**，操作人 chenjing [record_id=709]",
                "回收到 **资源池 / 默认目录**，操作人 zhangwei [record_id=709]",
            )
        ],
        "长回答中间一步的操作人写错（709 是 chenjing）",
    ),
    (
        "s1-why-two-modules",
        [
            (
                "### 查到的事实",
                "这是 zhangwei 操作时漏选了移除风控服务造成的误操作。\n\n### 查到的事实",
            )
        ],
        "把推测的动机当成结论",
    ),
]
DROP_LINES = {"operator-day": ["[record_id=871]。该主机当前仍在"]}


def perturb(case_id: str, answer: str, edits: list[tuple[str, str]]) -> str:
    for old, new in edits:
        if old not in answer:
            sys.exit(f"{case_id}: 回答里找不到要替换的原文：{old[:40]}")
        answer = answer.replace(old, new)
    for marker in DROP_LINES.get(case_id, []):
        lines = answer.split("\n")
        kept = [line for line in lines if marker not in line]
        if len(kept) != len(lines) - 1:
            sys.exit(f"{case_id}: 要删除的行应该正好一行：{marker}")
        answer = "\n".join(kept)
    return answer


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    original_run = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    perturb_run = json.loads(Path(sys.argv[2]).read_text(encoding="utf-8"))
    cases = {c["id"]: c for c in yaml.safe_load((EVAL_DIR / "cases.yaml").read_text("utf-8"))}

    items = []
    for r in original_run["results"]:
        items.append({"source": (original_run["run_id"], r["id"]), "result": r, "change": None})
    by_id = {r["id"]: r for r in perturb_run["results"]}
    for case_id, edits, change in PERTURBATIONS:
        r = dict(by_id[case_id])
        r["answer"] = perturb(case_id, r["answer"], edits)
        items.append({"source": (perturb_run["run_id"], case_id), "result": r, "change": change})

    rng = random.Random(SEED)
    rng.shuffle(items)
    for i, item in enumerate(items, 1):
        item["item"] = f"L{i:02d}"

    # 用户盲标 15 条：10 条原样 + 5 条改过，同一题不出现两次（否则一对比就知道改过哪里）
    perturbed = [it for it in items if it["change"]]
    user_perturbed = rng.sample(perturbed, 5)
    taken = {it["result"]["id"] for it in user_perturbed}
    originals = [it for it in items if not it["change"] and it["result"]["id"] not in taken]
    user_items = {it["item"] for it in user_perturbed + rng.sample(originals, 10)}

    public = [
        {
            "item": it["item"],
            "case_id": it["result"]["id"],
            "question": cases[it["result"]["id"]]["question"],
            "reference": cases[it["result"]["id"]]["reference"],
            "answer": it["result"]["answer"],
            "tool_calls": [
                {k: c[k] for k in ("name", "input", "status", "output")}
                for c in it["result"]["tool_calls"]
            ],
            "user": it["item"] in user_items,
        }
        for it in items
    ]
    key = {
        it["item"]: {"run_id": it["source"][0], "case_id": it["source"][1], "change": it["change"]}
        for it in items
    }
    results = {
        "run_id": "labeling-set",
        "label": "labeling-set",
        "results": [{**it["result"], "id": it["result"]["id"], "item": it["item"]} for it in items],
    }

    def dump(name: str, data) -> None:
        (HERE / name).write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    dump("set.json", public)
    dump("key.json", key)
    dump("results-set.json", results)
    template = (HERE / "label.template.html").read_text(encoding="utf-8")
    data = json.dumps(public, ensure_ascii=False).replace("</", "<\\/")
    (HERE / "label.html").write_text(template.replace("/*__DATA__*/[]", data), encoding="utf-8")
    print(f"{len(items)} 条（改过 {len(perturbed)} 条），用户盲标 {len(user_items)} 条：")
    print(", ".join(sorted(user_items)))


if __name__ == "__main__":
    main()
