/**
 * 解析 AI 回答里的依据引用，例如：
 *
 * - `[record_id=895]`、`[record_id=700、701]`、`[record_id=800~802]`（范围只取两端）
 * - `[host_id=43, record_id=612]`（同一方括号多个 key）
 * - `[doc=主机流转规则#回收到资源池]`（值取到 `]` 为止，标题里可以有顿号、逗号）
 *
 * 同一方括号里的多个 key 只在「分隔符 + 下一个 `xxx=`」处断开；
 * 不是 `key=value` 形式的方括号内容原样保留。
 */

export type CitationItem =
  | { kind: 'record'; id: string }
  | { kind: 'host'; id: string }
  | { kind: 'doc'; id: string }
  /** 认得出是 key=value，但不是已知 key 或值不合法：显示原文 */
  | { kind: 'other'; text: string };

export type CitationSegment =
  | { type: 'text'; value: string }
  | { type: 'citation'; raw: string; items: CitationItem[] };

const BRACKET_RE = /\[([^[\]\n]+)\]/g;
const KEY_VALUE_RE = /^([a-z][a-z0-9_]*)\s*=\s*([\s\S]*)$/i;
/** 分隔符 + 下一个 `xxx=` */
const PART_SPLIT_RE = /\s*[,，、;；]\s*(?=[a-z][a-z0-9_]*\s*=)/i;
const RANGE_RE = /^(\d+)~(\d+)$/;
const ID_SPLIT_RE = /\s*[,，、;；\s]\s*/;

const ID_KINDS: Record<string, 'record' | 'host'> = {
  record_id: 'record',
  host_id: 'host',
};

/** `700、701`、`800~802`、`43` → ['700','701'] / ['800','802'] / ['43']；有非法片段返回 null */
const parseIds = (value: string): string[] | null => {
  const ids: string[] = [];
  const tokens = value
    .trim()
    .replace(/\s*[~～\-–]\s*/g, '~')
    .split(ID_SPLIT_RE)
    .filter(Boolean);
  if (tokens.length === 0) return null;
  for (const token of tokens) {
    const range = token.match(RANGE_RE);
    if (range) {
      ids.push(range[1], range[2]);
    } else if (/^\d+$/.test(token)) {
      ids.push(token);
    } else {
      return null;
    }
  }
  return Array.from(new Set(ids));
};

const parsePart = (part: string): CitationItem[] => {
  const match = part.trim().match(KEY_VALUE_RE);
  if (!match) return [{ kind: 'other', text: part.trim() }];
  const key = match[1].toLowerCase();
  const value = match[2].trim();

  if (key === 'doc') {
    return value ? [{ kind: 'doc', id: value }] : [{ kind: 'other', text: part.trim() }];
  }
  const idKind = ID_KINDS[key];
  if (idKind) {
    const ids = parseIds(value);
    if (ids) return ids.map((id) => ({ kind: idKind, id }));
  }
  return [{ kind: 'other', text: part.trim() }];
};

/**
 * 解析一个方括号里的内容（不含方括号）。不是引用时返回 null。
 * 至少要有一个 record_id / host_id / doc，才算引用。
 */
export const parseCitationContent = (content: string): CitationItem[] | null => {
  if (!KEY_VALUE_RE.test(content.trim())) return null;
  const items = content.split(PART_SPLIT_RE).flatMap(parsePart);
  return items.some((item) => item.kind !== 'other') ? items : null;
};

/** 把一段纯文本切成普通文本和引用片段 */
export const parseCitations = (text: string): CitationSegment[] => {
  const segments: CitationSegment[] = [];
  let cursor = 0;
  const pushText = (value: string) => {
    if (!value) return;
    const last = segments[segments.length - 1];
    if (last?.type === 'text') {
      last.value += value;
    } else {
      segments.push({ type: 'text', value });
    }
  };

  for (const match of text.matchAll(BRACKET_RE)) {
    const start = match.index ?? 0;
    const items = parseCitationContent(match[1]);
    pushText(text.slice(cursor, start));
    if (items) {
      segments.push({ type: 'citation', raw: match[0], items });
    } else {
      pushText(match[0]);
    }
    cursor = start + match[0].length;
  }
  pushText(text.slice(cursor));
  return segments;
};
