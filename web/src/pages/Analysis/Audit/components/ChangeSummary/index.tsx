import React from 'react';
import { Tag, Tooltip } from 'antd';
import { AUDIT_FLOW_TAG_COLORS, type AuditChangeSummary } from '@/pages/Analysis/auditChange';
import './style.css';

export interface ChangeSummaryProps {
  summary: AuditChangeSummary;
}

/** 列表和移动端卡片里的"变更内容"：流转带类型标签，过长省略，悬停显示全文 */
const ChangeSummary: React.FC<ChangeSummaryProps> = ({ summary }) => (
  <Tooltip title={summary.kind === 'none' ? undefined : summary.fullText} placement="topLeft">
    <span className="audit-change-summary">
      {summary.kind === 'flow' && (
        <Tag className="audit-change-summary__tag" color={AUDIT_FLOW_TAG_COLORS[summary.flow.type]}>
          {summary.flow.label}
        </Tag>
      )}
      <span className="audit-change-summary__text">{summary.text}</span>
    </span>
  </Tooltip>
);

export default ChangeSummary;
