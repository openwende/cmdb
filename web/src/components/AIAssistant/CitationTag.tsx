import React, { useState } from 'react';
import { Popover, Spin, Tag } from 'antd';
import { BookOutlined, DesktopOutlined, FileSearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getKnowledgeSection } from '@/api/services/aiChat';
import type { AIKnowledgeSection } from '@/api/types/aiChat';
import { getAuditRecordPath } from '@/utils/routes';
import type { CitationItem } from './citations';

// 同一小节在一次页面会话里只请求一次
const sectionCache = new Map<string, Promise<AIKnowledgeSection>>();

const loadSection = (id: string) => {
  let pending = sectionCache.get(id);
  if (!pending) {
    pending = getKnowledgeSection(id);
    sectionCache.set(id, pending);
    // 失败的不缓存，下次点开可以重试
    pending.catch(() => sectionCache.delete(id));
  }
  return pending;
};

type SectionState =
  | { status: 'idle' | 'loading' }
  | { status: 'success'; section: AIKnowledgeSection }
  | { status: 'error'; errorKey: string };

const KnowledgeSectionContent: React.FC<{ state: SectionState }> = ({ state }) => {
  const { t } = useTranslation();
  if (state.status === 'success') {
    return (
      <div className="ai-knowledge-section">
        <div className="ai-knowledge-section__title">
          {state.section.doc} / {state.section.title}
        </div>
        <div className="ai-knowledge-section__content ai-markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{state.section.content}</ReactMarkdown>
        </div>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="ai-knowledge-section ai-knowledge-section--error">{t(state.errorKey)}</div>
    );
  }
  return (
    <div className="ai-knowledge-section ai-knowledge-section--loading">
      <Spin size="small" />
    </div>
  );
};

const DocCitation: React.FC<{ id: string }> = ({ id }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<SectionState>({ status: 'idle' });

  const handleOpenChange = (open: boolean) => {
    if (!open || state.status === 'success' || state.status === 'loading') return;
    setState({ status: 'loading' });
    loadSection(id)
      .then((section) => setState({ status: 'success', section }))
      .catch((error: { response?: { status?: number } }) =>
        setState({
          status: 'error',
          errorKey:
            error?.response?.status === 404
              ? 'aiAssistant.knowledge.notFound'
              : 'aiAssistant.knowledge.loadFailed',
        }),
      );
  };

  return (
    <Popover
      trigger="click"
      placement="left"
      content={<KnowledgeSectionContent state={state} />}
      onOpenChange={handleOpenChange}
      overlayClassName="ai-knowledge-popover"
    >
      <Tag
        color="purple"
        icon={<BookOutlined />}
        className="ai-citation ai-citation--link"
        role="button"
        tabIndex={0}
        title={t('aiAssistant.citation.docTip')}
      >
        {id}
      </Tag>
    </Popover>
  );
};

const RecordCitation: React.FC<{ id: string }> = ({ id }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = () => navigate(getAuditRecordPath(id));
  return (
    <Tag
      color="blue"
      icon={<FileSearchOutlined />}
      className="ai-citation ai-citation--link"
      role="link"
      tabIndex={0}
      title={t('aiAssistant.citation.recordTip')}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      {t('aiAssistant.citation.record', { id })}
    </Tag>
  );
};

const CitationTag: React.FC<{ item: CitationItem }> = ({ item }) => {
  const { t } = useTranslation();
  switch (item.kind) {
    case 'record':
      return <RecordCitation id={item.id} />;
    case 'doc':
      return <DocCitation id={item.id} />;
    case 'host':
      return (
        <Tag
          icon={<DesktopOutlined />}
          className="ai-citation"
          title={t('aiAssistant.citation.hostTip')}
        >
          {t('aiAssistant.citation.host', { id: item.id })}
        </Tag>
      );
    default:
      return <Tag className="ai-citation">{item.text}</Tag>;
  }
};

export const CitationGroup: React.FC<{ items: CitationItem[] }> = ({ items }) => (
  <span className="ai-citation-group">
    {items.map((item, index) => (
      <CitationTag
        key={`${item.kind}-${'id' in item ? item.id : item.text}-${index}`}
        item={item}
      />
    ))}
  </span>
);

export default CitationTag;
