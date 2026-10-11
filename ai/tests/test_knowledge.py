import re
from pathlib import Path

import pytest
import yaml

from cmdb_ai.knowledge import KNOWLEDGE_DIR, load_sections, parse_document

EVAL_DIR = Path(__file__).resolve().parents[1] / "eval"


def _yaml(name: str) -> list[dict]:
    return yaml.safe_load((EVAL_DIR / name).read_text(encoding="utf-8"))


def test_parse_document_splits_on_level_two_headings():
    md = (
        "---\ntitle: 文档\n---\n\n# 文档\n\n## 甲\n\n第一段\n<!-- 注释 -->\n\n"
        "## 乙\n第二段\n### 小标题\n还是乙\n"
    )
    sections = parse_document(md)
    assert [s.id for s in sections] == ["文档#甲", "文档#乙"]
    assert sections[0].text == "第一段"
    assert sections[1].text == "第二段\n### 小标题\n还是乙"


def test_parse_document_requires_frontmatter():
    with pytest.raises(ValueError):
        parse_document("# 没有 frontmatter\n\n## 甲\n")


def test_section_ids_are_unique_and_nonempty():
    sections = load_sections()
    ids = [s.id for s in sections]
    assert len(ids) == len(set(ids))
    assert all(s.text for s in sections)


def test_labeled_passages_exist():
    known = {s.id for s in load_sections()}
    labeled = [c for c in _yaml("cases.yaml") if "passages" in c] + _yaml("retrieval_cases.yaml")
    assert labeled
    missing = {(c["id"], p) for c in labeled for p in c["passages"] if p not in known}
    assert not missing


def test_knowledge_does_not_leak_eval_answers():
    """知识库只写一般规律：评测题里的主机名、IP、记录号、演示业务名都不能出现。"""
    cases = _yaml("cases.yaml")
    text = "\n".join(p.read_text(encoding="utf-8") for p in KNOWLEDGE_DIR.glob("*.md"))
    corpus = " ".join(str(c) for c in cases)
    hosts = set(re.findall(r"\b(?:[a-z]+-)+\d{2}\b", corpus))
    ips = set(re.findall(r"\b\d+\.\d+\.\d+\.\d+\b", corpus))
    # 两位数的 host_id（如 43）会和"约 43 分钟"这类普通数字撞上，只查三位数以上的编号
    records = {str(n) for c in cases for n in c.get("cite", []) if n >= 100}
    assert hosts and ips and records
    for leaked in hosts | ips | {"文德商城", "支付清结算", "观测平台", "数据中台"}:
        assert leaked not in text, leaked
    assert not re.search(r"(record_id|host_id|record)\s*[=＝ ]\s*\d", text)
    for record in records:
        assert not re.search(rf"(?<![\d.]){record}(?![\d.])", text), record
