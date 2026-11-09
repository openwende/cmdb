import { collectCitationKeys, parseCitations, rewriteInlineIds } from './citations';

/**
 * remark 插件：把文本节点里的 `[record_id=895]` 这类引用换成
 * `<span data-citation="...">` 元素，由 Markdown 渲染器的 `span` 组件画成标签。
 * 只处理 text 节点，代码块 / 行内代码里的方括号不动。
 * 正文括号里的 ID（`支付网关（module_id=97）`）先改写成方括号依据，同一段里已有的不重复。
 */

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

export const CITATION_PROPERTY = 'dataCitation';

/** 按段落（标题、表格单元格）去重：同一段里已有方括号依据的 ID，正文括号里的就不再显示 */
const BLOCK_TYPES = new Set(['paragraph', 'heading', 'tableCell']);

const collectText = (node: MdNode): string =>
  node.type === 'text' ? (node.value ?? '') : (node.children ?? []).map(collectText).join('');

const transformChildren = (parent: MdNode, inherited?: ReadonlySet<string>) => {
  if (!parent.children) return;
  const existing = BLOCK_TYPES.has(parent.type)
    ? collectCitationKeys(collectText(parent))
    : inherited;
  const next: MdNode[] = [];
  for (const child of parent.children) {
    const value =
      child.type === 'text' && typeof child.value === 'string'
        ? rewriteInlineIds(child.value, existing ?? new Set())
        : undefined;
    if (value !== undefined && value.includes('[')) {
      for (const segment of parseCitations(value)) {
        if (segment.type === 'text') {
          next.push({ type: 'text', value: segment.value });
        } else {
          next.push({
            type: 'aiCitation',
            children: [{ type: 'text', value: segment.raw }],
            data: {
              hName: 'span',
              hProperties: { [CITATION_PROPERTY]: JSON.stringify(segment.items) },
            },
          });
        }
      }
    } else if (value !== undefined) {
      next.push({ ...child, value });
    } else {
      transformChildren(child, existing);
      next.push(child);
    }
  }
  parent.children = next;
};

const remarkCitations = () => (tree: MdNode) => {
  transformChildren(tree);
};

export default remarkCitations;
