"""确定性的引用核对：回答里引用的 record_id / host_id / doc 必须在本题的工具返回里出现过。

不调用模型、零成本。只能发现"引用了查不到的 ID"（编造或记错编号），
发现不了"ID 是真的、但事实和这条记录对不上"，后者交给 LLM 评分的忠实度。
"""

import re
from typing import Any

KEYS = ("record_id", "host_id")

# 回答里的写法：[record_id=612]、[record_id=612、613]、[host_id=43, record_id=612]、
# [record_id=700~705]、正文里的 host_id=43。范围只核对两端（中间的编号可能属于别的主机）。
# 列表和范围只在方括号里认：正文里 "host_id=43，8 核" 的 8 是核数，不是编号
_IP = re.compile(r"\d{1,3}(?:\.\d{1,3}){3}")
_BRACKET = re.compile(r"\[[^\]\n]*\]")
_CITE_ONE = re.compile(r"(record_id|host_id)\s*[=:：]\s*(\d+)")
# 后续编号后面紧跟 - : . 年 月 的是日期时间，不算（例如 "612，2026-09-16"）
_CITE_LIST = re.compile(
    r"(record_id|host_id)\s*[=:：]\s*(\d+(?:\s*[、,，/~～–—]\s*\d+(?![\d\-:.年月日号]))*)"
)
_NUM = re.compile(r"\d+")
# 工具返回里的写法：JSON 的 "record_id":612，或错误信息里的 host_id=0
_GROUND = re.compile(r'"?(record_id|host_id)"?\s*[:=]\s*(\d+)')

# 知识库引用 [doc=主机流转规则#回收到资源池]。小节标题里可能有顿号、空格（"删除和移动集群、模块"），
# 所以只在"分隔符 + 下一个 xxx=" 处断开，同一个方括号里的 [doc=A#x、record_id=5] 也能拆开
_CITE_DOC = re.compile(
    r"doc\s*[=:：]\s*(.+?)\s*(?=[,，;；、]\s*(?:doc|record_id|host_id)\s*[=:：]|$)"
)
# search_knowledge 的返回里每节以单独一行的 [doc=…] 开头
_GROUND_DOC = re.compile(r"^\[doc=(.+)\]$", re.MULTILINE)


def cited_ids(answer: str) -> dict[str, set[int]]:
    found: dict[str, set[int]] = {k: set() for k in KEYS}
    answer = _IP.sub("", answer)
    for segment in _BRACKET.findall(answer):
        for key, numbers in _CITE_LIST.findall(segment):
            found[key].update(int(n) for n in _NUM.findall(numbers))
    for key, number in _CITE_ONE.findall(_BRACKET.sub("", answer)):
        found[key].add(int(number))
    return found


def grounded_ids(tool_calls: list[dict[str, Any]]) -> dict[str, set[int]]:
    found: dict[str, set[int]] = {k: set() for k in KEYS}
    for call in tool_calls:
        for key, number in _GROUND.findall(call.get("output") or ""):
            found[key].add(int(number))
    return found


def cited_docs(answer: str) -> set[str]:
    return {doc for segment in _BRACKET.findall(answer) for doc in _CITE_DOC.findall(segment[1:-1])}


def grounded_docs(tool_calls: list[dict[str, Any]]) -> set[str]:
    return {doc for c in tool_calls for doc in _GROUND_DOC.findall(c.get("output") or "")}


def check_citations(answer: str, tool_calls: list[dict[str, Any]]) -> dict[str, Any] | None:
    """返回 {cited, unsupported, cited_docs, unsupported_docs}。

    cited / unsupported 只算 record_id、host_id（和第二阶段之前的结果口径一致），unsupported
    形如 ["record_id=999"]；知识库引用单独计数，unsupported_docs 形如 ["主机流转规则#不存在"]。

    结果里没有保存工具返回内容（第二阶段之前的旧结果）时返回 None，表示无法核对。
    """
    if any("output" not in c for c in tool_calls):
        return None
    cited, grounded = cited_ids(answer), grounded_ids(tool_calls)
    unsupported = [f"{k}={n}" for k in KEYS for n in sorted(cited[k] - grounded[k])]
    docs = cited_docs(answer)
    return {
        "cited": sum(len(v) for v in cited.values()),
        "unsupported": unsupported,
        "cited_docs": len(docs),
        "unsupported_docs": sorted(docs - grounded_docs(tool_calls)),
    }
