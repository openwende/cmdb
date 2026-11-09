"""知识库语料（knowledge/*.md）的读取：每个 `##` 小节是一个检索单元。

小节的 ID 写成 "<文档 title>#<小节标题>"，例如 "主机流转规则#回收到资源池"；评测题用它标注
应命中的段落，Agent 引用时写成 [doc=主机流转规则#回收到资源池]。写法约定见 knowledge/README.md。
"""

import re
from dataclasses import dataclass
from pathlib import Path

import yaml

KNOWLEDGE_DIR = Path(__file__).resolve().parents[2] / "knowledge"

_FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.S)
_COMMENT = re.compile(r"<!--.*?-->", re.S)


@dataclass(frozen=True)
class Section:
    doc: str  # 文档 title
    title: str  # 小节标题
    text: str  # 小节正文，不含标题行

    @property
    def id(self) -> str:
        return f"{self.doc}#{self.title}"


def parse_document(markdown: str) -> list[Section]:
    match = _FRONTMATTER.match(markdown)
    if not match:
        raise ValueError("知识库文档缺少 frontmatter")
    doc = yaml.safe_load(match.group(1))["title"]
    body = _COMMENT.sub("", markdown[match.end() :])

    sections: list[Section] = []
    title: str | None = None
    lines: list[str] = []
    for line in [*body.splitlines(), "## "]:  # 哨兵：收尾最后一节
        if line.startswith("## "):
            if title is not None:
                sections.append(Section(doc, title, "\n".join(lines).strip()))
            title, lines = line[3:].strip(), []
        elif title is not None:
            lines.append(line)
    return sections


def load_sections(directory: Path = KNOWLEDGE_DIR) -> list[Section]:
    """读取目录下全部文档（README.md 是写法说明，不入库）。"""
    sections: list[Section] = []
    for path in sorted(directory.glob("*.md")):
        if path.name != "README.md":
            sections.extend(parse_document(path.read_text(encoding="utf-8")))
    return sections
