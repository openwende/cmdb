import React, { useEffect, useState } from 'react';
import { Popover, Spin, Tag } from 'antd';
import { BookOutlined, DesktopOutlined, FileSearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { getKnowledgeSection } from '@/api/services/aiChat';
import type { AIKnowledgeSection } from '@/api/types/aiChat';
import {
  getAuditRecordPath,
  getHostDetailNavigationState,
  getHostDetailPath,
} from '@/utils/routes';
import type { CitationItem } from './citations';
import { BASE_REMARK_PLUGINS } from './markdownPlugins';

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
          <ReactMarkdown remarkPlugins={BASE_REMARK_PLUGINS}>{state.section.content}</ReactMarkdown>
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
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen || state.status === 'success' || state.status === 'loading') return;
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

  // 气泡打开时 Esc 只关气泡，不连带关 AI 抽屉（抽屉在自己的面板上监听 Esc）。
  // 监听挂在 document 的捕获阶段：点过气泡正文后焦点落在 body，keydown 不经过
  // 这个组件，挂在组件上的 onKeyDown 收不到；捕获阶段先于抽屉处理，在这里拦下。
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open]);

  return (
    <span className="ai-citation-doc">
      <Popover
        trigger="click"
        placement="left"
        open={open}
        content={<KnowledgeSectionContent state={state} />}
        onOpenChange={handleOpenChange}
        overlayClassName="ai-knowledge-popover"
      >
        <Tag
          color="purple"
          icon={<BookOutlined />}
          className="ai-citation ai-citation--link ai-citation--doc"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          title={t('aiAssistant.citation.docTip')}
        >
          {id}
        </Tag>
      </Popover>
    </span>
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

/**
 * 主机引用：跳到主机资源页的详情深链，AI 抽屉保持打开。
 * state 记下点击时所在的页面：在主机页上点的，关闭抽屉时退回打开前那条记录，不留重复记录。
 */
const HostCitation: React.FC<{ id: string }> = ({ id }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const open = () =>
    navigate(getHostDetailPath(id), { state: getHostDetailNavigationState(pathname) });
  return (
    <Tag
      icon={<DesktopOutlined />}
      className="ai-citation ai-citation--link"
      role="link"
      tabIndex={0}
      title={t('aiAssistant.citation.hostTip')}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      {t('aiAssistant.citation.host', { id })}
    </Tag>
  );
};

const CitationTag: React.FC<{ item: CitationItem }> = ({ item }) => {
  switch (item.kind) {
    case 'record':
      return <RecordCitation id={item.id} />;
    case 'doc':
      return <DocCitation id={item.id} />;
    case 'host':
      return <HostCitation id={item.id} />;
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
