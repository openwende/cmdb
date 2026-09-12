import React, { useState, useRef, useEffect, useCallback } from 'react';
import './style.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'command' | 'resource';
type ResourceTab = 'impact' | 'timeline' | 'properties' | 'operations';
type ResourceStatus = 'online' | 'warning' | 'offline';
type ResourceType =
  | 'host'
  | 'service'
  | 'cluster'
  | 'module'
  | 'k8s-node'
  | 'k8s-pod'
  | 'k8s-service';
type ChangeType = 'deploy' | 'transfer' | 'config' | 'alert' | 'attribute';

interface K8sPod {
  name: string;
  status: ResourceStatus;
  workload: string;
  namespace: string;
  cpuReq: string;
  memReq: string;
}

interface K8sNodeInfo {
  cluster: string;
  namespace: string;
  pods: K8sPod[];
  schedulableNote: string;
  capacityWarning?: boolean;
}

interface ResourceRef {
  id: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  location: string;
  ip?: string;
  freshnessMinutes: number;
}

interface RecentItem extends ResourceRef {
  lastVisitLabel: string;
}

interface DependencyNode {
  id: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  layer: 'upstream' | 'current' | 'downstream';
  sublabel?: string;
}

interface ModuleSibling {
  name: string;
  status: ResourceStatus;
  isCurrent: boolean;
}

interface ChangeEvent {
  id: string;
  timeLabel: string;
  type: ChangeType;
  operator: string;
  description: string;
  risk?: 'low' | 'medium' | 'high';
  note?: string;
}

interface ResourceDetail {
  id: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  location: string;
  ip: string;
  spec: string;
  os: string;
  uptimeDays: number;
  freshnessMinutes: number;
  // Impact
  moduleCapacityPct: number;
  hasFailover: boolean;
  failoverNote?: string;
  impactNote: string;
  dependencies: DependencyNode[];
  moduleSiblings: ModuleSibling[];
  affectedUsers?: string;
  // Timeline
  changes: ChangeEvent[];
  // K8s
  k8sNode?: K8sNodeInfo;
  // Properties
  properties: { label: string; value: string; highlight?: boolean }[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_RESOURCES: Record<string, ResourceDetail> = {
  'game-server-hz-042': {
    id: 'game-server-hz-042',
    name: 'game-server-hz-042',
    type: 'host',
    status: 'online',
    location: '华南 / 游戏服',
    ip: '10.16.23.42',
    spec: '8C 32G',
    os: 'CentOS 7.9',
    uptimeDays: 127,
    freshnessMinutes: 3,
    moduleCapacityPct: 33,
    hasFailover: false,
    impactNote: '游戏服模块容量 −33%，估计影响约 1,200 在线玩家（华南峰值估算，无自动切换）',
    affectedUsers: '~1,200 在线玩家',
    dependencies: [
      {
        id: 'nginx-gw-02',
        name: 'nginx-gateway-02',
        type: 'host',
        status: 'online',
        layer: 'upstream',
        sublabel: '接入网关 / 华南',
      },
      {
        id: 'self',
        name: 'game-server-hz-042',
        type: 'host',
        status: 'online',
        layer: 'current',
        sublabel: '当前主机',
      },
      {
        id: 'account-db-rep',
        name: 'account-db-replica',
        type: 'host',
        status: 'online',
        layer: 'downstream',
        sublabel: '数据服务 / 从库',
      },
      {
        id: 'redis-sess',
        name: 'redis-session-01',
        type: 'service',
        status: 'warning',
        layer: 'downstream',
        sublabel: '缓存集群 ⚠ 副本不健康',
      },
    ],
    moduleSiblings: [
      { name: 'game-server-hz-040', status: 'online', isCurrent: false },
      { name: 'game-server-hz-041', status: 'online', isCurrent: false },
      { name: 'game-server-hz-042', status: 'online', isCurrent: true },
    ],
    changes: [
      {
        id: 'c1',
        timeLabel: '2小时前',
        type: 'deploy',
        operator: '张伟 (自动部署)',
        description: '配置文件更新：game-config v2.14.1 → v2.14.3',
        risk: 'low',
        note: '灰度发布，未触发告警',
      },
      {
        id: 'c2',
        timeLabel: '3天前',
        type: 'transfer',
        operator: '李晓明',
        description: '从模块「备用池」迁入「游戏服 / 华南」',
        risk: 'medium',
        note: '迁移后首次出现 redis-session 延迟升高',
      },
      {
        id: 'c3',
        timeLabel: '5天前',
        type: 'attribute',
        operator: '运维系统 (自动)',
        description: 'agent 心跳超时重连，数据短暂过时 18 分钟',
        risk: 'low',
      },
      {
        id: 'c4',
        timeLabel: '2周前',
        type: 'deploy',
        operator: '陈建国',
        description: 'OS 补丁：CVE-2024-xxxx 修复',
        risk: 'low',
      },
    ],
    properties: [
      { label: 'IP 地址', value: '10.16.23.42' },
      { label: '内网 FQDN', value: 'game-server-hz-042.hz.internal' },
      { label: '规格', value: '8 Core / 32 GB RAM / 500 GB SSD' },
      { label: '操作系统', value: 'CentOS Linux 7.9.2009' },
      { label: '业务', value: '崩坏：星穹铁道' },
      { label: '集群', value: '在线业务 / 华南' },
      { label: '模块', value: '游戏服' },
      { label: 'K8s 节点', value: 'hz-prod / game namespace', highlight: true },
      { label: 'Agent 版本', value: 'gse-agent 2.1.8', highlight: true },
      { label: '数据更新', value: '3 分钟前（在线）' },
      { label: '归属人', value: '华南运维组 / 张伟' },
      { label: '上线时间', value: '2025-11-29（127 天前）' },
      { label: '资产编号', value: 'IDC-HZ-B04-R12-U03' },
    ],
    k8sNode: {
      cluster: 'hz-prod',
      namespace: 'game',
      schedulableNote:
        '集群共 3 个可调度节点，当前节点宕机后 Pod 可漂移至剩余 2 个节点（剩余可用容量约 60%）',
      capacityWarning: false,
      pods: [
        {
          name: 'game-api-7f4b9c-xk2pq',
          status: 'online',
          workload: 'game-api',
          namespace: 'game',
          cpuReq: '500m',
          memReq: '512Mi',
        },
        {
          name: 'game-api-7f4b9c-mn8vr',
          status: 'online',
          workload: 'game-api',
          namespace: 'game',
          cpuReq: '500m',
          memReq: '512Mi',
        },
        {
          name: 'match-svc-9d2c4f-lpw3t',
          status: 'online',
          workload: 'match-svc',
          namespace: 'game',
          cpuReq: '200m',
          memReq: '256Mi',
        },
        {
          name: 'battle-srv-5a1b8e-gqz7k',
          status: 'online',
          workload: 'battle-srv',
          namespace: 'game',
          cpuReq: '1000m',
          memReq: '1Gi',
        },
        {
          name: 'battle-srv-5a1b8e-hwy4m',
          status: 'online',
          workload: 'battle-srv',
          namespace: 'game',
          cpuReq: '1000m',
          memReq: '1Gi',
        },
        {
          name: 'log-agent-ds-j9nzx',
          status: 'online',
          workload: 'log-agent',
          namespace: 'infra',
          cpuReq: '100m',
          memReq: '128Mi',
        },
        {
          name: 'node-exporter-ds-q8wkt',
          status: 'online',
          workload: 'node-exporter',
          namespace: 'infra',
          cpuReq: '50m',
          memReq: '64Mi',
        },
        {
          name: 'game-session-7c3e1a-rpx5v',
          status: 'warning',
          workload: 'game-session',
          namespace: 'game',
          cpuReq: '300m',
          memReq: '512Mi',
        },
      ],
    },
  },
  'account-db-primary': {
    id: 'account-db-primary',
    name: 'account-db-primary',
    type: 'host',
    status: 'warning',
    location: '数据服务 / 主库',
    ip: '10.16.10.11',
    spec: '32C 128G',
    os: 'Debian 11',
    uptimeDays: 312,
    freshnessMinutes: 35,
    moduleCapacityPct: 100,
    hasFailover: true,
    failoverNote: '主从切换需 ~45 秒，期间写入暂停',
    impactNote: '主库下线将触发自动主从切换，写入暂停约 45 秒，影响所有依赖账号服务的业务线',
    affectedUsers: '全量账号写入（含充值、登录）',
    dependencies: [
      {
        id: 'game-srv',
        name: 'game-server-hz-0xx (×3)',
        type: 'host',
        status: 'online',
        layer: 'upstream',
        sublabel: '游戏服 / 华南',
      },
      {
        id: 'lobby-srv',
        name: 'lobby-server-01',
        type: 'host',
        status: 'online',
        layer: 'upstream',
        sublabel: '接入层 / 大厅服务',
      },
      {
        id: 'self',
        name: 'account-db-primary',
        type: 'host',
        status: 'warning',
        layer: 'current',
        sublabel: '⚠ CPU 负载 87%',
      },
      {
        id: 'db-rep',
        name: 'account-db-replica',
        type: 'host',
        status: 'online',
        layer: 'downstream',
        sublabel: '从库 · 延迟 12ms',
      },
    ],
    moduleSiblings: [
      { name: 'account-db-primary', status: 'warning', isCurrent: true },
      { name: 'account-db-replica', status: 'online', isCurrent: false },
    ],
    changes: [
      {
        id: 'c1',
        timeLabel: '35分钟前',
        type: 'alert',
        operator: '监控系统',
        description: 'CPU 负载告警：连续 20 分钟超过 85%',
        risk: 'high',
        note: '关联告警 #ALT-20240406-0831，未处理',
      },
      {
        id: 'c2',
        timeLabel: '昨天',
        type: 'config',
        operator: '吴鹏',
        description: 'MySQL slow_query_log 阈值调整：500ms → 200ms',
        risk: 'low',
      },
      {
        id: 'c3',
        timeLabel: '1周前',
        type: 'deploy',
        operator: '数据库 SRE 组',
        description: 'MySQL 8.0.35 → 8.0.36 小版本升级',
        risk: 'medium',
        note: '升级后 replica lag 峰值 340ms，已恢复',
      },
    ],
    properties: [
      { label: 'IP 地址', value: '10.16.10.11' },
      { label: '内网 FQDN', value: 'account-db-primary.db.internal' },
      { label: '规格', value: '32 Core / 128 GB RAM / 4 TB NVMe' },
      { label: '操作系统', value: 'Debian GNU/Linux 11 (bullseye)' },
      { label: '业务', value: '跨业务共享 · 账号服务', highlight: true },
      { label: '模块', value: '数据库代理 / 主库' },
      { label: 'MySQL 版本', value: '8.0.36' },
      { label: '当前负载', value: 'CPU 87% ⚠', highlight: true },
      { label: '主从延迟', value: '12 ms（从库）' },
      { label: '归属人', value: '数据库 SRE 组' },
    ],
  },
  'nginx-gateway-01': {
    id: 'nginx-gateway-01',
    name: 'nginx-gateway-01',
    type: 'host',
    status: 'online',
    location: '接入层 / 接入网关',
    ip: '10.16.1.10',
    spec: '16C 64G',
    os: 'Ubuntu 22.04',
    uptimeDays: 89,
    freshnessMinutes: 1,
    moduleCapacityPct: 33,
    hasFailover: true,
    failoverNote: 'LB 自动摘除，流量切至 nginx-gateway-02/03，无感知',
    impactNote: 'LB 已配置健康检查，下线后流量自动漂移，业务无中断风险',
    dependencies: [
      {
        id: 'ext-lb',
        name: 'CDN / 外部负载均衡',
        type: 'service',
        status: 'online',
        layer: 'upstream',
        sublabel: '外部接入',
      },
      {
        id: 'self',
        name: 'nginx-gateway-01',
        type: 'host',
        status: 'online',
        layer: 'current',
        sublabel: '当前主机',
      },
      {
        id: 'game-srv-40',
        name: 'game-server-hz-040',
        type: 'host',
        status: 'online',
        layer: 'downstream',
        sublabel: '游戏服 / 华南',
      },
      {
        id: 'game-srv-41',
        name: 'game-server-hz-041',
        type: 'host',
        status: 'online',
        layer: 'downstream',
        sublabel: '游戏服 / 华南',
      },
      {
        id: 'game-srv-42',
        name: 'game-server-hz-042',
        type: 'host',
        status: 'online',
        layer: 'downstream',
        sublabel: '游戏服 / 华南',
      },
    ],
    moduleSiblings: [
      { name: 'nginx-gateway-01', status: 'online', isCurrent: true },
      { name: 'nginx-gateway-02', status: 'online', isCurrent: false },
      { name: 'nginx-gateway-03', status: 'online', isCurrent: false },
    ],
    changes: [
      {
        id: 'c1',
        timeLabel: '1小时前',
        type: 'deploy',
        operator: '王芳 (CI/CD)',
        description: 'nginx.conf 更新：upstream timeout 60s → 90s',
        risk: 'low',
      },
      {
        id: 'c2',
        timeLabel: '3天前',
        type: 'config',
        operator: 'LB 自动',
        description: '健康检查触发临时摘除，约 3 秒后自动恢复',
        risk: 'medium',
        note: '原因未明，已记录 #TKT-4421',
      },
    ],
    properties: [
      { label: 'IP 地址', value: '10.16.1.10' },
      { label: '公网 IP', value: '123.45.67.89' },
      { label: '规格', value: '16 Core / 64 GB RAM' },
      { label: '操作系统', value: 'Ubuntu 22.04 LTS' },
      { label: '模块', value: '接入网关' },
      { label: 'nginx 版本', value: '1.24.0' },
      { label: 'QPS (当前)', value: '28,400 req/s' },
      { label: '归属人', value: '接入层 SRE 组' },
    ],
  },
  'redis-session-01': {
    id: 'redis-session-01',
    name: 'redis-session-01',
    type: 'service',
    status: 'warning',
    location: '缓存集群 / 会话缓存',
    ip: '10.16.20.50',
    spec: '8C 64G',
    os: 'CentOS 7.9',
    uptimeDays: 204,
    freshnessMinutes: 8,
    moduleCapacityPct: 50,
    hasFailover: true,
    failoverNote: '副本可接管，但 replica-02 当前不可达，实际无冗余',
    impactNote:
      '副本 redis-session-replica-02 不可达，集群降为单点。下线将导致全量 session 失效，影响在线玩家重新登录',
    affectedUsers: '全量在线玩家（session 失效）',
    dependencies: [
      {
        id: 'game-srv-all',
        name: 'game-server-hz-0xx (×3)',
        type: 'host',
        status: 'online',
        layer: 'upstream',
        sublabel: '游戏服 / 华南',
      },
      {
        id: 'self',
        name: 'redis-session-01',
        type: 'service',
        status: 'warning',
        layer: 'current',
        sublabel: '⚠ replica-02 不可达',
      },
      {
        id: 'redis-r1',
        name: 'redis-session-replica-01',
        type: 'service',
        status: 'online',
        layer: 'downstream',
        sublabel: '副本 01 · 正常',
      },
      {
        id: 'redis-r2',
        name: 'redis-session-replica-02',
        type: 'service',
        status: 'offline',
        layer: 'downstream',
        sublabel: '副本 02 · 不可达 ✗',
      },
    ],
    moduleSiblings: [
      { name: 'redis-session-01', status: 'warning', isCurrent: true },
      { name: 'redis-session-replica-01', status: 'online', isCurrent: false },
      { name: 'redis-session-replica-02', status: 'offline', isCurrent: false },
    ],
    changes: [
      {
        id: 'c1',
        timeLabel: '2小时前',
        type: 'alert',
        operator: '监控系统',
        description: 'redis-session-replica-02 连接超时，状态转为 UNREACHABLE',
        risk: 'high',
        note: '未触发自动重启，待人工介入',
      },
      {
        id: 'c2',
        timeLabel: '5天前',
        type: 'deploy',
        operator: '赵磊',
        description: 'Redis 版本升级：7.0.11 → 7.2.4',
        risk: 'medium',
      },
    ],
    properties: [
      { label: 'IP 地址', value: '10.16.20.50' },
      { label: '规格', value: '8 Core / 64 GB RAM' },
      { label: '操作系统', value: 'CentOS 7.9' },
      { label: 'Redis 版本', value: '7.2.4' },
      { label: '集群角色', value: 'Primary (sentinel 模式)' },
      { label: '副本状态', value: 'replica-01 ✓  replica-02 ✗', highlight: true },
      { label: '内存使用', value: '41.2 GB / 64 GB (64%)' },
      { label: '命中率', value: '98.7%' },
      { label: '数据更新', value: '8 分钟前（轻微延迟）', highlight: true },
      { label: '归属人', value: '中间件 SRE 组' },
    ],
  },
};

const RECENT_ITEMS: RecentItem[] = [
  {
    id: 'game-server-hz-042',
    name: 'game-server-hz-042',
    type: 'host',
    status: 'online',
    location: '华南 / 游戏服',
    ip: '10.16.23.42',
    freshnessMinutes: 3,
    lastVisitLabel: '3 分钟前',
  },
  {
    id: 'account-db-primary',
    name: 'account-db-primary',
    type: 'host',
    status: 'warning',
    location: '数据服务 / 主库',
    ip: '10.16.10.11',
    freshnessMinutes: 35,
    lastVisitLabel: '35 分钟前',
  },
  {
    id: 'nginx-gateway-01',
    name: 'nginx-gateway-01',
    type: 'host',
    status: 'online',
    location: '接入层 / 接入网关',
    ip: '10.16.1.10',
    freshnessMinutes: 1,
    lastVisitLabel: '昨天 14:23',
  },
];

const SEARCH_INDEX: (ResourceRef & { keywords: string[] })[] = [
  {
    id: 'game-server-hz-042',
    name: 'game-server-hz-042',
    type: 'host',
    status: 'online',
    location: '华南 / 游戏服',
    ip: '10.16.23.42',
    freshnessMinutes: 3,
    keywords: ['game', 'hz', 'server', '042', '10.16.23.42', '游戏服', '华南'],
  },
  {
    id: 'game-server-hz-039',
    name: 'game-server-hz-039',
    type: 'host',
    status: 'warning',
    location: '华南 / 游戏服',
    ip: '10.16.23.39',
    freshnessMinutes: 142,
    keywords: ['game', 'hz', 'server', '039', '华南'],
  },
  {
    id: 'game-server-sh-011',
    name: 'game-server-sh-011',
    type: 'host',
    status: 'online',
    location: '华东 / 游戏服',
    ip: '10.17.8.11',
    freshnessMinutes: 5,
    keywords: ['game', 'sh', 'server', '011', '华东'],
  },
  {
    id: 'account-db-primary',
    name: 'account-db-primary',
    type: 'host',
    status: 'warning',
    location: '数据服务 / 主库',
    ip: '10.16.10.11',
    freshnessMinutes: 35,
    keywords: ['account', 'db', 'database', 'primary', '数据', '主库'],
  },
  {
    id: 'account-db-replica',
    name: 'account-db-replica',
    type: 'host',
    status: 'online',
    location: '数据服务 / 从库',
    ip: '10.16.10.12',
    freshnessMinutes: 4,
    keywords: ['account', 'db', 'replica', '从库'],
  },
  {
    id: 'nginx-gateway-01',
    name: 'nginx-gateway-01',
    type: 'host',
    status: 'online',
    location: '接入层 / 接入网关',
    ip: '10.16.1.10',
    freshnessMinutes: 1,
    keywords: ['nginx', 'gateway', '接入', '网关'],
  },
  {
    id: 'nginx-gateway-02',
    name: 'nginx-gateway-02',
    type: 'host',
    status: 'online',
    location: '接入层 / 接入网关',
    ip: '10.16.1.11',
    freshnessMinutes: 1,
    keywords: ['nginx', 'gateway', '接入'],
  },
  {
    id: 'redis-session-01',
    name: 'redis-session-01',
    type: 'service',
    status: 'warning',
    location: '缓存集群 / 会话缓存',
    ip: '10.16.20.50',
    freshnessMinutes: 8,
    keywords: ['redis', 'session', 'cache', '缓存', '会话'],
  },
  {
    id: 'lobby-server-01',
    name: 'lobby-server-01',
    type: 'host',
    status: 'online',
    location: '接入层 / 大厅服务',
    ip: '10.16.5.22',
    freshnessMinutes: 2,
    keywords: ['lobby', 'server', '大厅'],
  },
  {
    id: 'game-api-service',
    name: 'game-api (K8s Service)',
    type: 'k8s-service',
    status: 'online',
    location: 'K8s · hz-prod / game',
    freshnessMinutes: 1,
    keywords: ['game', 'api', 'k8s', 'kubernetes', 'service', '游戏', '接口'],
  },
  {
    id: 'game-api-7f4b9c-xk2pq',
    name: 'game-api-7f4b9c-xk2pq',
    type: 'k8s-pod',
    status: 'online',
    location: 'K8s · hz-prod / game · game-server-hz-042',
    freshnessMinutes: 1,
    keywords: ['game', 'api', 'pod', 'k8s', '7f4b9c'],
  },
  {
    id: 'game-session-7c3e1a-rpx5v',
    name: 'game-session-7c3e1a-rpx5v',
    type: 'k8s-pod',
    status: 'warning',
    location: 'K8s · hz-prod / game · game-server-hz-042',
    freshnessMinutes: 1,
    keywords: ['game', 'session', 'pod', 'k8s', '7c3e1a'],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function searchResources(q: string): ResourceRef[] {
  const lower = q.toLowerCase().trim();
  if (!lower) return [];
  return SEARCH_INDEX.filter(
    (r) =>
      r.name.toLowerCase().includes(lower) ||
      (r.ip?.includes(lower) ?? false) ||
      r.keywords.some((k) => k.includes(lower)),
  ).slice(0, 6);
}

function getFreshnessBadge(minutes: number): { label: string; level: 'fresh' | 'stale' | 'old' } {
  if (minutes < 10) return { label: `${minutes}分钟前`, level: 'fresh' };
  if (minutes < 60) return { label: `${minutes}分钟前`, level: 'stale' };
  const hours = Math.floor(minutes / 60);
  return { label: `${hours}小时前`, level: 'old' };
}

function getTypeLabel(type: ResourceType): string {
  return {
    host: '主机',
    service: '服务',
    cluster: '集群',
    module: '模块',
    'k8s-node': 'K8s 节点',
    'k8s-pod': 'K8s Pod',
    'k8s-service': 'K8s Service',
  }[type];
}

function getChangeTypeLabel(type: ChangeType): string {
  return { deploy: '发布', transfer: '迁移', config: '配置', alert: '告警', attribute: '属性变更' }[
    type
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusDot: React.FC<{ status: ResourceStatus }> = ({ status }) => (
  <span className={`sw-status-dot sw-status-dot--${status}`} aria-hidden="true" />
);

const TypeBadge: React.FC<{ type: ResourceType }> = ({ type }) => (
  <span className={`sw-type-badge sw-type-badge--${type.replace('k8s-', 'k8s')}`}>
    {getTypeLabel(type)}
  </span>
);

const FreshnessBadge: React.FC<{ minutes: number }> = ({ minutes }) => {
  const { label, level } = getFreshnessBadge(minutes);
  return <span className={`sw-freshness sw-freshness--${level}`}>数据 {label}</span>;
};

// ─── Omnibox ──────────────────────────────────────────────────────────────────

interface OmniBoxProps {
  onSelect: (id: string) => void;
}

const OmniBox: React.FC<OmniBoxProps> = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResourceRef[]>([]);
  const [focused, setFocused] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);
    setResults(searchResources(q));
    setActiveIdx(-1);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && activeIdx >= 0) {
      onSelect(results[activeIdx].id);
      setQuery('');
      setResults([]);
    }
    if (e.key === 'Escape') {
      setQuery('');
      setResults([]);
      inputRef.current?.blur();
    }
  };

  const showDropdown = focused && query.length > 0 && results.length > 0;

  return (
    <div className="sw-omnibox-wrapper">
      <div className={`sw-omnibox${focused ? ' sw-omnibox--focused' : ''}`}>
        <svg className="sw-omnibox__icon" viewBox="0 0 20 20" fill="none">
          <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M13 13l3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          className="sw-omnibox__input"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="搜 IP、主机名、服务名、变更单…"
          autoComplete="off"
          spellCheck={false}
        />
        <kbd className="sw-omnibox__kbd">⌘K</kbd>
      </div>

      {showDropdown && (
        <div className="sw-omnibox__dropdown">
          {results.map((r, i) => {
            const fresh = getFreshnessBadge(r.freshnessMinutes);
            return (
              <button
                key={r.id}
                className={`sw-omnibox__result${i === activeIdx ? ' sw-omnibox__result--active' : ''}`}
                onMouseDown={() => {
                  onSelect(r.id);
                  setQuery('');
                  setResults([]);
                }}
              >
                <StatusDot status={r.status} />
                <span className="sw-omnibox__result-name">{r.name}</span>
                <span className="sw-omnibox__result-meta">
                  <span className="sw-omnibox__result-loc">{r.location}</span>
                  {r.ip && <span className="sw-omnibox__result-ip">{r.ip}</span>}
                </span>
                <span
                  className={`sw-omnibox__result-fresh sw-omnibox__result-fresh--${fresh.level}`}
                >
                  {fresh.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Command Surface ──────────────────────────────────────────────────────────

interface CommandSurfaceProps {
  onNavigate: (id: string) => void;
}

const CommandSurface: React.FC<CommandSurfaceProps> = ({ onNavigate }) => {
  return (
    <div className="sw-command">
      <div className="sw-command__hero">
        <p className="sw-command__tagline">搜索就是导航。影响就是上下文。</p>
        <OmniBox onSelect={onNavigate} />
        <p className="sw-command__hint">输入 IP、主机名、服务名，或按 ⌘K 唤起</p>
      </div>

      <div className="sw-command__sections">
        {/* Recent */}
        <section className="sw-command__section sw-command__section--recent">
          <h3 className="sw-section-title">继续上次工作</h3>
          <div className="sw-recent-list">
            {RECENT_ITEMS.map((item) => {
              const fresh = getFreshnessBadge(item.freshnessMinutes);
              return (
                <button
                  key={item.id}
                  className="sw-recent-card"
                  onClick={() => onNavigate(item.id)}
                >
                  <div className="sw-recent-card__top">
                    <StatusDot status={item.status} />
                    <span className="sw-recent-card__name">{item.name}</span>
                    {item.status === 'warning' && (
                      <span className="sw-recent-card__warn-badge">⚠ 告警</span>
                    )}
                  </div>
                  <div className="sw-recent-card__bottom">
                    <span className="sw-recent-card__loc">{item.location}</span>
                    <span className="sw-recent-card__sep">·</span>
                    <span className={`sw-recent-card__fresh sw-recent-card__fresh--${fresh.level}`}>
                      {item.lastVisitLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right column */}
        <div className="sw-command__right-col">
          {/* Pulse */}
          <section className="sw-command__section sw-command__section--pulse">
            <h3 className="sw-section-title">当前态势</h3>
            <div className="sw-pulse-list">
              <div className="sw-pulse-item sw-pulse-item--warn">
                <span className="sw-pulse-item__num">2</span>
                <span className="sw-pulse-item__label">活跃告警</span>
              </div>
              <div className="sw-pulse-item">
                <span className="sw-pulse-item__num">14</span>
                <span className="sw-pulse-item__label">变更 / 近 1h</span>
              </div>
              <div className="sw-pulse-item sw-pulse-item--stale">
                <span className="sw-pulse-item__num">23</span>
                <span className="sw-pulse-item__label">主机数据 &gt;6h 未刷新</span>
              </div>
            </div>
          </section>

          {/* Pending */}
          <section className="sw-command__section sw-command__section--pending">
            <h3 className="sw-section-title">待你确认</h3>
            <div className="sw-pending-list">
              <div className="sw-pending-item">
                <span className="sw-pending-item__count">3</span>
                <span className="sw-pending-item__label">主机迁移申请</span>
                <button className="sw-pending-item__action">查看</button>
              </div>
              <div className="sw-pending-item">
                <span className="sw-pending-item__count">1</span>
                <span className="sw-pending-item__label">归属变更待确认</span>
                <button className="sw-pending-item__action">查看</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// ─── Impact Context Tab ───────────────────────────────────────────────────────

const ImpactContextTab: React.FC<{ res: ResourceDetail }> = ({ res }) => {
  const upstream = res.dependencies.filter((d) => d.layer === 'upstream');
  const downstream = res.dependencies.filter((d) => d.layer === 'downstream');

  return (
    <div className="sw-impact">
      {/* Dependency flow */}
      <div className="sw-dep-flow">
        {/* Upstream */}
        <div className="sw-dep-col sw-dep-col--upstream">
          <div className="sw-dep-col__label">上游</div>
          {upstream.map((n) => (
            <div key={n.id} className={`sw-dep-node sw-dep-node--${n.status}`}>
              <StatusDot status={n.status} />
              <div className="sw-dep-node__body">
                <span className="sw-dep-node__name">{n.name}</span>
                {n.sublabel && <span className="sw-dep-node__sub">{n.sublabel}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Arrow */}
        <div className="sw-dep-arrows">
          <svg className="sw-dep-arrows__svg" viewBox="0 0 80 100" preserveAspectRatio="none">
            {upstream.map((_, i) => {
              const startY =
                upstream.length === 1 ? 50 : 10 + (i * 80) / (upstream.length - 1 || 1);
              return (
                <path
                  key={i}
                  d={`M 0 ${startY} C 40 ${startY}, 40 50, 80 50`}
                  stroke="var(--sw-border-strong)"
                  strokeWidth="1.5"
                  fill="none"
                />
              );
            })}
          </svg>
        </div>

        {/* Current */}
        <div className="sw-dep-col sw-dep-col--current">
          <div className="sw-dep-col__label">当前</div>
          <div className={`sw-dep-node sw-dep-node--current sw-dep-node--${res.status}`}>
            <StatusDot status={res.status} />
            <div className="sw-dep-node__body">
              <span className="sw-dep-node__name">{res.name}</span>
              <TypeBadge type={res.type} />
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="sw-dep-arrows">
          <svg className="sw-dep-arrows__svg" viewBox="0 0 80 100" preserveAspectRatio="none">
            {downstream.map((_, i) => {
              const endY =
                downstream.length === 1 ? 50 : 10 + (i * 80) / (downstream.length - 1 || 1);
              return (
                <path
                  key={i}
                  d={`M 0 50 C 40 50, 40 ${endY}, 80 ${endY}`}
                  stroke="var(--sw-border-strong)"
                  strokeWidth="1.5"
                  fill="none"
                />
              );
            })}
          </svg>
        </div>

        {/* Downstream */}
        <div className="sw-dep-col sw-dep-col--downstream">
          <div className="sw-dep-col__label">下游</div>
          {downstream.map((n) => (
            <div key={n.id} className={`sw-dep-node sw-dep-node--${n.status}`}>
              <StatusDot status={n.status} />
              <div className="sw-dep-node__body">
                <span className="sw-dep-node__name">{n.name}</span>
                {n.sublabel && <span className="sw-dep-node__sub">{n.sublabel}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Module context */}
      <div className="sw-impact__module-ctx">
        <span className="sw-impact__module-label">模块同级主机</span>
        <div className="sw-module-siblings">
          {res.moduleSiblings.map((s) => (
            <div key={s.name} className={`sw-sibling${s.isCurrent ? ' sw-sibling--current' : ''}`}>
              <StatusDot status={s.status} />
              <span className="sw-sibling__name">{s.name}</span>
              {s.isCurrent && <span className="sw-sibling__you">← 当前</span>}
            </div>
          ))}
        </div>
        <div className="sw-impact__capacity">
          <span className="sw-impact__capacity-bar-wrap">
            <span
              className="sw-impact__capacity-bar"
              style={{ width: `${res.moduleCapacityPct}%` }}
            />
          </span>
          <span className="sw-impact__capacity-pct">该主机占模块容量 {res.moduleCapacityPct}%</span>
        </div>
      </div>

      {/* K8s Node section — only for VM hosts that are also K8s nodes */}
      {res.k8sNode && (
        <div className="sw-k8s-node">
          <div className="sw-k8s-node__header">
            <span className="sw-k8s-node__badge">K8s</span>
            <span className="sw-k8s-node__title">同时作为 K8s 节点</span>
            <span className="sw-k8s-node__cluster">
              {res.k8sNode.cluster} / {res.k8sNode.namespace}
            </span>
          </div>
          <div className="sw-k8s-node__pods">
            {res.k8sNode.pods.map((p) => (
              <div key={p.name} className={`sw-k8s-pod sw-k8s-pod--${p.status}`}>
                <StatusDot status={p.status} />
                <div className="sw-k8s-pod__body">
                  <span className="sw-k8s-pod__name">{p.name}</span>
                  <span className="sw-k8s-pod__meta">
                    {p.workload} · {p.namespace} · {p.cpuReq} / {p.memReq}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div
            className={`sw-k8s-node__schedule-note${res.k8sNode.capacityWarning ? ' sw-k8s-node__schedule-note--warn' : ''}`}
          >
            <span className="sw-k8s-node__schedule-icon">
              {res.k8sNode.capacityWarning ? '⚠' : '✓'}
            </span>
            {res.k8sNode.schedulableNote}
          </div>
        </div>
      )}

      {/* Risk summary */}
      <div
        className={`sw-impact__risk-box${res.hasFailover ? ' sw-impact__risk-box--ok' : ' sw-impact__risk-box--warn'}`}
      >
        <div className="sw-impact__risk-header">
          <span className="sw-impact__risk-icon">{res.hasFailover ? '✓' : '⚠'}</span>
          <span className="sw-impact__risk-title">
            {res.hasFailover ? '有 Failover' : '无 Failover'}
            {res.failoverNote && <span className="sw-impact__risk-note">— {res.failoverNote}</span>}
          </span>
        </div>
        <p className="sw-impact__risk-desc">{res.impactNote}</p>
        {res.affectedUsers && (
          <div className="sw-impact__affected">
            <span className="sw-impact__affected-label">影响范围</span>
            <span className="sw-impact__affected-value">{res.affectedUsers}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Change Timeline Tab ──────────────────────────────────────────────────────

const ChangeTimelineTab: React.FC<{ res: ResourceDetail }> = ({ res }) => (
  <div className="sw-timeline">
    <div className="sw-timeline__header">
      <span className="sw-timeline__scope">近期变更 · {res.name}</span>
      <span className="sw-timeline__data-note">
        数据更新于 <FreshnessBadge minutes={res.freshnessMinutes} />
      </span>
    </div>
    <div className="sw-timeline__list">
      {res.changes.map((c) => (
        <div key={c.id} className={`sw-timeline__item sw-timeline__item--${c.risk ?? 'low'}`}>
          <div className="sw-timeline__dot" />
          <div className="sw-timeline__content">
            <div className="sw-timeline__meta">
              <span className="sw-timeline__time">{c.timeLabel}</span>
              <span className={`sw-timeline__type sw-timeline__type--${c.type}`}>
                {getChangeTypeLabel(c.type)}
              </span>
              {c.risk === 'high' && <span className="sw-timeline__risk-badge">高风险</span>}
            </div>
            <p className="sw-timeline__desc">{c.description}</p>
            <p className="sw-timeline__operator">操作人：{c.operator}</p>
            {c.note && <p className="sw-timeline__note">{c.note}</p>}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ─── Properties Tab ───────────────────────────────────────────────────────────

const PropertiesTab: React.FC<{ res: ResourceDetail }> = ({ res }) => (
  <div className="sw-props">
    <table className="sw-props__table">
      <tbody>
        {res.properties.map((p) => (
          <tr
            key={p.label}
            className={`sw-props__row${p.highlight ? ' sw-props__row--highlight' : ''}`}
          >
            <td className="sw-props__key">{p.label}</td>
            <td className="sw-props__val">{p.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Operations Tab ───────────────────────────────────────────────────────────

const OperationsTab: React.FC<{ res: ResourceDetail }> = ({ res }) => {
  const [confirming, setConfirming] = useState<string | null>(null);

  const ops = [
    {
      id: 'transfer',
      label: '迁移到其他模块',
      desc: '将主机从当前模块迁移至目标模块',
      risk: res.moduleCapacityPct >= 50 ? 'high' : 'medium',
      blastRadius: `模块容量 −${res.moduleCapacityPct}%${!res.hasFailover ? '，无 failover' : ''}`,
    },
    {
      id: 'release',
      label: '下线至空闲机池',
      desc: '将主机移出业务，回收至待使用资源池',
      risk: res.hasFailover ? 'medium' : 'high',
      blastRadius: res.hasFailover ? '流量自动漂移，短暂性能波动' : res.impactNote,
    },
    {
      id: 'clone',
      label: '复制主机配置',
      desc: '以当前主机规格和属性为模板快速创建',
      risk: 'low',
      blastRadius: '无影响（只读操作）',
    },
  ];

  return (
    <div className="sw-ops">
      <p className="sw-ops__intro">执行前请确认影响范围。高风险操作需要二次确认。</p>
      {ops.map((op) => (
        <div key={op.id} className={`sw-ops__card sw-ops__card--${op.risk}`}>
          <div className="sw-ops__card-top">
            <div>
              <span className="sw-ops__card-label">{op.label}</span>
              <span className="sw-ops__card-desc">{op.desc}</span>
            </div>
            <div className="sw-ops__card-actions">
              {confirming === op.id ? (
                <>
                  <button className="sw-btn sw-btn--ghost" onClick={() => setConfirming(null)}>
                    取消
                  </button>
                  <button className="sw-btn sw-btn--danger" onClick={() => setConfirming(null)}>
                    确认执行
                  </button>
                </>
              ) : (
                <button
                  className={`sw-btn sw-btn--${op.risk === 'low' ? 'default' : 'primary'}`}
                  onClick={() => setConfirming(op.id)}
                >
                  执行
                </button>
              )}
            </div>
          </div>
          <div className="sw-ops__blast">
            <span className="sw-ops__blast-label">影响范围</span>
            <span className="sw-ops__blast-value">{op.blastRadius}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─── Resource View ────────────────────────────────────────────────────────────

interface ResourceViewProps {
  resourceId: string;
  onBack: () => void;
}

const ResourceView: React.FC<ResourceViewProps> = ({ resourceId, onBack }) => {
  const [activeTab, setActiveTab] = useState<ResourceTab>('impact');
  const res = MOCK_RESOURCES[resourceId];

  if (!res) {
    return (
      <div className="sw-resource sw-resource--not-found">
        <button className="sw-back-btn" onClick={onBack}>
          ← 返回
        </button>
        <p>
          资源 "{resourceId}" 暂无详细数据（原型演示范围：game-server-hz-042 / account-db-primary /
          nginx-gateway-01 / redis-session-01）
        </p>
      </div>
    );
  }

  const fresh = getFreshnessBadge(res.freshnessMinutes);

  const TABS: { id: ResourceTab; label: string; badge?: string }[] = [
    { id: 'impact', label: '影响上下文', badge: !res.hasFailover ? '⚠' : undefined },
    { id: 'timeline', label: '变更时间线' },
    { id: 'properties', label: '属性' },
    { id: 'operations', label: '操作' },
  ];

  return (
    <div className="sw-resource">
      {/* Identity bar */}
      <div className={`sw-identity sw-identity--${res.status}`}>
        <button className="sw-back-btn" onClick={onBack}>
          <svg viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          返回
        </button>
        <div className="sw-identity__main">
          <div className="sw-identity__title-row">
            <StatusDot status={res.status} />
            <h1 className="sw-identity__name">{res.name}</h1>
            <TypeBadge type={res.type} />
            <span className={`sw-freshness sw-freshness--${fresh.level}`}>数据 {fresh.label}</span>
          </div>
          <div className="sw-identity__meta-row">
            <span>{res.ip}</span>
            <span className="sw-identity__sep">·</span>
            <span>{res.spec}</span>
            <span className="sw-identity__sep">·</span>
            <span>{res.os}</span>
            <span className="sw-identity__sep">·</span>
            <span>{res.location}</span>
            <span className="sw-identity__sep">·</span>
            <span>运行 {res.uptimeDays} 天</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sw-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`sw-tabs__tab${activeTab === t.id ? ' sw-tabs__tab--active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
            {t.badge && <span className="sw-tabs__badge">{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="sw-tab-content">
        {activeTab === 'impact' && <ImpactContextTab res={res} />}
        {activeTab === 'timeline' && <ChangeTimelineTab res={res} />}
        {activeTab === 'properties' && <PropertiesTab res={res} />}
        {activeTab === 'operations' && <OperationsTab res={res} />}
      </div>
    </div>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────

const SreWorkbench: React.FC = () => {
  const [view, setView] = useState<View>('command');
  const [resourceId, setResourceId] = useState<string | null>(null);

  const handleNavigate = useCallback((id: string) => {
    setResourceId(id);
    setView('resource');
  }, []);

  const handleBack = useCallback(() => {
    setView('command');
    setResourceId(null);
  }, []);

  return (
    <div className="sw-page">
      {/* Brand bar */}
      <header className="sw-brand-bar">
        <div className="sw-brand-bar__left">
          <span className="sw-brand-bar__logo">◆</span>
          <span className="sw-brand-bar__name">文德</span>
          <span className="sw-brand-bar__slash">/</span>
          <span className="sw-brand-bar__product">配置平台</span>
        </div>
        <div className="sw-brand-bar__right">
          <span className="sw-brand-bar__context">华南大区</span>
          <span className="sw-brand-bar__sep">·</span>
          <span className="sw-brand-bar__context">SRE 值班</span>
          <span className="sw-brand-bar__sep">·</span>
          <span className="sw-brand-bar__date">2026-04-06</span>
          <span className="sw-brand-bar__env">PROTOTYPE</span>
        </div>
      </header>

      {/* Main */}
      <main className="sw-main">
        {view === 'command' && <CommandSurface onNavigate={handleNavigate} />}
        {view === 'resource' && resourceId && (
          <ResourceView resourceId={resourceId} onBack={handleBack} />
        )}
      </main>

      {/* Footer */}
      <footer className="sw-footer">
        新范式原型：搜索优先 · 时间维度 · 影响链即上下文 — 本地 mock 数据，仅供设计评审
      </footer>
    </div>
  );
};

export default SreWorkbench;
