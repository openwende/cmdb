/**
 * 把回答按提示词规定的四个小节（结论 / 查到的事实 / 待核查 / 缺失证据）切开，
 * 供展示时分节折叠。认不出结构（拒答、越权提示等）时返回 null，照原样渲染。
 */

export const ANSWER_SECTION_TITLES = ['结论', '查到的事实', '待核查', '缺失证据'] as const;

export type AnswerSectionTitle = (typeof ANSWER_SECTION_TITLES)[number];

export interface AnswerSection {
  title: AnswerSectionTitle;
  /** 小节正文（Markdown），不含标题行 */
  body: string;
}

export interface ParsedAnswer {
  /** 第一个小节标题之前的内容 */
  preamble: string;
  sections: AnswerSection[];
}

const SECTION_HEADING = new RegExp(
  `^#{2,4}\\s*(${ANSWER_SECTION_TITLES.join('|')})\\s*[:：]?\\s*$`,
);
const FENCE = /^\s*(```|~~~)/;
const LIST_ITEM = /^(?:[-*+]|\d+[.)])\s+/;

export const splitAnswerSections = (content: string): ParsedAnswer | null => {
  const preamble: string[] = [];
  const sections: { title: AnswerSectionTitle; lines: string[] }[] = [];
  let inFence = false;

  for (const line of content.split('\n')) {
    if (FENCE.test(line)) inFence = !inFence;
    const match = inFence ? null : SECTION_HEADING.exec(line.trim());
    if (match) {
      sections.push({ title: match[1] as AnswerSectionTitle, lines: [] });
    } else {
      (sections.length > 0 ? sections[sections.length - 1].lines : preamble).push(line);
    }
  }

  // 至少两个小节、且不重复，才当作结构化回答
  const titles = new Set(sections.map((section) => section.title));
  if (sections.length < 2 || titles.size !== sections.length) return null;

  return {
    preamble: preamble.join('\n').trim(),
    sections: sections.map((section) => ({
      title: section.title,
      body: section.lines.join('\n').trim(),
    })),
  };
};

/** 把小节正文拆成"列表前的文字"和顶层列表项；列表项的续行归到所在项 */
export const splitTopLevelItems = (body: string): { head: string; items: string[] } => {
  const head: string[] = [];
  const items: string[][] = [];
  for (const line of body.split('\n')) {
    if (LIST_ITEM.test(line)) items.push([line]);
    else if (items.length > 0) items[items.length - 1].push(line);
    else head.push(line);
  }
  return {
    head: head.join('\n').trim(),
    items: items.map((lines) => lines.join('\n').trimEnd()),
  };
};

/** 提示词要求"某一节没有内容时写'无'" */
export const isEmptySection = (body: string): boolean => /^(无|暂无)[。.]?$/.test(body.trim());
