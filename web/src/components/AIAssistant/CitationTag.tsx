import React, { useEffect, useState } from 'react';
import { Popover, Spin, Tag } from 'antd';
import {
  ApartmentOutlined,
  BookOutlined,
  ClusterOutlined,
  DeploymentUnitOutlined,
  DesktopOutlined,
  FileSearchOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { getKnowledgeSection } from '@/api/services/aiChat';
import { getTopologyModule, getTopologySet } from '@/api/services/business';
import type { AIKnowledgeSection } from '@/api/types/aiChat';
import { useAppMessage } from '@/utils/message';
import {
  getAuditRecordPath,
  getBusinessTopologyPath,
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
      color="blue"
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

/** 拓扑页据此不清空 URL 里的 node 参数（切换业务时默认会清空） */
const TOPOLOGY_KEEP_PARAMS_STATE = { keepTopologyParams: true } as const;

type TopologyNodeKind = 'module' | 'set';

const NODE_LOADERS = { module: getTopologyModule, set: getTopologySet };

// 模块 / 集群 → 所属业务，同一节点在一次页面会话里只查一次
const nodeCache = new Map<
  string,
  Promise<{ data: { business_id: number; is_default?: boolean } }>
>();

const loadNode = (kind: TopologyNodeKind, id: string) => {
  const cacheKey = `${kind}-${id}`;
  let pending = nodeCache.get(cacheKey);
  if (!pending) {
    pending = NODE_LOADERS[kind](id);
    nodeCache.set(cacheKey, pending);
    pending.catch(() => nodeCache.delete(cacheKey));
  }
  return pending;
};

/**
 * 拓扑树里节点的 key：空闲机池是 idle_set-<id>，空闲机模块是 idle_module-<id>，
 * 其余（含故障机、待回收）是 set-<id> / module-<id>
 */
const getNodeKey = (kind: TopologyNodeKind, id: string, isDefault?: boolean) =>
  `${isDefault ? `idle_${kind}` : kind}-${id}`;

/** 业务引用：跳到业务拓扑，AI 抽屉保持打开 */
const BusinessCitation: React.FC<{ id: string }> = ({ id }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const open = () => navigate(getBusinessTopologyPath(id), { state: TOPOLOGY_KEEP_PARAMS_STATE });
  return (
    <Tag
      color="blue"
      icon={<ApartmentOutlined />}
      className="ai-citation ai-citation--link"
      role="link"
      tabIndex={0}
      title={t('aiAssistant.citation.businessTip')}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      {t('aiAssistant.citation.business', { id })}
    </Tag>
  );
};

/** 模块 / 集群引用：先查所属业务，再跳到业务拓扑并选中这个节点（模块右侧就是它的主机列表） */
const TopologyNodeCitation: React.FC<{ kind: TopologyNodeKind; id: string }> = ({ kind, id }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const message = useAppMessage();
  const [loading, setLoading] = useState(false);

  const open = () => {
    if (loading) return;
    setLoading(true);
    loadNode(kind, id)
      .then(({ data }) => {
        const search = new URLSearchParams({ node: getNodeKey(kind, id, data.is_default) });
        navigate(`${getBusinessTopologyPath(data.business_id)}?${search}`, {
          state: TOPOLOGY_KEEP_PARAMS_STATE,
        });
      })
      .catch(() => message.error(t(`aiAssistant.citation.${kind}NotFound`)))
      .finally(() => setLoading(false));
  };

  const icon = kind === 'module' ? <ClusterOutlined /> : <DeploymentUnitOutlined />;
  return (
    <Tag
      color="blue"
      icon={loading ? <LoadingOutlined /> : icon}
      className="ai-citation ai-citation--link"
      role="link"
      tabIndex={0}
      aria-busy={loading}
      title={t(`aiAssistant.citation.${kind}Tip`)}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      }}
    >
      {t(`aiAssistant.citation.${kind}`, { id })}
    </Tag>
  );
};

/** 不跳转的依据（资源池目录、查询条件）：灰色小字，不用标签样式，免得以为能点 */
const PlainCitation: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="ai-citation-plain">{children}</span>
);

const PlainCitationLabel: React.FC<{ id: string }> = ({ id }) => {
  const { t } = useTranslation();
  return <PlainCitation>{t('aiAssistant.citation.directory', { id })}</PlainCitation>;
};

const CitationTag: React.FC<{ item: CitationItem }> = ({ item }) => {
  switch (item.kind) {
    case 'record':
      return <RecordCitation id={item.id} />;
    case 'doc':
      return <DocCitation id={item.id} />;
    case 'host':
      return <HostCitation id={item.id} />;
    case 'business':
      return <BusinessCitation id={item.id} />;
    case 'module':
    case 'set':
      return <TopologyNodeCitation kind={item.kind} id={item.id} />;
    case 'directory':
      return <PlainCitationLabel id={item.id} />;
    default:
      return <PlainCitation>{item.text}</PlainCitation>;
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
