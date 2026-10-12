import { parseCitations } from './citations';

/**
 * remark 插件：把文本节点里的 `[record_id=895]` 这类引用换成
 * `<span data-citation="...">` 元素，由 Markdown 渲染器的 `span` 组件画成标签。
 * 只处理 text 节点，代码块 / 行内代码里的方括号不动。
 */

interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

export const CITATION_PROPERTY = 'dataCitation';

const transformChildren = (parent: MdNode) => {
  if (!parent.children) return;
  const next: MdNode[] = [];
  for (const child of parent.children) {
    if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('[')) {
      for (const segment of parseCitations(child.value)) {
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
    } else {
      transformChildren(child);
      next.push(child);
    }
  }
  parent.children = next;
};

const remarkCitations = () => (tree: MdNode) => {
  transformChildren(tree);
};

export default remarkCitations;
