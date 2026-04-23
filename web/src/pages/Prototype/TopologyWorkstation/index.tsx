import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import './style.css';

/* ═══════════════════════════════════════════════
   Mock Data — designed for realistic prototyping
   ═══════════════════════════════════════════════ */

interface HostItem {
  id: string;
  name: string;
  ip: string;
  os: string;
  cpuCount: number;
  memGB: number;
  status: 'running' | 'stopped' | 'unreachable' | 'warmup';
  module: string;
  agent: string;
  updatedAt: string;
}

interface ServiceItem {
  id: string;
  name: string;
  port: number;
  processCount: number;
  status: 'healthy' | 'warning' | 'error';
  module: string;
}

interface TopoNode {
  id: string;
  name: string;
  type: 'business' | 'set' | 'module' | 'idle';
  hostCount: number;
  children?: TopoNode[];
}

interface Business {
  id: string;
  name: string;
  bizId: string;
  setCount: number;
  moduleCount: number;
  hostCount: number;
  tree: TopoNode;
  hosts: Record<string, HostItem[]>;
  services: Record<string, ServiceItem[]>;
  recentlyUsed?: boolean;
}

const mockBusinesses: Business[] = [
  {
    id: 'biz-1',
    name: '崩坏：星穹铁道',
    bizId: 'BIZ-2014',
    setCount: 3,
    moduleCount: 7,
    hostCount: 24,
    recentlyUsed: true,
    tree: {
      id: 'biz-1-root',
      name: '崩坏：星穹铁道',
      type: 'business',
      hostCount: 24,
      children: [
        {
          id: 'idle-pool-1',
          name: '空闲机池',
          type: 'idle',
          hostCount: 0,
          children: [
            { id: 'idle-free-1', name: '空闲机', type: 'module', hostCount: 0 },
            { id: 'idle-fault-1', name: '故障机', type: 'module', hostCount: 0 },
            { id: 'idle-recycle-1', name: '待回收', type: 'module', hostCount: 0 },
          ],
        },
        {
          id: 'set-online',
          name: '在线业务',
          type: 'set',
          hostCount: 18,
          children: [
            { id: 'mod-match', name: '匹配服务', type: 'module', hostCount: 6 },
            { id: 'mod-gateway', name: '接入网关', type: 'module', hostCount: 4 },
            { id: 'mod-gamesvr', name: '游戏服', type: 'module', hostCount: 8 },
          ],
        },
        {
          id: 'set-data',
          name: '数据服务',
          type: 'set',
          hostCount: 6,
          children: [
            { id: 'mod-dbproxy', name: '数据库代理', type: 'module', hostCount: 3 },
            { id: 'mod-cache', name: '缓存集群', type: 'module', hostCount: 3 },
          ],
        },
      ],
    },
    hosts: {
      'biz-1-root': generateHosts('hsr', 24, ['匹配服务', '接入网关', '游戏服', '数据库代理', '缓存集群']),
      'set-online': generateHosts('hsr-ol', 18, ['匹配服务', '接入网关', '游戏服']),
      'set-data': generateHosts('hsr-data', 6, ['数据库代理', '缓存集群']),
      'mod-match': generateHosts('hsr-match', 6, ['匹配服务']),
      'mod-gateway': generateHosts('hsr-gw', 4, ['接入网关']),
      'mod-gamesvr': generateHosts('hsr-gs', 8, ['游戏服']),
      'mod-dbproxy': generateHosts('hsr-db', 3, ['数据库代理']),
      'mod-cache': generateHosts('hsr-cache', 3, ['缓存集群']),
      'idle-pool-1': [],
      'idle-free-1': [],
      'idle-fault-1': [],
      'idle-recycle-1': [],
    },
    services: {
      'mod-match': [
        { id: 'svc-1', name: 'match-engine', port: 8080, processCount: 6, status: 'healthy', module: '匹配服务' },
        { id: 'svc-2', name: 'match-queue', port: 8081, processCount: 3, status: 'healthy', module: '匹配服务' },
      ],
      'mod-gateway': [
        { id: 'svc-3', name: 'api-gateway', port: 443, processCount: 8, status: 'healthy', module: '接入网关' },
        { id: 'svc-4', name: 'rate-limiter', port: 6379, processCount: 2, status: 'warning', module: '接入网关' },
      ],
      'mod-gamesvr': [
        { id: 'svc-5', name: 'game-server', port: 9001, processCount: 16, status: 'healthy', module: '游戏服' },
        { id: 'svc-6', name: 'scene-manager', port: 9002, processCount: 4, status: 'healthy', module: '游戏服' },
      ],
      'mod-dbproxy': [
        { id: 'svc-7', name: 'db-proxy', port: 3306, processCount: 3, status: 'healthy', module: '数据库代理' },
      ],
      'mod-cache': [
        { id: 'svc-8', name: 'redis-cluster', port: 6380, processCount: 6, status: 'healthy', module: '缓存集群' },
        { id: 'svc-9', name: 'cache-proxy', port: 6381, processCount: 2, status: 'warning', module: '缓存集群' },
      ],
    },
  },
  {
    id: 'biz-2',
    name: '原神',
    bizId: 'BIZ-2048',
    setCount: 2,
    moduleCount: 5,
    hostCount: 15,
    recentlyUsed: true,
    tree: {
      id: 'biz-2-root',
      name: '原神',
      type: 'business',
      hostCount: 15,
      children: [
        {
          id: 'idle-pool-2',
          name: '空闲机池',
          type: 'idle',
          hostCount: 0,
          children: [
            { id: 'idle-free-2', name: '空闲机', type: 'module', hostCount: 0 },
            { id: 'idle-fault-2', name: '故障机', type: 'module', hostCount: 0 },
          ],
        },
        {
          id: 'set-global',
          name: '全球发布',
          type: 'set',
          hostCount: 10,
          children: [
            { id: 'mod-release', name: '发布集群', type: 'module', hostCount: 4 },
            { id: 'mod-artifact', name: '制品同步', type: 'module', hostCount: 3 },
            { id: 'mod-gray', name: '灰度验证', type: 'module', hostCount: 3 },
          ],
        },
        {
          id: 'set-infra',
          name: '基础设施',
          type: 'set',
          hostCount: 5,
          children: [
            { id: 'mod-monitor', name: '监控中心', type: 'module', hostCount: 3 },
            { id: 'mod-log', name: '日志采集', type: 'module', hostCount: 2 },
          ],
        },
      ],
    },
    hosts: {
      'biz-2-root': generateHosts('gs', 15, ['发布集群', '制品同步', '灰度验证', '监控中心', '日志采集']),
      'set-global': generateHosts('gs-global', 10, ['发布集群', '制品同步', '灰度验证']),
      'set-infra': generateHosts('gs-infra', 5, ['监控中心', '日志采集']),
      'mod-release': generateHosts('gs-rel', 4, ['发布集群']),
      'mod-artifact': generateHosts('gs-art', 3, ['制品同步']),
      'mod-gray': generateHosts('gs-gray', 3, ['灰度验证']),
      'mod-monitor': generateHosts('gs-mon', 3, ['监控中心']),
      'mod-log': generateHosts('gs-log', 2, ['日志采集']),
      'idle-pool-2': [],
      'idle-free-2': [],
      'idle-fault-2': [],
    },
    services: {},
  },
  {
    id: 'biz-3',
    name: '绝区零',
    bizId: 'BIZ-3001',
    setCount: 1,
    moduleCount: 3,
    hostCount: 8,
    tree: {
      id: 'biz-3-root',
      name: '绝区零',
      type: 'business',
      hostCount: 8,
      children: [
        {
          id: 'idle-pool-3',
          name: '空闲机池',
          type: 'idle',
          hostCount: 0,
          children: [
            { id: 'idle-free-3', name: '空闲机', type: 'module', hostCount: 0 },
          ],
        },
        {
          id: 'set-zzz-core',
          name: '核心服务',
          type: 'set',
          hostCount: 8,
          children: [
            { id: 'mod-zzz-api', name: 'API 网关', type: 'module', hostCount: 3 },
            { id: 'mod-zzz-game', name: '战斗服务', type: 'module', hostCount: 5 },
          ],
        },
      ],
    },
    hosts: {
      'biz-3-root': generateHosts('zzz', 8, ['API 网关', '战斗服务']),
      'set-zzz-core': generateHosts('zzz-core', 8, ['API 网关', '战斗服务']),
      'mod-zzz-api': generateHosts('zzz-api', 3, ['API 网关']),
      'mod-zzz-game': generateHosts('zzz-game', 5, ['战斗服务']),
      'idle-pool-3': [],
      'idle-free-3': [],
    },
    services: {},
  },
];

function generateHosts(prefix: string, count: number, modules: string[]): HostItem[] {
  const statuses: HostItem['status'][] = ['running', 'running', 'running', 'running', 'stopped', 'warmup', 'unreachable'];
  const oses = ['CentOS 7.9', 'Ubuntu 22.04', 'Rocky Linux 8'];
  const agents = ['正常', '正常', '正常', '异常', '未安装'];

  return Array.from({ length: count }, (_, i) => ({
    id: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    name: `${prefix}-${String(i + 1).padStart(2, '0')}`,
    ip: `10.${20 + Math.floor(i / 10)}.${Math.floor(Math.random() * 255)}.${10 + i}`,
    os: oses[i % oses.length],
    cpuCount: [8, 16, 32, 64][i % 4],
    memGB: [16, 32, 64, 128][i % 4],
    status: statuses[i % statuses.length],
    module: modules[i % modules.length],
    agent: agents[i % agents.length],
    updatedAt: `${Math.floor(Math.random() * 24)}小时前`,
  }));
}

/* ═══════════════════════════════════════════════
   Helper Components
   ═══════════════════════════════════════════════ */

const nodeTypeConfig: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  business: { color: 'oklch(0.39 0.07 245)',  bg: 'oklch(0.955 0.020 245)', label: '业务', icon: '◆' },
  set:      { color: 'oklch(0.42 0.12 160)',  bg: 'oklch(0.960 0.025 160)', label: '集群', icon: '■' },
  module:   { color: 'oklch(0.56 0.14 54)',   bg: 'oklch(0.970 0.030 80)',  label: '模块', icon: '●' },
  idle:     { color: 'oklch(0.62 0.020 245)', bg: 'oklch(0.975 0.008 80)',  label: '系统', icon: '○' },
};

const NodeTypeBadge: React.FC<{ type: string; size?: 'sm' | 'md' }> = ({ type, size = 'sm' }) => {
  const cfg = nodeTypeConfig[type] || nodeTypeConfig.module;
  return (
    <span
      className={`tw-node-badge tw-node-badge--${size}`}
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <span className="tw-node-badge__icon">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
};

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const colorMap: Record<string, string> = {
    running:     'oklch(0.42 0.12 160)',
    healthy:     'oklch(0.42 0.12 160)',
    stopped:     'oklch(0.72 0.020 245)',
    unreachable: 'oklch(0.52 0.18 22)',
    warmup:      'oklch(0.65 0.14 54)',
    warning:     'oklch(0.65 0.14 54)',
    error:       'oklch(0.52 0.18 22)',
  };
  return (
    <span className="tw-status-dot" style={{ '--dot-color': colorMap[status] || '#94a3b8' } as React.CSSProperties}>
      <span className="tw-status-dot__circle" />
      {status}
    </span>
  );
};

/* ═══════════════════════════════════════════════
   Tree Node rendering
   ═══════════════════════════════════════════════ */

const TreeNode: React.FC<{
  node: TopoNode;
  depth: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (node: TopoNode, path: TopoNode[]) => void;
  parentPath: TopoNode[];
}> = ({ node, depth, selectedId, expandedIds, onToggle, onSelect, parentPath }) => {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedId === node.id;
  const cfg = nodeTypeConfig[node.type] || nodeTypeConfig.module;
  const currentPath = [...parentPath, node];

  return (
    <div className="tw-tree-node">
      <button
        className={`tw-tree-node__row ${isSelected ? 'tw-tree-node__row--selected' : ''}`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
        onClick={() => onSelect(node, currentPath)}
        type="button"
        aria-selected={isSelected}
      >
        {isSelected && <span className="tw-tree-node__indicator" style={{ background: cfg.color }} />}
        <span
          className="tw-tree-node__chevron"
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggle(node.id); }}
          style={{ opacity: hasChildren ? 1 : 0, cursor: hasChildren ? 'pointer' : 'default' }}
          role="button"
          aria-label={isExpanded ? '折叠' : '展开'}
        >
          {isExpanded ? '▾' : '▸'}
        </span>
        <span className="tw-tree-node__badge" style={{ color: cfg.color, background: cfg.bg }}>
          {cfg.icon}
        </span>
        <span className="tw-tree-node__label">{node.name}</span>
        <span className="tw-tree-node__count">{node.hostCount}</span>
      </button>
      {hasChildren && isExpanded && (
        <div className="tw-tree-node__children">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelect={onSelect}
              parentPath={currentPath}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════
   Main Prototype Component
   ═══════════════════════════════════════════════ */

type TabKey = 'hostList' | 'serviceInstance' | 'nodeInfo';

const TopologyWorkstationPrototype: React.FC = () => {
  // ─── business state ───
  const [currentBizId, setCurrentBizId] = useState(mockBusinesses[0].id);
  const [bizSwitcherOpen, setBizSwitcherOpen] = useState(false);
  const [bizSearchValue, setBizSearchValue] = useState('');
  const bizSwitcherRef = useRef<HTMLDivElement>(null);

  // ─── tree state ───
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodePath, setSelectedNodePath] = useState<TopoNode[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [treeSearchValue, setTreeSearchValue] = useState('');
  const [treeCollapsed, setTreeCollapsed] = useState(false);

  // ─── workspace state ───
  const [activeTab, setActiveTab] = useState<TabKey>('hostList');
  const [hostSearchValue, setHostSearchValue] = useState('');
  const [selectedHostIds, setSelectedHostIds] = useState<string[]>([]);
  const [serviceView, setServiceView] = useState<'instance' | 'process'>('instance');

  const currentBiz = useMemo(
    () => mockBusinesses.find((b) => b.id === currentBizId) || mockBusinesses[0],
    [currentBizId],
  );

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const findNode = (node: TopoNode): TopoNode | null => {
      if (node.id === selectedNodeId) return node;
      if (node.children) {
        for (const child of node.children) {
          const found = findNode(child);
          if (found) return found;
        }
      }
      return null;
    };
    return findNode(currentBiz.tree);
  }, [selectedNodeId, currentBiz]);

  // Reset state when business changes
  useEffect(() => {
    setSelectedNodeId(null);
    setSelectedNodePath([]);
    setSelectedHostIds([]);
    setHostSearchValue('');
    setActiveTab('hostList');
    // Expand first two levels by default
    const ids = new Set<string>();
    ids.add(currentBiz.tree.id);
    currentBiz.tree.children?.forEach((child) => ids.add(child.id));
    setExpandedIds(ids);
  }, [currentBiz.id]);

  // Close business switcher on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bizSwitcherRef.current && !bizSwitcherRef.current.contains(e.target as Node)) {
        setBizSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset host selection on node change
  useEffect(() => {
    setSelectedHostIds([]);
    setHostSearchValue('');
  }, [selectedNodeId]);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleNodeSelect = useCallback((node: TopoNode, path: TopoNode[]) => {
    setSelectedNodeId(node.id);
    setSelectedNodePath(path);
  }, []);

  const handleBizSwitch = (bizId: string) => {
    setCurrentBizId(bizId);
    setBizSwitcherOpen(false);
    setBizSearchValue('');
  };

  // ─── Host data ───
  const currentHosts = useMemo(() => {
    if (!selectedNodeId) return [];
    return currentBiz.hosts[selectedNodeId] || [];
  }, [selectedNodeId, currentBiz]);

  const filteredHosts = useMemo(() => {
    const kw = hostSearchValue.trim().toLowerCase();
    if (!kw) return currentHosts;
    return currentHosts.filter(
      (h) =>
        h.name.toLowerCase().includes(kw) ||
        h.ip.toLowerCase().includes(kw) ||
        h.module.toLowerCase().includes(kw),
    );
  }, [currentHosts, hostSearchValue]);

  // ─── Service data ───
  const currentServices = useMemo(() => {
    if (!selectedNodeId) return [];
    return currentBiz.services[selectedNodeId] || [];
  }, [selectedNodeId, currentBiz]);

  const allHostsSelected =
    filteredHosts.length > 0 && filteredHosts.every((h) => selectedHostIds.includes(h.id));
  const someHostsSelected = selectedHostIds.length > 0;

  const toggleHostSelection = (hostId: string) => {
    setSelectedHostIds((prev) =>
      prev.includes(hostId) ? prev.filter((id) => id !== hostId) : [...prev, hostId],
    );
  };

  const toggleAllHosts = () => {
    if (allHostsSelected) {
      setSelectedHostIds([]);
    } else {
      setSelectedHostIds(filteredHosts.map((h) => h.id));
    }
  };

  // ─── Breadcrumb ───
  const breadcrumb = selectedNodePath.map((n) => n.name);

  // Filter business list
  const filteredBusinesses = useMemo(() => {
    const kw = bizSearchValue.trim().toLowerCase();
    if (!kw) return mockBusinesses;
    return mockBusinesses.filter(
      (b) => b.name.toLowerCase().includes(kw) || b.bizId.toLowerCase().includes(kw),
    );
  }, [bizSearchValue]);

  // Filter tree nodes
  const treeFilteredRoot = useMemo(() => {
    const kw = treeSearchValue.trim().toLowerCase();
    if (!kw) return currentBiz.tree;

    const filterNode = (node: TopoNode): TopoNode | null => {
      if (node.name.toLowerCase().includes(kw)) return node;
      if (node.children) {
        const filtered = node.children
          .map(filterNode)
          .filter(Boolean) as TopoNode[];
        if (filtered.length > 0) {
          return { ...node, children: filtered };
        }
      }
      return null;
    };
    return filterNode(currentBiz.tree) || currentBiz.tree;
  }, [currentBiz.tree, treeSearchValue]);

  return (
    <div className="tw-prototype">
      {/* ════════ Left: Topo Navigator ════════ */}
      <aside className={`tw-topo-nav ${treeCollapsed ? 'tw-topo-nav--collapsed' : ''}`}>
        {treeCollapsed ? (
          <div className="tw-topo-nav__collapsed-content">
            <span className="tw-topo-nav__collapsed-letter">{currentBiz.name[0]}</span>
            <button
              className="tw-topo-nav__expand-btn"
              onClick={() => setTreeCollapsed(false)}
              type="button"
              aria-label="展开拓扑导航"
            >
              ▸
            </button>
          </div>
        ) : (
          <>
            {/* Business Header */}
            <div className="tw-biz-header" ref={bizSwitcherRef}>
              <button
                className="tw-biz-header__trigger"
                onClick={() => setBizSwitcherOpen(!bizSwitcherOpen)}
                type="button"
                aria-expanded={bizSwitcherOpen}
                aria-haspopup="listbox"
              >
                <div className="tw-biz-header__info">
                  <span className="tw-biz-header__icon">◆</span>
                  <div>
                    <div className="tw-biz-header__name">{currentBiz.name}</div>
                    <div className="tw-biz-header__id">{currentBiz.bizId}</div>
                  </div>
                </div>
                <span className={`tw-biz-header__arrow ${bizSwitcherOpen ? 'tw-biz-header__arrow--open' : ''}`}>▾</span>
              </button>
              <div className="tw-biz-header__stats">
                <span>{currentBiz.setCount} 集群</span>
                <span className="tw-biz-header__stats-sep">·</span>
                <span>{currentBiz.moduleCount} 模块</span>
                <span className="tw-biz-header__stats-sep">·</span>
                <span>{currentBiz.hostCount} 主机</span>
              </div>

              {bizSwitcherOpen && (
                <div className="tw-biz-switcher">
                  <div className="tw-biz-switcher__search">
                    <svg className="tw-biz-switcher__search-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
                    </svg>
                    <input
                      type="text"
                      placeholder="搜索业务名称或 ID..."
                      value={bizSearchValue}
                      onChange={(e) => setBizSearchValue(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {filteredBusinesses.some((b) => b.recentlyUsed) && (
                    <div className="tw-biz-switcher__group">
                      <span className="tw-biz-switcher__group-label">最近使用</span>
                      {filteredBusinesses.filter((b) => b.recentlyUsed).map((b) => (
                        <button
                          key={b.id}
                          className={`tw-biz-switcher__item ${b.id === currentBiz.id ? 'tw-biz-switcher__item--active' : ''}`}
                          onClick={() => handleBizSwitch(b.id)}
                          type="button"
                        >
                          <div className="tw-biz-switcher__item-info">
                            <span className="tw-biz-switcher__item-name">{b.name}</span>
                            <span className="tw-biz-switcher__item-id">{b.bizId}</span>
                          </div>
                          <span className="tw-biz-switcher__item-meta">
                            {b.hostCount} 主机
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="tw-biz-switcher__group">
                    <span className="tw-biz-switcher__group-label">全部业务</span>
                    {filteredBusinesses.map((b) => (
                      <button
                        key={b.id}
                        className={`tw-biz-switcher__item ${b.id === currentBiz.id ? 'tw-biz-switcher__item--active' : ''}`}
                        onClick={() => handleBizSwitch(b.id)}
                        type="button"
                      >
                        <div className="tw-biz-switcher__item-info">
                          <span className="tw-biz-switcher__item-name">{b.name}</span>
                          <span className="tw-biz-switcher__item-id">{b.bizId}</span>
                        </div>
                        <span className="tw-biz-switcher__item-meta">
                          {b.setCount} 集群 · {b.hostCount} 主机
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="tw-biz-switcher__footer">
                    <button type="button" className="tw-biz-switcher__create">
                      <span>+</span> 新建业务
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Tree Search */}
            <div className="tw-tree-search">
              <svg className="tw-tree-search__icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
              </svg>
              <input
                type="text"
                placeholder="搜索拓扑节点..."
                value={treeSearchValue}
                onChange={(e) => setTreeSearchValue(e.target.value)}
              />
            </div>

            {/* Tree */}
            <div className="tw-tree">
              <TreeNode
                node={treeFilteredRoot}
                depth={0}
                selectedId={selectedNodeId}
                expandedIds={expandedIds}
                onToggle={handleToggle}
                onSelect={handleNodeSelect}
                parentPath={[]}
              />
            </div>

            {/* Collapse trigger */}
            <button
              className="tw-topo-nav__collapse-btn"
              onClick={() => setTreeCollapsed(true)}
              type="button"
              aria-label="折叠拓扑导航"
            >
              ◁
            </button>
          </>
        )}
      </aside>

      {/* ════════ Right: Workspace ════════ */}
      <main className="tw-workspace">
        {/* Node Context Strip */}
        <div className="tw-context-strip">
          {selectedNode ? (
            <>
              <div className="tw-context-strip__left">
                <NodeTypeBadge type={selectedNode.type} size="md" />
                <h2 className="tw-context-strip__name">{selectedNode.name}</h2>
              </div>
              <nav className="tw-context-strip__breadcrumb" aria-label="节点路径">
                {breadcrumb.map((seg, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="tw-context-strip__sep">›</span>}
                    <span className={i === breadcrumb.length - 1 ? 'tw-context-strip__crumb--current' : ''}>
                      {seg}
                    </span>
                  </React.Fragment>
                ))}
              </nav>
            </>
          ) : (
            <div className="tw-context-strip__empty">
              请在左侧选择拓扑节点
            </div>
          )}
        </div>

        {selectedNode ? (
          <>
            {/* Tab + Toolbar Row */}
            <div className="tw-tab-toolbar">
              <div className="tw-tab-toolbar__tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={activeTab === 'hostList'}
                  className={`tw-tab-toolbar__tab ${activeTab === 'hostList' ? 'tw-tab-toolbar__tab--active' : ''}`}
                  onClick={() => setActiveTab('hostList')}
                  type="button"
                >
                  主机列表
                  <span className="tw-tab-toolbar__tab-count">{currentHosts.length}</span>
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === 'serviceInstance'}
                  className={`tw-tab-toolbar__tab ${activeTab === 'serviceInstance' ? 'tw-tab-toolbar__tab--active' : ''}`}
                  onClick={() => setActiveTab('serviceInstance')}
                  type="button"
                >
                  服务实例
                  <span className="tw-tab-toolbar__tab-count">{currentServices.length}</span>
                </button>
                <button
                  role="tab"
                  aria-selected={activeTab === 'nodeInfo'}
                  className={`tw-tab-toolbar__tab ${activeTab === 'nodeInfo' ? 'tw-tab-toolbar__tab--active' : ''}`}
                  onClick={() => setActiveTab('nodeInfo')}
                  type="button"
                >
                  节点信息
                </button>
              </div>

              <div className="tw-tab-toolbar__actions">
                {activeTab === 'hostList' && (
                  <>
                    <div className="tw-tab-toolbar__search">
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" />
                      </svg>
                      <input
                        type="text"
                        placeholder="搜索 IP / 主机名..."
                        value={hostSearchValue}
                        onChange={(e) => setHostSearchValue(e.target.value)}
                      />
                    </div>
                    {selectedNode.type === 'module' && (
                      <button className="tw-btn tw-btn--primary" type="button">
                        <span>+</span> 新增主机
                      </button>
                    )}
                  </>
                )}
                {activeTab === 'serviceInstance' && (
                  <>
                    <div className="tw-tab-toolbar__view-switch">
                      <button
                        className={`tw-view-btn ${serviceView === 'instance' ? 'tw-view-btn--active' : ''}`}
                        onClick={() => setServiceView('instance')}
                        type="button"
                      >
                        实例
                      </button>
                      <button
                        className={`tw-view-btn ${serviceView === 'process' ? 'tw-view-btn--active' : ''}`}
                        onClick={() => setServiceView('process')}
                        type="button"
                      >
                        进程
                      </button>
                    </div>
                    <button className="tw-btn tw-btn--primary" type="button">
                      <span>+</span> 新增
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="tw-content">
              {activeTab === 'hostList' && (
                <>
                  {filteredHosts.length > 0 ? (
                    <div className="tw-table-wrap">
                      <table className="tw-table">
                        <thead>
                          <tr>
                            <th className="tw-table__check">
                              <input
                                type="checkbox"
                                checked={allHostsSelected}
                                onChange={toggleAllHosts}
                                aria-label="全选"
                              />
                            </th>
                            <th>主机名</th>
                            <th>内网 IP</th>
                            <th>操作系统</th>
                            <th>CPU / 内存</th>
                            <th>所属模块</th>
                            <th>Agent 状态</th>
                            <th>运行状态</th>
                            <th>更新时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredHosts.map((host) => (
                            <tr
                              key={host.id}
                              className={selectedHostIds.includes(host.id) ? 'tw-table__row--selected' : ''}
                            >
                              <td className="tw-table__check">
                                <input
                                  type="checkbox"
                                  checked={selectedHostIds.includes(host.id)}
                                  onChange={() => toggleHostSelection(host.id)}
                                  aria-label={`选择 ${host.name}`}
                                />
                              </td>
                              <td className="tw-table__name">{host.name}</td>
                              <td className="tw-table__mono">{host.ip}</td>
                              <td>{host.os}</td>
                              <td className="tw-table__mono">{host.cpuCount}C / {host.memGB}G</td>
                              <td>{host.module}</td>
                              <td>
                                <span className={`tw-agent-badge tw-agent-badge--${host.agent === '正常' ? 'ok' : host.agent === '异常' ? 'err' : 'none'}`}>
                                  {host.agent}
                                </span>
                              </td>
                              <td><StatusDot status={host.status} /></td>
                              <td className="tw-table__muted">{host.updatedAt}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      <div className="tw-pagination">
                        <span className="tw-pagination__info">
                          共 {currentHosts.length} 条
                          {hostSearchValue && ` · 当前筛选 ${filteredHosts.length} 条`}
                        </span>
                        <div className="tw-pagination__controls">
                          <button type="button" disabled>‹</button>
                          <span className="tw-pagination__page tw-pagination__page--active">1</span>
                          {currentHosts.length > 10 && <span className="tw-pagination__page">2</span>}
                          <button type="button">›</button>
                        </div>
                      </div>
                    </div>
                  ) : currentHosts.length === 0 ? (
                    /* Empty: Module without hosts */
                    <div className="tw-empty-state">
                      <div className="tw-empty-state__icon">🖥️</div>
                      <h3 className="tw-empty-state__title">当前{selectedNode.type === 'module' ? '模块' : '节点'}暂无主机</h3>
                      <p className="tw-empty-state__desc">
                        可以通过"新增主机"或"转移"添加
                      </p>
                      {selectedNode.type === 'module' && (
                        <button className="tw-btn tw-btn--primary tw-empty-state__action" type="button">
                          <span>+</span> 新增主机
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Empty: Search no result */
                    <div className="tw-empty-state">
                      <div className="tw-empty-state__icon">🔍</div>
                      <h3 className="tw-empty-state__title">未找到匹配的主机</h3>
                      <p className="tw-empty-state__desc">
                        尝试修改搜索关键词，或清除筛选条件
                      </p>
                      <button
                        className="tw-btn tw-btn--secondary tw-empty-state__action"
                        onClick={() => setHostSearchValue('')}
                        type="button"
                      >
                        清除搜索
                      </button>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'serviceInstance' && (
                <>
                  {currentServices.length > 0 ? (
                    <div className="tw-table-wrap">
                      <table className="tw-table">
                        <thead>
                          <tr>
                            <th>服务名称</th>
                            <th>端口</th>
                            <th>进程数</th>
                            <th>所属模块</th>
                            <th>运行状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentServices.map((svc) => (
                            <tr key={svc.id}>
                              <td className="tw-table__name">{svc.name}</td>
                              <td className="tw-table__mono">{svc.port}</td>
                              <td>{svc.processCount}</td>
                              <td>{svc.module}</td>
                              <td><StatusDot status={svc.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="tw-empty-state">
                      <div className="tw-empty-state__icon">⚙️</div>
                      <h3 className="tw-empty-state__title">当前节点暂无服务实例</h3>
                      <p className="tw-empty-state__desc">
                        选择一个包含服务实例的模块节点
                      </p>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'nodeInfo' && (
                <div className="tw-node-info">
                  <div className="tw-node-info__section">
                    <h4 className="tw-node-info__section-title">基本信息</h4>
                    <div className="tw-node-info__grid">
                      <div className="tw-node-info__field">
                        <span className="tw-node-info__label">节点名称</span>
                        <span className="tw-node-info__value">{selectedNode.name}</span>
                      </div>
                      <div className="tw-node-info__field">
                        <span className="tw-node-info__label">节点类型</span>
                        <span className="tw-node-info__value"><NodeTypeBadge type={selectedNode.type} /></span>
                      </div>
                      <div className="tw-node-info__field">
                        <span className="tw-node-info__label">所属业务</span>
                        <span className="tw-node-info__value">{currentBiz.name}</span>
                      </div>
                      <div className="tw-node-info__field">
                        <span className="tw-node-info__label">主机数量</span>
                        <span className="tw-node-info__value">{selectedNode.hostCount}</span>
                      </div>
                      <div className="tw-node-info__field">
                        <span className="tw-node-info__label">节点路径</span>
                        <span className="tw-node-info__value">{breadcrumb.join(' / ')}</span>
                      </div>
                      <div className="tw-node-info__field">
                        <span className="tw-node-info__label">创建时间</span>
                        <span className="tw-node-info__value">2025-12-01 14:30:00</span>
                      </div>
                    </div>
                  </div>
                  {selectedNode.type === 'module' && (
                    <div className="tw-node-info__section">
                      <h4 className="tw-node-info__section-title">模块配置</h4>
                      <div className="tw-node-info__grid">
                        <div className="tw-node-info__field">
                          <span className="tw-node-info__label">服务模板</span>
                          <span className="tw-node-info__value">未绑定</span>
                        </div>
                        <div className="tw-node-info__field">
                          <span className="tw-node-info__label">服务分类</span>
                          <span className="tw-node-info__value">默认</span>
                        </div>
                        <div className="tw-node-info__field">
                          <span className="tw-node-info__label">运维人员</span>
                          <span className="tw-node-info__value">admin</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* No node selected state */
          <div className="tw-empty-workspace">
            <div className="tw-empty-workspace__icon">📂</div>
            <h3 className="tw-empty-workspace__title">在左侧拓扑树中选择一个节点以查看详情</h3>
            <p className="tw-empty-workspace__desc">
              节点类型包括：
              <NodeTypeBadge type="business" />
              <NodeTypeBadge type="set" />
              <NodeTypeBadge type="module" />
            </p>
          </div>
        )}

        {/* Floating Action Bar */}
        {someHostsSelected && (
          <div className="tw-fab" role="toolbar" aria-label="批量操作">
            <div className="tw-fab__count">
              已选择 <strong>{selectedHostIds.length}</strong> 台主机
            </div>
            <div className="tw-fab__actions">
              <button className="tw-fab__btn tw-fab__btn--outline" type="button">转移到...</button>
              <button className="tw-fab__btn tw-fab__btn--outline" type="button">追加到</button>
              <button className="tw-fab__btn tw-fab__btn--outline tw-fab__btn--danger" type="button">移除</button>
              <button className="tw-fab__btn tw-fab__btn--text" type="button">复制</button>
              <button className="tw-fab__btn tw-fab__btn--text" type="button">更多 ▾</button>
            </div>
            <button
              className="tw-fab__close"
              onClick={() => setSelectedHostIds([])}
              type="button"
              aria-label="取消选择"
            >
              ✕
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default TopologyWorkstationPrototype;
