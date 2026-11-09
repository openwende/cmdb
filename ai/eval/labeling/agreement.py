"""评分模型与人工标注的一致率：uv run python eval/labeling/agreement.py [labels-*.json ...]

不调用模型：评分模型的判定从 judge.py 的缓存里取（先跑
`uv run python eval/judge.py eval/labeling/results-set.json`）。每个标注文件和评分模型两两比较：

- 要点级：四分类（covered / partial / missing / contradicted）完全一致的比例；
  以及二分类（covered vs 其他）的一致率和 Cohen's kappa
- 回答级：正确性"有没有不对的要点"、忠实度"有没有错误或无依据的陈述"，一致率和 kappa
- 对照 key.json：改坏的回答被判出来的比例（任一要点非 covered 或忠实度有问题即算判出）

标注接近常数（几乎全是"对"）时 kappa 没有意义，输出里会标注。
"""

import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

import yaml

HERE = Path(__file__).parent
EVAL_DIR = HERE.parent
sys.path.insert(0, str(EVAL_DIR))

from judge import load_cache, lookup  # noqa: E402


def kappa(a: list[bool], b: list[bool]) -> float | None:
    """二分类 Cohen's kappa；期望一致率为 1（双方都是常数）时无定义，返回 None。"""
    n = len(a)
    if n == 0:
        return None
    observed = sum(x == y for x, y in zip(a, b, strict=True)) / n
    pa, pb = sum(a) / n, sum(b) / n
    expected = pa * pb + (1 - pa) * (1 - pb)
    return None if expected == 1 else (observed - expected) / (1 - expected)


def judge_labels() -> dict[str, dict[str, Any]]:
    cache = load_cache()
    cases = {c["id"]: c for c in yaml.safe_load((EVAL_DIR / "cases.yaml").read_text("utf-8"))}
    results = json.loads((HERE / "results-set.json").read_text("utf-8"))["results"]
    out = {}
    for r in results:
        c = lookup(cache, "correctness", cases[r["id"]], r)
        f = lookup(cache, "faithfulness", cases[r["id"]], r)
        if c is None or f is None:
            sys.exit(f"{r['item']} 还没评分，先跑 judge.py eval/labeling/results-set.json")
        out[r["item"]] = {
            "points": [p["verdict"] for p in sorted(c["verdict"]["points"], key=lambda p: p["id"])],
            "faithful": "no" if f["contradicted"] + f["unsupported"] else "yes",
        }
    return out


def load_labels(path: Path) -> tuple[str, dict[str, dict[str, Any]]]:
    data = json.loads(path.read_text("utf-8"))
    return data.get("who", path.stem), {item["item"]: item for item in data["labels"]}


def complete(label: dict[str, Any], n_points: int) -> bool:
    points = label.get("points") or []
    return len(points) == n_points and all(points) and label.get("faithful") in ("yes", "no")


def compare(name_a: str, a: dict, name_b: str, b: dict, n_points: dict[str, int]) -> None:
    items = sorted(
        i for i in a if i in b and complete(a[i], n_points[i]) and complete(b[i], n_points[i])
    )
    if not items:
        return
    pa = [p for i in items for p in a[i]["points"]]
    pb = [p for i in items for p in b[i]["points"]]
    rows: list[tuple[str, Callable[[dict], bool]]] = [
        ("回答级：有不对的要点", lambda x: any(p != "covered" for p in x["points"])),
        ("回答级：有矛盾的要点", lambda x: "contradicted" in x["points"]),
        ("回答级：忠实度有问题", lambda x: x["faithful"] == "no"),
    ]
    print(f"\n### {name_a} vs {name_b}（{len(items)} 条回答，{len(pa)} 个要点）\n")
    print("| 指标 | 一致率 | kappa | 各自判为有问题的数量 |")
    print("|---|---|---|---|")
    exact = sum(x == y for x, y in zip(pa, pb, strict=True)) / len(pa)
    print(f"| 要点级：四分类完全一致 | {exact:.0%} | — | — |")
    bin_a, bin_b = [p != "covered" for p in pa], [p != "covered" for p in pb]
    _row("要点级：covered vs 其他", bin_a, bin_b)
    for title, fn in rows:
        _row(title, [fn(a[i]) for i in items], [fn(b[i]) for i in items])
    disagree = [i for i in items if a[i]["faithful"] != b[i]["faithful"]]
    disagree += [i for i in items if a[i]["points"] != b[i]["points"] and i not in disagree]
    if disagree:
        print(f"\n有分歧的条目：{', '.join(sorted(disagree))}")


def _row(title: str, a: list[bool], b: list[bool]) -> None:
    agree = sum(x == y for x, y in zip(a, b, strict=True)) / len(a)
    k = kappa(a, b)
    k_text = "无定义（双方都是常数）" if k is None else f"{k:.2f}"
    if k is not None and (sum(a) in (0, len(a)) or sum(b) in (0, len(b))):
        k_text += "（一方是常数，参考意义有限）"
    print(f"| {title} | {agree:.0%} | {k_text} | {sum(a)} / {sum(b)} |")


def detection(name: str, labels: dict, key: dict, n_points: dict[str, int]) -> None:
    perturbed = [i for i, k in key.items() if k["change"]]
    labeled = [i for i in perturbed if i in labels and complete(labels[i], n_points[i])]
    caught = [
        i
        for i in labeled
        if any(p != "covered" for p in labels[i]["points"]) or labels[i]["faithful"] == "no"
    ]
    missed = [i for i in labeled if i not in caught]
    print(
        f"- {name}：改坏的 {len(perturbed)} 条里标了 {len(labeled)} 条，判出 {len(caught)} 条"
        + (f"，漏掉 {', '.join(missed)}" if missed else "")
    )


def main() -> None:
    paths = [Path(p) for p in sys.argv[1:]] or sorted(HERE.glob("labels-*.json"))
    key = json.loads((HERE / "key.json").read_text("utf-8"))
    n_points = {
        d["item"]: len(d["reference"]) for d in json.loads((HERE / "set.json").read_text("utf-8"))
    }
    sources = {"评分模型": judge_labels()}
    for path in paths:
        who, labels = load_labels(path)
        sources[who] = {**sources.get(who, {}), **labels}  # claude-a / claude-b 可以同名合并

    print("## 改坏回答的检出（对照 key.json）\n")
    for name, labels in sources.items():
        detection(name, labels, key, n_points)
    names = list(sources)
    for i, a in enumerate(names):
        for b in names[i + 1 :]:
            compare(a, sources[a], b, sources[b], n_points)


if __name__ == "__main__":
    main()
