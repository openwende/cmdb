/**
 * 解析 AI 回答里的依据引用，例如：
 *
 * - `[record_id=895]`、`[record_id=700、701]`、`[record_id=800~802]`（范围只取两端）
 * - `[host_id=43, record_id=612]`（同一方括号多个 key）
 * - `[doc=主机流转规则#回收到资源池]`（值取到 `]` 为止，标题里可以有顿号、逗号）
 * - `[business_id=1029]`、`[module_id=89]`、`[set_id=38]`、`[directory_id=2]`
 * - `[ip=10.20.1.11, since=2026-09-01]`：只有查询条件的方括号，整体当作查询范围显示
 *
 * 同一方括号里的多个 key 只在「分隔符 + 下一个 `xxx=`」处断开；
 * 不是 `key=value` 形式的方括号内容原样保留。
 */

export type CitationIdKind = 'record' | 'host' | 'business' | 'module' | 'set' | 'directory';

export type CitationItem =
  | { kind: CitationIdKind; id: string }
  | { kind: 'doc'; id: string }
  /** 认得出是 key=value，但不是已知 key（多是查询条件）或值不合法：显示原文 */
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

const ID_KINDS: Record<string, CitationIdKind> = {
  record_id: 'record',
  host_id: 'host',
  business_id: 'business',
  module_id: 'module',
  set_id: 'set',
  directory_id: 'directory',
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
 * 至少要有一个已知的 ID 或 doc；或者每一项都是查询条件（key 不是 ID 类的 key），
 * 例如 `[ip=10.20.1.11, since=2026-09-01]`。`[record_id=abc]` 这类值不合法的 ID 不算。
 */
export const parseCitationContent = (content: string): CitationItem[] | null => {
  if (!KEY_VALUE_RE.test(content.trim())) return null;
  const parts = content.split(PART_SPLIT_RE);
  const items = parts.flatMap(parsePart);
  if (items.some((item) => item.kind !== 'other')) return items;
  const queryOnly = parts.every((part) => {
    const match = part.trim().match(KEY_VALUE_RE);
    return match && match[2].trim() && !(match[1].toLowerCase() in ID_KINDS);
  });
  return queryOnly ? items : null;
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

/** 依据的去重键，例如 `module-97` */
export const citationKey = (item: CitationItem): string | null =>
  item.kind === 'other' ? null : `${item.kind}-${item.id}`;

const ID_RANGE_RE = /([a-z_]+_id)\s*=\s*(\d+)\s*[~～\-–]\s*(\d+)/gi;
/** 范围展开的上限，防止异常的大范围 */
const MAX_RANGE_SPAN = 500;

/** 一段文字里方括号依据的去重键；范围（`[host_id=56~59]`）按全部 ID 计，显示时仍只取两端 */
export const collectCitationKeys = (text: string): Set<string> => {
  const keys = new Set<string>();
  for (const segment of parseCitations(text)) {
    if (segment.type !== 'citation') continue;
    for (const item of segment.items) {
      const key = citationKey(item);
      if (key) keys.add(key);
    }
    for (const [, name, from, to] of segment.raw.matchAll(ID_RANGE_RE)) {
      const kind = ID_KINDS[name.toLowerCase()];
      const start = Number(from);
      const end = Number(to);
      if (!kind || end < start || end - start > MAX_RANGE_SPAN) continue;
      for (let id = start; id <= end; id += 1) keys.add(`${kind}-${id}`);
    }
  }
  return keys;
};

const PAREN_RE = /([（(])([^（）()\n]*)([)）])/g;
const INLINE_PART_SPLIT_RE = /\s*[,，;；]\s*/;

/**
 * 模型有时把 ID 写在正文括号里，而不是方括号依据里，例如
 * `支付网关（module_id=97）`、`10.20.1.11（pay-gw-01，host_id=43）`。
 * 把括号里的 ID 抽出来改写成方括号依据，放在括号后面，括号里的其他内容保留，括号空了就去掉；
 * 同一段里已经有同样的方括号依据时直接去掉，不重复显示。
 */
export const rewriteInlineIds = (text: string, existing: ReadonlySet<string>): string =>
  text.replace(PAREN_RE, (whole, open: string, inner: string, close: string) => {
    const kept: string[] = [];
    const citations: string[] = [];
    let found = false;
    for (const part of inner.split(INLINE_PART_SPLIT_RE)) {
      const match = part.trim().match(KEY_VALUE_RE);
      const kind = match ? ID_KINDS[match[1].toLowerCase()] : undefined;
      const ids = match && kind ? parseIds(match[2]) : null;
      if (!match || !kind || !ids) {
        if (part.trim()) kept.push(part.trim());
        continue;
      }
      found = true;
      const fresh = ids.filter((id) => !existing.has(`${kind}-${id}`));
      if (fresh.length > 0) citations.push(`[${match[1].toLowerCase()}=${fresh.join('、')}]`);
    }
    if (!found) return whole;
    const separator = open === '（' ? '，' : ', ';
    const rest = kept.length > 0 ? `${open}${kept.join(separator)}${close}` : '';
    return `${rest}${citations.join('')}`;
  });
