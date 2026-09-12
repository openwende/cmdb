import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import './style.css';

/* ═══════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════ */

type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
type ResourceType = 'host' | 'database' | 'cache' | 'app' | 'network' | 'workload' | 'business';
type LayerFilter = 'all' | 'business' | 'service' | 'infra';
type CenterView = 'summary' | 'path';

interface DepNode {
  id: string;
  name: string;
  type: ResourceType;
  severity: RiskLevel;
  edgeType: string | null;
  edgeLabel?: string;
  children: DepNode[];
}

interface ImpactBusiness {
  name: string;
  bizId: string;
  severity: RiskLevel;
  desc: string;
}

interface ImpactService {
  name: string;
  type: ResourceType;
  severity: RiskLevel;
  desc: string;
}

interface Suggestion {
  order: number;
  action: string;
  detail: string;
  urgent: boolean;
}

interface AnalysisObject {
  id: string;
  type: ResourceType;
  name: string;
  displayName: string;
  meta: string;
  riskLevel: RiskLevel;
  recentlyUsed?: boolean;
  riskSummary: {
    affectedBusinesses: number;
    affectedServices: number;
    highRiskPaths: number;
    suggestedWindow: string;
  };
  impactedBusinesses: ImpactBusiness[];
  impactedServices: ImpactService[];
  depTree: DepNode;
  suggestions: Suggestion[];
}

/* ═══════════════════════════════════════════════════════════
   Mock Data
   ═══════════════════════════════════════════════════════════ */

const ANALYSIS_OBJECTS: AnalysisObject[] = [
  {
    id: 'host-10-0-1-100',
    type: 'host',
    name: 'host:10.0.1.100',
    displayName: '10.0.1.100',
    meta: '华北A · 在线业务 · online',
    riskLevel: 'high',
    recentlyUsed: true,
    riskSummary: {
      affectedBusinesses: 2,
      affectedServices: 5,
      highRiskPaths: 3,
      suggestedWindow: '凌晨 02:00–04:00',
    },
    impactedBusinesses: [
      {
        name: '王者荣耀',
        bizId: 'BIZ-2014',
        severity: 'critical',
        desc: '核心数据库主库依赖此主机，全服认证链路受影响',
      },
      { name: '原神', bizId: 'BIZ-2048', severity: 'medium', desc: '缓存集群节点之一，可降级运行' },
    ],
    impactedServices: [
      {
        name: 'mysql:account-db-primary',
        type: 'database',
        severity: 'critical',
        desc: '主库单点，无自动 failover',
      },
      {
        name: 'redis:cache-east-1',
        type: 'cache',
        severity: 'medium',
        desc: '集群节点，其余节点可承接',
      },
      {
        name: 'account-service',
        type: 'app',
        severity: 'high',
        desc: '直接依赖 account-db，认证链路断路',
      },
      { name: 'matchmaker', type: 'app', severity: 'low', desc: '间接依赖，有降级备案' },
      {
        name: 'gateway-public',
        type: 'network',
        severity: 'low',
        desc: '部分流量受影响，短暂降级',
      },
    ],
    depTree: {
      id: 'root-host',
      name: 'host:10.0.1.100',
      type: 'host',
      severity: 'high',
      edgeType: null,
      edgeLabel: undefined,
      children: [
        {
          id: 'mysql-primary',
          name: 'mysql:account-db-primary',
          type: 'database',
          severity: 'critical',
          edgeType: 'runs_on',
          edgeLabel: '承载',
          children: [
            {
              id: 'account-svc',
              name: 'account-service',
              type: 'app',
              severity: 'high',
              edgeType: 'depends_on',
              edgeLabel: '依赖',
              children: [
                {
                  id: 'biz-wzry',
                  name: '王者荣耀',
                  type: 'business',
                  severity: 'critical',
                  edgeType: 'belongs_to',
                  edgeLabel: '归属',
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: 'redis-cache',
          name: 'redis:cache-east-1',
          type: 'cache',
          severity: 'medium',
          edgeType: 'runs_on',
          edgeLabel: '承载',
          children: [
            {
              id: 'biz-genshin',
              name: '原神',
              type: 'business',
              severity: 'medium',
              edgeType: 'belongs_to',
              edgeLabel: '归属',
              children: [],
            },
          ],
        },
      ],
    },
    suggestions: [
      {
        order: 1,
        action: '确认主从复制状态',
        detail: '登录数据库确认 slave 延迟 < 1s，再推进下一步',
        urgent: true,
      },
      {
        order: 2,
        action: '提前执行主从切换',
        detail: '将 account-db-replica 提升为主库，提前联系 DBA',
        urgent: true,
      },
      {
        order: 3,
        action: '通知业务方值班',
        detail: '王者荣耀 + 原神值班同步变更计划和影响窗口',
        urgent: false,
      },
      {
        order: 4,
        action: '确认变更窗口',
        detail: '建议凌晨 02:00–04:00 避开日活高峰',
        urgent: false,
      },
    ],
  },
  {
    id: 'mysql-account-db',
    type: 'database',
    name: 'mysql:account-db-primary',
    displayName: 'account-db-primary',
    meta: '王者荣耀 · 数据服务 · RDS',
    riskLevel: 'critical',
    recentlyUsed: true,
    riskSummary: {
      affectedBusinesses: 1,
      affectedServices: 3,
      highRiskPaths: 4,
      suggestedWindow: '凌晨 03:00–05:00',
    },
    impactedBusinesses: [
      {
        name: '王者荣耀',
        bizId: 'BIZ-2014',
        severity: 'critical',
        desc: '全服账号认证依赖此主库，核心单点',
      },
    ],
    impactedServices: [
      { name: 'account-service', type: 'app', severity: 'critical', desc: '直接依赖，认证链路' },
      { name: 'matchmaker', type: 'app', severity: 'high', desc: '登录验证通过后才能进入匹配' },
      { name: 'game-server', type: 'app', severity: 'medium', desc: '会话令牌由认证服务生成' },
    ],
    depTree: {
      id: 'root-mysql',
      name: 'mysql:account-db-primary',
      type: 'database',
      severity: 'critical',
      edgeType: null,
      edgeLabel: undefined,
      children: [
        {
          id: 'account-svc-2',
          name: 'account-service',
          type: 'app',
          severity: 'critical',
          edgeType: 'depends_on',
          edgeLabel: '依赖',
          children: [
            {
              id: 'matchmaker-2',
              name: 'matchmaker',
              type: 'app',
              severity: 'high',
              edgeType: 'depends_on',
              edgeLabel: '依赖',
              children: [
                {
                  id: 'gamesvr-2',
                  name: 'game-server',
                  type: 'app',
                  severity: 'medium',
                  edgeType: 'depends_on',
                  edgeLabel: '依赖',
                  children: [],
                },
              ],
            },
          ],
        },
        {
          id: 'host-carrier',
          name: 'host:10.0.1.100',
          type: 'host',
          severity: 'high',
          edgeType: 'runs_on',
          edgeLabel: '运行于',
          children: [],
        },
      ],
    },
    suggestions: [
      {
        order: 1,
        action: '检查副本延迟',
        detail: 'SHOW SLAVE STATUS 确认 Seconds_Behind_Master = 0',
        urgent: true,
      },
      {
        order: 2,
        action: '关闭写入开关',
        detail: '在业务层关闭写入，避免主从切换期间数据不一致',
        urgent: true,
      },
      {
        order: 3,
        action: '提升副本为主库',
        detail: '在 RDS 控制台完成 failover 操作，预计 30 秒',
        urgent: false,
      },
      {
        order: 4,
        action: '验证应用连接',
        detail: '确认 account-service 已切换到新主库连接串',
        urgent: false,
      },
    ],
  },
  {
    id: 'k8s-game-server',
    type: 'workload',
    name: 'k8s_workload:game-server',
    displayName: 'game-server',
    meta: '华东区 · 在线业务 · 32 pods',
    riskLevel: 'medium',
    riskSummary: {
      affectedBusinesses: 1,
      affectedServices: 2,
      highRiskPaths: 1,
      suggestedWindow: '凌晨 01:00–03:00',
    },
    impactedBusinesses: [
      {
        name: '崩坏：星穹铁道',
        bizId: 'BIZ-3001',
        severity: 'medium',
        desc: '核心战斗服务，重启期间有 30s 不可用',
      },
    ],
    impactedServices: [
      {
        name: 'scene-manager',
        type: 'app',
        severity: 'medium',
        desc: '场景管理服务依赖游戏服 RPC',
      },
      {
        name: 'match-engine',
        type: 'app',
        severity: 'low',
        desc: '匹配完成后推送给游戏服，有重试',
      },
    ],
    depTree: {
      id: 'root-k8s',
      name: 'k8s_workload:game-server',
      type: 'workload',
      severity: 'medium',
      edgeType: null,
      edgeLabel: undefined,
      children: [
        {
          id: 'scene-mgr',
          name: 'scene-manager',
          type: 'app',
          severity: 'medium',
          edgeType: 'depends_on',
          edgeLabel: '依赖',
          children: [
            {
              id: 'biz-hsr',
              name: '崩坏：星穹铁道',
              type: 'business',
              severity: 'medium',
              edgeType: 'belongs_to',
              edgeLabel: '归属',
              children: [],
            },
          ],
        },
        {
          id: 'match-engine-k8s',
          name: 'match-engine',
          type: 'app',
          severity: 'low',
          edgeType: 'notifies',
          edgeLabel: '推送',
          children: [],
        },
      ],
    },
    suggestions: [
      {
        order: 1,
        action: '确认 Pod 滚动更新策略',
        detail: 'maxUnavailable=1，rolling update 期间最多 1 个 pod 不可用',
        urgent: false,
      },
      {
        order: 2,
        action: '通知场景管理服务',
        detail: '预告重启窗口，scene-manager 需启用缓存缓冲',
        urgent: false,
      },
      {
        order: 3,
        action: '监控 match-engine 队列积压',
        detail: '重启期间观察队列深度，超 200 需暂停匹配',
        urgent: false,
      },
    ],
  },
];

/* ═══════════════════════════════════════════════════════════
   Helper Components
   ═══════════════════════════════════════════════════════════ */

const RISK_CONFIG: Record<RiskLevel, { label: string; color: string; bg: string; dot: string }> = {
  critical: { label: '严重', color: '#b91c1c', bg: '#fef2f2', dot: '#ef4444' },
  high: { label: '高', color: '#c2410c', bg: '#fff7ed', dot: '#f97316' },
  medium: { label: '中', color: '#b45309', bg: '#fffbeb', dot: '#f59e0b' },
  low: { label: '低', color: '#15803d', bg: '#f0fdf4', dot: '#22c55e' },
};

const TYPE_CONFIG: Record<ResourceType, { icon: string; label: string }> = {
  host: { icon: '⬜', label: '主机' },
  database: { icon: '◉', label: '数据库' },
  cache: { icon: '◈', label: '缓存' },
  app: { icon: '◆', label: '应用' },
  network: { icon: '◇', label: '网络' },
  workload: { icon: '⬡', label: '工作负载' },
  business: { icon: '★', label: '业务' },
};

const RiskBadge: React.FC<{ level: RiskLevel }> = ({ level }) => {
  const cfg = RISK_CONFIG[level];
  return (
    <span className="ia-risk-badge" style={{ color: cfg.color, background: cfg.bg }}>
      <span className="ia-risk-badge__dot" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
};

const TypeIcon: React.FC<{ type: ResourceType; size?: 'sm' | 'md' }> = ({ type, size = 'sm' }) => {
  const cfg = TYPE_CONFIG[type];
  return (
    <span className={`ia-type-icon ia-type-icon--${size} ia-type-icon--${type}`}>{cfg.icon}</span>
  );
};

/* ═══════════════════════════════════════════════════════════
   Dependency Tree Node
   ═══════════════════════════════════════════════════════════ */

const DepTreeNode: React.FC<{
  node: DepNode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  isLast?: boolean;
}> = ({ node, depth, expandedIds, onToggle, isLast = false }) => {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const riskCfg = RISK_CONFIG[node.severity];

  return (
    <div className="ia-dep-node" data-last={isLast}>
      {node.edgeType && (
        <div className="ia-dep-edge" style={{ '--depth': depth } as React.CSSProperties}>
          <span className="ia-dep-edge__line" />
          <span className="ia-dep-edge__type">{node.edgeLabel ?? node.edgeType}</span>
        </div>
      )}
      <div
        className={`ia-dep-node__row ${hasChildren ? 'ia-dep-node__row--expandable' : ''}`}
        style={{ '--depth': depth } as React.CSSProperties}
        onClick={() => hasChildren && onToggle(node.id)}
        role={hasChildren ? 'button' : undefined}
        tabIndex={hasChildren ? 0 : undefined}
      >
        {hasChildren && <span className="ia-dep-node__chevron">{isExpanded ? '▾' : '▸'}</span>}
        {!hasChildren && (
          <span className="ia-dep-node__bullet" style={{ background: riskCfg.dot }} />
        )}
        <TypeIcon type={node.type} />
        <span className="ia-dep-node__name">{node.name}</span>
        <RiskBadge level={node.severity} />
        <span className="ia-dep-node__type-label">{TYPE_CONFIG[node.type].label}</span>
      </div>
      {hasChildren && isExpanded && (
        <div className="ia-dep-node__children">
          {node.children.map((child, idx) => (
            <DepTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              isLast={idx === node.children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════ */

const ImpactAnalysisPrototype: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>(ANALYSIS_OBJECTS[0].id);
  const [searchValue, setSearchValue] = useState('');
  const [centerView, setCenterView] = useState<CenterView>('summary');
  const [layerFilter, setLayerFilter] = useState<LayerFilter>('all');
  const [expandedDepIds, setExpandedDepIds] = useState<Set<string>>(
    () => new Set(['root-host', 'mysql-primary', 'redis-cache']),
  );
  const [analysing, setAnalysing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedObject = useMemo(
    () => ANALYSIS_OBJECTS.find((o) => o.id === selectedId) ?? ANALYSIS_OBJECTS[0],
    [selectedId],
  );

  // Fake analysis loading on object switch
  const handleSelectObject = useCallback(
    (id: string) => {
      if (id === selectedId) return;
      setAnalysing(true);
      setSelectedId(id);
      // Reset dep tree expansion to first two levels
      const obj = ANALYSIS_OBJECTS.find((o) => o.id === id);
      if (obj) {
        const ids = new Set<string>([obj.depTree.id]);
        obj.depTree.children.forEach((c) => ids.add(c.id));
        setExpandedDepIds(ids);
      }
      setCenterView('summary');
      setTimeout(() => setAnalysing(false), 680);
    },
    [selectedId],
  );

  const handleDepToggle = useCallback((id: string) => {
    setExpandedDepIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filteredObjects = useMemo(() => {
    const kw = searchValue.trim().toLowerCase();
    if (!kw) return ANALYSIS_OBJECTS;
    return ANALYSIS_OBJECTS.filter(
      (o) => o.name.toLowerCase().includes(kw) || o.meta.toLowerCase().includes(kw),
    );
  }, [searchValue]);

  const filteredServices = useMemo(() => {
    if (layerFilter === 'all') return selectedObject.impactedServices;
    const layerMap: Record<LayerFilter, ResourceType[]> = {
      all: [],
      business: ['business'],
      service: ['app', 'network'],
      infra: ['host', 'database', 'cache', 'workload'],
    };
    return selectedObject.impactedServices.filter((s) => layerMap[layerFilter].includes(s.type));
  }, [selectedObject, layerFilter]);

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const riskCfg = RISK_CONFIG[selectedObject.riskLevel];

  return (
    <div className="ia-proto">
      {/* Background texture */}
      <div className="ia-proto__noise" aria-hidden />

      {/* ══════ Header ══════ */}
      <header className="ia-proto__header">
        <div className="ia-proto__header-left">
          <p className="ia-proto__eyebrow">Blast Radius Analysis · Impact Analysis Prototype</p>
          <h1 className="ia-proto__headline">变更前先看影响，不再靠经验口口相传。</h1>
          <p className="ia-proto__subline">
            输入需要变更的资源对象，系统沿受控关系边展开依赖范围，输出业务风险摘要和操作建议。
          </p>
        </div>
        <div className="ia-proto__header-right">
          <span className="ia-proto__meta-badge">Hi-Fi Prototype · 影响分析</span>
          <span className="ia-proto__meta-note">Target: 米哈游级别运维协作场景</span>
          <span className="ia-proto__meta-note">本地 mock 数据，交互全功能</span>
        </div>
      </header>

      {/* ══════ Three-column Shell ══════ */}
      <div className="ia-proto__shell">
        {/* ─── Left: Object Rail ─── */}
        <aside className="ia-object-rail" aria-label="分析对象列表">
          <div className="ia-object-rail__head">
            <h3>分析对象</h3>
            <span>选择需要评估影响的资源</span>
          </div>

          <div className="ia-object-rail__search">
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l3.5 3.5" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              placeholder="搜索对象名 / IP…  /"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              aria-label="搜索分析对象"
            />
          </div>

          {ANALYSIS_OBJECTS.some((o) => o.recentlyUsed) && !searchValue && (
            <div className="ia-object-rail__group">
              <span className="ia-object-rail__group-label">最近分析</span>
              {ANALYSIS_OBJECTS.filter((o) => o.recentlyUsed).map((obj) => (
                <button
                  key={obj.id}
                  type="button"
                  className={`ia-object-card ${obj.id === selectedId ? 'ia-object-card--active' : ''}`}
                  onClick={() => handleSelectObject(obj.id)}
                  aria-pressed={obj.id === selectedId}
                >
                  <div className="ia-object-card__top">
                    <TypeIcon type={obj.type} />
                    <span className="ia-object-card__name">{obj.displayName}</span>
                    <RiskBadge level={obj.riskLevel} />
                  </div>
                  <p className="ia-object-card__meta">{obj.meta}</p>
                </button>
              ))}
            </div>
          )}

          <div className="ia-object-rail__group">
            <span className="ia-object-rail__group-label">全部对象</span>
            {filteredObjects.map((obj) => (
              <button
                key={obj.id}
                type="button"
                className={`ia-object-card ${obj.id === selectedId ? 'ia-object-card--active' : ''}`}
                onClick={() => handleSelectObject(obj.id)}
                aria-pressed={obj.id === selectedId}
              >
                <div className="ia-object-card__top">
                  <TypeIcon type={obj.type} />
                  <span className="ia-object-card__name">{obj.displayName}</span>
                  <RiskBadge level={obj.riskLevel} />
                </div>
                <p className="ia-object-card__meta">{obj.meta}</p>
                <div className="ia-object-card__stats">
                  <span>{obj.riskSummary.affectedBusinesses} 个业务</span>
                  <span>·</span>
                  <span>{obj.riskSummary.affectedServices} 处服务</span>
                </div>
              </button>
            ))}
          </div>

          <div className="ia-object-rail__footer">
            <button type="button" className="ia-btn ia-btn--ghost">
              <span>+</span> 输入自定义对象
            </button>
          </div>
        </aside>

        {/* ─── Center: Analysis Surface ─── */}
        <main
          className={`ia-analysis-surface ${analysing ? 'ia-analysis-surface--loading' : ''}`}
          aria-label="影响分析主视图"
          aria-live="polite"
          aria-busy={analysing}
        >
          {/* Object Context Strip */}
          <div className="ia-context-strip">
            <div className="ia-context-strip__left">
              <TypeIcon type={selectedObject.type} size="md" />
              <div>
                <p className="ia-context-strip__eyebrow">当前分析对象</p>
                <h2 className="ia-context-strip__name">{selectedObject.name}</h2>
                <span className="ia-context-strip__meta">{selectedObject.meta}</span>
              </div>
            </div>
            <div className="ia-context-strip__right">
              <RiskBadge level={selectedObject.riskLevel} />
              <span className="ia-context-strip__window">
                建议窗口 {selectedObject.riskSummary.suggestedWindow}
              </span>
            </div>
          </div>

          {/* Risk Summary Strip */}
          <div className="ia-risk-strip">
            <div className="ia-risk-strip__stat">
              <span>影响业务</span>
              <strong style={{ color: riskCfg.color }}>
                {selectedObject.riskSummary.affectedBusinesses}
              </strong>
              <p>个业务系统</p>
            </div>
            <div className="ia-risk-strip__divider" />
            <div className="ia-risk-strip__stat">
              <span>影响服务</span>
              <strong>{selectedObject.riskSummary.affectedServices}</strong>
              <p>处服务依赖</p>
            </div>
            <div className="ia-risk-strip__divider" />
            <div className="ia-risk-strip__stat">
              <span>高风险路径</span>
              <strong style={{ color: RISK_CONFIG.high.color }}>
                {selectedObject.riskSummary.highRiskPaths}
              </strong>
              <p>条需确认</p>
            </div>
            <div className="ia-risk-strip__divider" />
            <div className="ia-risk-strip__stat ia-risk-strip__stat--wide">
              <span>建议操作窗口</span>
              <strong className="ia-risk-strip__window-val">
                {selectedObject.riskSummary.suggestedWindow}
              </strong>
              <p>基于业务活动分布</p>
            </div>
          </div>

          {/* View Toggle + Layer Filter */}
          <div className="ia-surface-toolbar">
            <div className="ia-view-toggle" role="tablist" aria-label="分析视角">
              <button
                role="tab"
                type="button"
                aria-selected={centerView === 'summary'}
                className={`ia-view-toggle__btn ${centerView === 'summary' ? 'ia-view-toggle__btn--active' : ''}`}
                onClick={() => setCenterView('summary')}
              >
                影响摘要
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={centerView === 'path'}
                className={`ia-view-toggle__btn ${centerView === 'path' ? 'ia-view-toggle__btn--active' : ''}`}
                onClick={() => setCenterView('path')}
              >
                依赖路径
              </button>
            </div>

            {centerView === 'summary' && (
              <div className="ia-layer-filter" role="group" aria-label="过滤层级">
                {(['all', 'business', 'service', 'infra'] as LayerFilter[]).map((layer) => {
                  const labels: Record<LayerFilter, string> = {
                    all: '全部',
                    business: '业务层',
                    service: '服务层',
                    infra: '基础设施',
                  };
                  return (
                    <button
                      key={layer}
                      type="button"
                      className={`ia-layer-btn ${layerFilter === layer ? 'ia-layer-btn--active' : ''}`}
                      onClick={() => setLayerFilter(layer)}
                    >
                      {labels[layer]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Content: Summary View */}
          {centerView === 'summary' && (
            <div className="ia-summary">
              <div className="ia-summary__section">
                <h4 className="ia-summary__section-title">影响业务</h4>
                <div className="ia-summary__biz-list">
                  {selectedObject.impactedBusinesses.map((biz) => {
                    const cfg = RISK_CONFIG[biz.severity];
                    return (
                      <div
                        key={biz.bizId}
                        className="ia-biz-card"
                        style={{ '--accent': cfg.dot } as React.CSSProperties}
                      >
                        <div className="ia-biz-card__head">
                          <TypeIcon type="business" />
                          <strong>{biz.name}</strong>
                          <span className="ia-biz-card__id">{biz.bizId}</span>
                          <RiskBadge level={biz.severity} />
                        </div>
                        <p className="ia-biz-card__desc">{biz.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="ia-summary__section">
                <h4 className="ia-summary__section-title">
                  影响服务
                  {layerFilter !== 'all' && (
                    <span className="ia-summary__filter-tag">
                      {filteredServices.length} / {selectedObject.impactedServices.length}
                    </span>
                  )}
                </h4>
                <div className="ia-service-table">
                  <div className="ia-service-table__head">
                    <span>服务名称</span>
                    <span>类型</span>
                    <span>风险</span>
                    <span>影响说明</span>
                  </div>
                  {filteredServices.length > 0 ? (
                    filteredServices.map((svc) => (
                      <div key={svc.name} className="ia-service-table__row">
                        <strong>{svc.name}</strong>
                        <span className="ia-service-table__type">
                          <TypeIcon type={svc.type} />
                          {TYPE_CONFIG[svc.type].label}
                        </span>
                        <RiskBadge level={svc.severity} />
                        <span>{svc.desc}</span>
                      </div>
                    ))
                  ) : (
                    <div className="ia-service-table__empty">当前筛选层级下无影响服务</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Content: Path View */}
          {centerView === 'path' && (
            <div className="ia-path-view">
              <div className="ia-path-view__intro">
                <p className="ia-path-view__note">
                  依赖路径是决策证据，不是视觉表演。通过关系边类型可追溯到具体资源与归属。
                </p>
                <button
                  type="button"
                  className="ia-btn ia-btn--ghost ia-btn--sm"
                  onClick={() => {
                    const allIds = new Set<string>();
                    const collect = (node: DepNode) => {
                      allIds.add(node.id);
                      node.children.forEach(collect);
                    };
                    collect(selectedObject.depTree);
                    setExpandedDepIds(allIds);
                  }}
                >
                  展开全部
                </button>
              </div>
              <div className="ia-dep-tree">
                <DepTreeNode
                  node={selectedObject.depTree}
                  depth={0}
                  expandedIds={expandedDepIds}
                  onToggle={handleDepToggle}
                />
              </div>
              <div className="ia-path-legend">
                <span className="ia-path-legend__title">边类型说明</span>
                {[
                  { type: 'runs_on', desc: '承载关系，infra 层' },
                  { type: 'depends_on', desc: '依赖关系，服务层' },
                  { type: 'belongs_to', desc: '归属关系，业务层' },
                  { type: 'managed_by', desc: '管理关系，运营层' },
                ].map((item) => (
                  <div key={item.type} className="ia-path-legend__item">
                    <span className="ia-path-legend__type">{item.type}</span>
                    <span>{item.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {analysing && (
            <div className="ia-analysis-loading" aria-hidden>
              <div className="ia-analysis-loading__spinner" />
              <span>正在展开依赖边…</span>
            </div>
          )}
        </main>

        {/* ─── Right: Action Rail ─── */}
        <aside className="ia-action-rail" aria-label="操作建议">
          <div className="ia-action-rail__head">
            <h3>操作建议</h3>
            <span>按优先级排序</span>
          </div>

          <div className="ia-action-rail__suggestions">
            {selectedObject.suggestions.map((s) => (
              <div
                key={s.order}
                className={`ia-suggestion ${s.urgent ? 'ia-suggestion--urgent' : ''}`}
              >
                <div className="ia-suggestion__order">{s.order}</div>
                <div className="ia-suggestion__body">
                  <strong>{s.action}</strong>
                  <p>{s.detail}</p>
                </div>
                {s.urgent && <span className="ia-suggestion__urgent-tag">优先</span>}
              </div>
            ))}
          </div>

          <div className="ia-action-rail__divider" />

          <div className="ia-action-rail__exports">
            <p className="ia-action-rail__section-label">导出 & 共享</p>
            <button type="button" className="ia-btn ia-btn--secondary ia-btn--block">
              导出变更前检查报告
            </button>
            <button type="button" className="ia-btn ia-btn--ghost ia-btn--block">
              生成值班通知草稿
            </button>
          </div>

          <div className="ia-action-rail__divider" />

          <div className="ia-action-rail__design-notes">
            <p className="ia-action-rail__section-label">设计原则</p>
            {[
              { title: '先业务后技术', note: '先讲影响范围，再展开依赖证据。' },
              { title: '证据可追溯', note: '每个结论都回到具体资源与边。' },
              { title: '为 AI 预留接口', note: '受控页面是未来自然语言查询的载体。' },
            ].map((item) => (
              <div key={item.title} className="ia-design-note">
                <strong>{item.title}</strong>
                <p>{item.note}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <footer className="ia-proto__footer">
        <span>Hi-Fi prototype · local mock data only</span>
        <span>依赖路径基于受控关系边类型展开，不包含归档关系</span>
        <span>设计目标：SRE / 平台 / 变更评审场景</span>
      </footer>
    </div>
  );
};

export default ImpactAnalysisPrototype;
