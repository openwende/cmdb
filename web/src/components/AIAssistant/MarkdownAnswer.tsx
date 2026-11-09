import React, { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkCitations, { CITATION_PROPERTY } from './remarkCitations';
import { BASE_REMARK_PLUGINS } from './markdownPlugins';
import { CitationGroup } from './CitationTag';
import type { CitationItem } from './citations';

const parseItems = (value: unknown): CitationItem[] | null => {
  if (typeof value !== 'string') return null;
  try {
    const items = JSON.parse(value);
    return Array.isArray(items) ? (items as CitationItem[]) : null;
  } catch {
    return null;
  }
};

const components: Components = {
  span: ({ node, children, ...props }) => {
    const items = parseItems(node?.properties?.[CITATION_PROPERTY]);
    if (items) return <CitationGroup items={items} />;
    return <span {...props}>{children}</span>;
  },
  // 表格放进可横向滚动的容器，抽屉窄时不把列挤到一个字一行
  table: ({ node: _node, children, ...props }) => (
    <div className="ai-markdown__table">
      <table {...props}>{children}</table>
    </div>
  ),
  a: ({ node: _node, children, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

// remark-breaks 只用于回答：模型常用单个换行分隔要分开的行（"字段：值" 逐行列出），
// CommonMark 会把它合并成一段。知识库原文按标准 CommonMark 渲染，不加。
const REMARK_PLUGINS = [...BASE_REMARK_PLUGINS, remarkBreaks, remarkCitations];

/** 助手回答：Markdown + 依据引用标签 */
const MarkdownAnswer: React.FC<{ content: string }> = ({ content }) => (
  <div className="ai-markdown">
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} components={components}>
      {content}
    </ReactMarkdown>
  </div>
);

export default memo(MarkdownAnswer);
