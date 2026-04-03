import React, { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import {
  BranchesOutlined,
  ClusterOutlined,
  DatabaseOutlined,
  DeploymentUnitOutlined,
  RadarChartOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import './style.css';

type SectionKey =
  | 'workbench'
  | 'topology'
  | 'directory'
  | 'pools'
  | 'impact'
  | 'governance'
  | 'platform';

interface StatItem {
  label: string;
  value: string;
  hint: string;
}

interface SurfaceItem {
  id: string;
  label: string;
  meta: string;
  badge: string;
  summary: string;
}

interface PerspectiveItem {
  key: string;
  label: string;
  headline: string;
  summary: string;
  callout: string;
  evidenceTitle: string;
  evidenceRows: Array<[string, string]>;
  timeline: string[];
}

interface CommandItem {
  title: string;
  meta: string;
}

interface SectionDefinition {
  key: SectionKey;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  stats: StatItem[];
  primaryLabel: string;
  secondaryLabel: string;
  sectionLabel: string;
  surfaces: SurfaceItem[];
  perspectives: PerspectiveItem[];
  commandDeck: CommandItem[];
  designNotes: CommandItem[];
}

const sections: SectionDefinition[] = [
  {
    key: 'workbench',
    label: '工作台',
    eyebrow: 'Command Surface',
    title: '统一资源真相，从工作上下文开始。',
    description:
      '高保真首页不强调空泛指标，而是把最近工作、待处理风险和可立即进入的行动面板放到同一张操作台。',
    icon: <RadarChartOutlined />,
    sectionLabel: '今日操作焦点',
    primaryLabel: '恢复最近工作',
    secondaryLabel: '查看风险队列',
    stats: [
      { label: '最近工作', value: '12', hint: '保留到节点级上下文' },
      { label: '高优风险', value: '7', hint: '待人工确认' },
      { label: '常用查询', value: '18', hint: '已固化到工作台' },
    ],
    surfaces: [
      {
        id: 'wzry-hb',
        label: '王者荣耀 / 华北区 / 游戏服',
        meta: '资源转移 · 10 分钟前',
        badge: '继续处理',
        summary: '恢复上次工作时，直接回到“业务拓扑 / 游戏服节点 / 资源 tab”的状态。',
      },
      {
        id: 'db-impact',
        label: 'account-db-primary',
        meta: '影响分析 · 35 分钟前',
        badge: '高风险',
        summary: '数据库变更不应该再靠口头经验，工作台要把它作为一等任务暴露出来。',
      },
      {
        id: 'cache-governance',
        label: 'cache-east-1',
        meta: '资源目录 · 今天 14:20',
        badge: '来源冲突',
        summary: '资源与治理之间应当双向联通，问题要能直接跳回处理页面。',
      },
    ],
    perspectives: [
      {
        key: 'resume',
        label: '恢复工作',
        headline: '首页首先回答“我现在继续做什么”。',
        summary: '用一个连续的操作面替代传统 CMDB 首页的大屏指标，把用户直接送回任务流。',
        callout: '不是统计少了，而是把统计降到背景，把操作拉到前景。',
        evidenceTitle: '工作台区块',
        evidenceRows: [
          ['最近工作', '保留最近一次节点、tab、筛选和变更上下文'],
          ['待处理问题', '孤儿资源 / 字段冲突 / 待确认变更'],
          ['快捷入口', '业务拓扑 / 资源目录 / 影响分析'],
        ],
        timeline: [
          '09:10 恢复到“华北区 / 游戏服 / 资源 tab”',
          '09:13 发现 1 个来源冲突，转治理中心',
          '09:21 返回影响分析，确认数据库窗口',
        ],
      },
      {
        key: 'queue',
        label: '风险队列',
        headline: '风险和入口连在一起，而不是散落在多个页签。',
        summary: '问题本身就是入口，首页不只展示数量，还直接说明下一步动作。',
        callout: '每个问题都应能落到一个确定的工作页面，不让用户自己猜去哪处理。',
        evidenceTitle: '风险编排',
        evidenceRows: [
          ['孤儿资源', '回到资源池或业务拓扑补归属'],
          ['字段冲突', '在治理中心做来源仲裁'],
          ['高风险变更', '进入影响分析确认 blast radius'],
        ],
        timeline: [
          '资源问题进入治理中心',
          '拓扑问题回到业务拓扑工作区',
          '变更风险跳转到影响分析',
        ],
      },
    ],
    commandDeck: [
      { title: '继续上次工作', meta: '恢复节点、筛选条件和当前 tab' },
      { title: '查看治理问题', meta: '孤儿资源 / 冲突来源 / 字段漂移' },
      { title: '切换到资源目录', meta: '跨类型搜索资源，不再先猜系统归属' },
    ],
    designNotes: [
      { title: '把任务放在前面', meta: '运维上来是为了干活，不是为了先看运营大屏。' },
      { title: '问题可进入', meta: '每条风险都给出明确去向，减少导航认知成本。' },
      { title: '上下文不中断', meta: '恢复工作是下一代工作台的核心价值，不是附属功能。' },
    ],
  },
  {
    key: 'topology',
    label: '业务拓扑',
    eyebrow: 'Projection Workspace',
    title: '拓扑是工作区，不是单纯的一棵树。',
    description:
      '高保真业务拓扑要让树、节点上下文和变更面板形成完整闭环，而不是左树右详情的老式后台结构。',
    icon: <DeploymentUnitOutlined />,
    sectionLabel: '当前节点 / 华北区 / 游戏服',
    primaryLabel: '查看当前节点',
    secondaryLabel: '发起资源转移',
    stats: [
      { label: '活跃业务', value: '42', hint: '按区服与环境切面聚合' },
      { label: '挂载资源', value: '3,248', hint: 'VM / K8s / DB 混合' },
      { label: '今日变更', value: '19', hint: '聚焦当前节点相关操作' },
    ],
    surfaces: [
      {
        id: 'node-game-server',
        label: '华北区 / 游戏服',
        meta: 'Deployment + 6 hosts + service binding',
        badge: '当前选中',
        summary: '这是用户真正操作的上下文节点，不是被动详情展示对象。',
      },
      {
        id: 'node-gateway',
        label: '华北区 / 网关',
        meta: '2 workloads + 1 public LB',
        badge: '流量入口',
        summary: '业务树负责切换节点，真正的操作和信息在右侧统一工作区完成。',
      },
      {
        id: 'node-pool',
        label: '空闲机池',
        meta: '18 台待分配主机',
        badge: '资源池联动',
        summary: '拓扑与资源池必须能互相跳转，否则空闲资源永远只是附属能力。',
      },
    ],
    perspectives: [
      {
        key: 'resource',
        label: '资源视角',
        headline: '资源、服务、详情、变更要在同一工作区里切换。',
        summary: '树只负责定位节点，真正的浏览和操作应该落在统一工作区，而不是分散到多个弹窗与跳转页。',
        callout: '这里的中心不是“主机列表”，而是“当前节点的完整操作上下文”。',
        evidenceTitle: '当前节点工作区',
        evidenceRows: [
          ['资源', 'host:10.0.1.12 / 10.0.1.13 / workload:game-server'],
          ['服务', 'gateway / account-service / matchmaker'],
          ['详情', '责任归属 / 生命周期 / 来源可信度'],
        ],
        timeline: [
          '选中节点后默认进入资源视角',
          '资源转移、挂载、回收都不离开当前工作区',
          '详情保持在同一屏完成确认',
        ],
      },
      {
        key: 'change',
        label: '变更视角',
        headline: '变更窗口与依赖提示一起出现，而不是散落在工单里。',
        summary: '当用户准备做节点级操作时，拓扑页应直接展示最近变更、依赖提醒和建议动作，而不是只给一个树和一个列表。',
        callout: '拓扑页天然是“操作前确认”的入口，应当承担部分影响分析职责。',
        evidenceTitle: '变更上下文',
        evidenceRows: [
          ['最近挂载调整', '24 小时内 2 次节点资源变化'],
          ['依赖提醒', 'gateway 入口流量受华北区游戏服影响'],
          ['建议动作', '先看 blast radius，再执行转移'],
        ],
        timeline: [
          '变更前先看依赖提醒',
          '节点内直接查看最近 24 小时调整',
          '一键跳转到影响分析页做深度确认',
        ],
      },
    ],
    commandDeck: [
      { title: '加入主机', meta: '将资源池主机直接挂载到当前节点' },
      { title: '资源转移', meta: '跨业务或跨集群转移资源时保留上下文' },
      { title: '切到影响分析', meta: '对当前节点执行 blast radius 检查' },
    ],
    designNotes: [
      { title: '树不是主角', meta: '树只负责导航；真正的产品价值在节点工作区。' },
      { title: '操作前确认', meta: '拓扑页要接住变更风险，不应只做浏览。' },
      { title: '资源与服务并列', meta: '避免把主机视角伪装成完整业务视图。' },
    ],
  },
  {
    key: 'directory',
    label: '资源目录',
    eyebrow: 'Cross-Type Search',
    title: '跨类型搜索，不再按系统分仓找资源。',
    description:
      '真正的资源目录不是“主机页的升级版”，而是跨资源类型的统一搜索和详情系统。',
    icon: <DatabaseOutlined />,
    sectionLabel: '搜索 host:10.0.1.100',
    primaryLabel: '搜索 host:10.0.1.100',
    secondaryLabel: '切换关系视图',
    stats: [
      { label: '可检索类型', value: '28', hint: 'host / DB / LB / workload / cache' },
      { label: '高可信资源', value: '91%', hint: '来源冲突可追溯' },
      { label: '关系边', value: '4.2M', hint: '影响分析与拓扑共用' },
    ],
    surfaces: [
      {
        id: 'resource-host',
        label: 'host:10.0.1.100',
        meta: 'infra / 华北A / online',
        badge: '高相关',
        summary: '搜索结果应该把“为什么你会看到它”说明白，而不是只展示一串名字。',
      },
      {
        id: 'resource-db',
        label: 'mysql:account-db-primary',
        meta: 'app / 王者荣耀',
        badge: 'runs_on',
        summary: '资源详情要统一承载归属、来源、关系和历史，不能再分散到不同系统页。',
      },
      {
        id: 'resource-lb',
        label: 'lb:gateway-public',
        meta: 'network / 王者荣耀',
        badge: 'depends_on',
        summary: '跨类型搜索是资源目录的核心，不应再让用户先理解它属于哪个管理子系统。',
      },
    ],
    perspectives: [
      {
        key: 'detail',
        label: '详情视角',
        headline: '详情页是统一资源框架，不再按资源种类重造一套页面。',
        summary: '用户查到资源后，应该在一页里看到归属、来源、关系、历史和建议动作。',
        callout: '详情不分主机、数据库还是 K8s 资源，结构统一、内容按类型投影。',
        evidenceTitle: '详情结构',
        evidenceRows: [
          ['归属', '王者荣耀 / 华北区 / 数据服务'],
          ['来源', 'manual + agent + cloud-sync'],
          ['关系', 'runs_on / depends_on / managed_by'],
        ],
        timeline: [
          '搜索结果进入详情',
          '详情页内切关系、历史与来源视图',
          '需要时直接跳回业务拓扑或影响分析',
        ],
      },
      {
        key: 'relation',
        label: '关系视角',
        headline: '关系不是一张图炫技，而是为了支持定位与分析。',
        summary: '关系视角应当回答“它挂在哪、依赖谁、谁依赖它”，而不是只画一个难以操作的关系网。',
        callout: '把关系读成决策语言，而不是把图形本身当产品。',
        evidenceTitle: '关系视图',
        evidenceRows: [
          ['承载关系', 'mysql:account-db-primary runs_on host:10.0.1.100'],
          ['依赖关系', 'gateway-public depends_on game-server'],
          ['管理关系', 'host managed_by 华北区 / 数据服务'],
        ],
        timeline: [
          '先读归属与承载',
          '再展开依赖路径',
          '需要时转到 blast radius 做全局分析',
        ],
      },
    ],
    commandDeck: [
      { title: '查看资源详情', meta: '统一详情页承接跨类型资源' },
      { title: '切换关系视图', meta: '从归属切到依赖，不离开当前对象' },
      { title: '标记冲突来源', meta: '把资源可信度问题送入治理中心' },
    ],
    designNotes: [
      { title: '搜索优先', meta: '用户先查资源，再理解归属，而不是先猜页面入口。' },
      { title: '详情统一', meta: '资源目录是统一台账，不是各类资源页拼盘。' },
      { title: '关系服务决策', meta: '关系视图为定位和分析服务，而不是为了炫耀图数据库。' },
    ],
  },
  {
    key: 'pools',
    label: '资源池',
    eyebrow: 'Inventory Flow',
    title: '资源池独立成面，不再挂在拓扑后面。',
    description:
      '资源池是库存运营界面，强调状态、批量动作和分配历史，不再被压缩成拓扑页里的附属弹窗。',
    icon: <ClusterOutlined />,
    sectionLabel: '待分配库存 / 华北A',
    primaryLabel: '查看空闲资源',
    secondaryLabel: '导出待分配清单',
    stats: [
      { label: '待分配', value: '64', hint: '可直接投放到业务节点' },
      { label: '待回收', value: '11', hint: '需先确认影响' },
      { label: '复用率', value: '78%', hint: '过去 30 天库存利用率' },
    ],
    surfaces: [
      {
        id: 'pool-hb',
        label: '华北A / 16C64G',
        meta: '22 台空闲',
        badge: '主库存',
        summary: '资源池的基本面是区域与规格，而不是业务树上的一个特殊节点。',
      },
      {
        id: 'pool-hd',
        label: '华东B / 32C128G',
        meta: '9 台待回收',
        badge: '成本高',
        summary: '库存页需要支持运营决策，例如回收优先级和资源再利用策略。',
      },
      {
        id: 'pool-cloud',
        label: '腾讯云 / c7.large',
        meta: '33 台待分配',
        badge: '弹性池',
        summary: '资源池不只是物理机库存，也要容纳云实例和后续弹性资源。',
      },
    ],
    perspectives: [
      {
        key: 'inventory',
        label: '库存视角',
        headline: '库存页强调“有什么、在哪、状态怎样”，而不是只列主机名。',
        summary: '库存是运营对象，应该优先展示区域、规格、状态和可分配性。',
        callout: '这里的界面语言是“运营状态”，不是“模型字段”。',
        evidenceTitle: '库存维度',
        evidenceRows: [
          ['区域 / 机房', '华北A / 华东B / 腾讯云账号'],
          ['规格', '16C64G / 32C128G / c7.large'],
          ['状态', '空闲 / 待分配 / 待回收 / 不可用'],
        ],
        timeline: [
          '先看库存分布',
          '再筛选待分配与待回收',
          '最后做批量动作',
        ],
      },
      {
        key: 'allocation',
        label: '分配视角',
        headline: '批量分配和回收是资源池的主动作，不该藏在二级弹窗里。',
        summary: '资源池页面应直接承接批量分配、回收和隔离故障库存。',
        callout: '库存页是运维运营面板，不是静态台账。',
        evidenceTitle: '调度动作',
        evidenceRows: [
          ['分配到业务', '将库存直接绑定到业务拓扑节点'],
          ['回收到资源池', '保留归属历史与最近责任人'],
          ['标记不可用', '避免故障库存再次进入分配链路'],
        ],
        timeline: [
          '批量选中库存',
          '执行分配或回收',
          '同步业务拓扑与历史记录',
        ],
      },
    ],
    commandDeck: [
      { title: '批量分配到业务', meta: '从库存直接进入拓扑节点' },
      { title: '发起回收流程', meta: '保留原归属和最后责任人' },
      { title: '标记库存不可用', meta: '隔离故障库存，避免误分配' },
    ],
    designNotes: [
      { title: '库存先独立', meta: '资源池不是拓扑页的附属能力，而是独立运营界面。' },
      { title: '状态是主角', meta: '待分配 / 待回收是产品语言，不是底层模型字段。' },
      { title: '批量动作优先', meta: '资源池的主要价值来自批量调度，而不是单条详情。' },
    ],
  },
  {
    key: 'impact',
    label: '影响分析',
    eyebrow: 'Blast Radius',
    title: '变更前先看影响，不再靠经验口口相传。',
    description:
      '高保真影响分析页把对象输入、风险摘要、依赖路径和建议动作整合到一张决策面板里。',
    icon: <BranchesOutlined />,
    sectionLabel: '变更对象 / host:10.0.1.100',
    primaryLabel: '分析 host:10.0.1.100',
    secondaryLabel: '生成操作建议',
    stats: [
      { label: '高风险变更', value: '5', hint: '近 24 小时待确认' },
      { label: '依赖路径', value: '37', hint: '受控投影后的结果' },
      { label: '建议动作', value: '12', hint: '可导出为操作草案' },
    ],
    surfaces: [
      {
        id: 'impact-host',
        label: 'host:10.0.1.100',
        meta: '华北A / 王者荣耀',
        badge: '当前分析',
        summary: '输入对象应该始终可见，避免分析结果和变更对象脱节。',
      },
      {
        id: 'impact-db',
        label: 'mysql:account-db-primary',
        meta: '主库 / 单点风险',
        badge: '高优先级',
        summary: '数据库等关键资源需要比普通节点更强的风险提示和操作建议。',
      },
      {
        id: 'impact-k8s',
        label: 'k8s_workload:game-server',
        meta: '华东区 / 32 pods',
        badge: '运行时',
        summary: '影响分析不应只看主机；未来需要同时支持运行时工作负载。',
      },
    ],
    perspectives: [
      {
        key: 'summary',
        label: '风险摘要',
        headline: '结果先讲“影响谁”，再讲“图怎么走”。',
        summary: '影响分析页面首先应该输出业务与服务层面的风险摘要，再为专业用户提供依赖路径细节。',
        callout: '让人先做决策，再看证据，不要一上来塞满技术图。',
        evidenceTitle: '影响摘要',
        evidenceRows: [
          ['影响业务', '王者荣耀 / 原神'],
          ['影响服务', 'MySQL 主库 / Redis / account-service'],
          ['建议窗口', '凌晨 02:00-04:00'],
        ],
        timeline: [
          '先确认影响范围',
          '再展开依赖证据',
          '最后生成执行建议',
        ],
      },
      {
        key: 'path',
        label: '依赖路径',
        headline: '依赖路径是证据层，不是视觉表演。',
        summary: '图路径只在用户需要证据时展开，默认不让界面陷入“关系图炫技”。',
        callout: '影响分析要先服务判断，再服务深挖。',
        evidenceTitle: '依赖证据',
        evidenceRows: [
          ['host -> mysql', 'host:10.0.1.100 runs_on mysql:account-db-primary'],
          ['mysql -> business', 'account-db-primary belongs_to 王者荣耀'],
          ['host -> redis', 'host 同时承载 redis:cache-east-1'],
        ],
        timeline: [
          '按受控边类型展开路径',
          '过滤无关归档关系',
          '导出为变更前检查报告',
        ],
      },
    ],
    commandDeck: [
      { title: '生成操作建议', meta: '先做主从切换，再安排窗口' },
      { title: '导出检查结果', meta: '给审批与值班同学共享' },
      { title: '跳到资源详情', meta: '回到具体资源确认来源与归属' },
    ],
    designNotes: [
      { title: '先业务后技术', meta: '先讲影响范围，再讲依赖路径。' },
      { title: '证据可追溯', meta: '每个结论都应能回到具体资源与边。' },
      { title: '为 AI 预留接口', meta: '未来自然语言查询优先落到这种受控页面。' },
    ],
  },
  {
    key: 'governance',
    label: '治理中心',
    eyebrow: 'Data Trust',
    title: '治理中心解决“这份 CMDB 能不能信”。',
    description:
      '治理中心不是大杂烩列表，而是把冲突、重复、孤儿和漂移组织成一个可闭环的可信度工作面。',
    icon: <SafetyCertificateOutlined />,
    sectionLabel: '可信度队列 / 待仲裁',
    primaryLabel: '处理重复资源',
    secondaryLabel: '查看可信度规则',
    stats: [
      { label: '重复资源', value: '12', hint: '需要平台团队合并' },
      { label: '孤儿资源', value: '9', hint: '缺少业务归属' },
      { label: '可信度', value: '93%', hint: '可继续追到来源证据' },
    ],
    surfaces: [
      {
        id: 'gov-dup',
        label: 'host:node-a / host:10.0.1.12',
        meta: '疑似重复',
        badge: '建议合并',
        summary: '重复资源处理应给出合并建议，而不是只提示“可能重复”。',
      },
      {
        id: 'gov-conflict',
        label: 'redis:cache-east-1',
        meta: '来源冲突',
        badge: 'agent vs cloud',
        summary: '来源冲突应带上证据和优先级，而不是让人去多个系统交叉比对。',
      },
      {
        id: 'gov-orphan',
        label: 'mysql:archive-db',
        meta: '孤儿资源',
        badge: '缺少归属',
        summary: '孤儿资源处理要能直接送回业务拓扑或资源池，不然治理永远停在列表层。',
      },
    ],
    perspectives: [
      {
        key: 'triage',
        label: '仲裁视角',
        headline: '治理页面要支持仲裁，而不是只做报警展示。',
        summary: '高保真治理中心应把问题、证据、推荐动作和结果记录连成闭环。',
        callout: '可信度提升来自可处理的流程，不来自更多红点。',
        evidenceTitle: '仲裁动作',
        evidenceRows: [
          ['合并资源', '保留高可信来源，记录人工决策'],
          ['标记已知差异', '允许临时白名单，不污染主数据'],
          ['回填归属', '将孤儿资源送回业务拓扑或资源池'],
        ],
        timeline: [
          '先按风险排序',
          '再做人工仲裁',
          '最后把结果回写到目录和拓扑',
        ],
      },
      {
        key: 'trust',
        label: '可信度视角',
        headline: '可信度不是一个分数，而是一组可解释证据。',
        summary: '来源优先级、更新时间和字段冲突都应在治理面板里可见可解释。',
        callout: '用户不需要相信系统“说自己可信”，而需要看到证据链。',
        evidenceTitle: '可信度证据',
        evidenceRows: [
          ['来源优先级', 'cloud-sync > agent > manual for host status'],
          ['更新时间', '最近同步 6 分钟前'],
          ['字段冲突', 'CPU 核数 agent=16 / cloud=32'],
        ],
        timeline: [
          '展示可信度来源',
          '突出最近冲突字段',
          '支持快速标记已知差异',
        ],
      },
    ],
    commandDeck: [
      { title: '合并重复资源', meta: '保留高可信来源并写回审计' },
      { title: '标记已知差异', meta: '防止临时冲突反复打扰' },
      { title: '回填业务归属', meta: '把孤儿资源送回业务或资源池' },
    ],
    designNotes: [
      { title: '问题集中处理', meta: '治理应单独成面，不分散在各详情页。' },
      { title: '证据先于分数', meta: '可信度需要来源、时间和冲突字段支撑。' },
      { title: '处理结果回流', meta: '治理动作要反向影响目录、拓扑和影响分析。' },
    ],
  },
  {
    key: 'platform',
    label: '平台配置',
    eyebrow: 'Type Registry',
    title: '类型中心管理资源表达，不占用一线入口。',
    description:
      '高保真平台配置页面向管理员，承载类型注册、关系规则、投影配置和接入策略，而不是成为一线主入口。',
    icon: <SettingOutlined />,
    sectionLabel: '类型中心 / 平台配置',
    primaryLabel: '编辑类型中心',
    secondaryLabel: '查看关系规则',
    stats: [
      { label: '内置类型', value: '14', hint: '由平台统一维护' },
      { label: '自定义类型', value: '8', hint: '供团队扩展领域资源' },
      { label: '关系规则', value: '19', hint: '显式控制拓扑与分析语义' },
    ],
    surfaces: [
      {
        id: 'type-business',
        label: 'business',
        meta: 'org / builtin / topology + directory',
        badge: '核心类型',
        summary: '类型中心应该直接告诉管理员它出现在什么投影里，而不只是一段 schema。',
      },
      {
        id: 'type-host',
        label: 'host',
        meta: 'infra / builtin / directory + impact',
        badge: '高频资源',
        summary: '对高频资源，身份规则、搜索字段和来源策略应该成为一等信息。',
      },
      {
        id: 'type-db',
        label: 'database',
        meta: 'app / custom / topology + impact',
        badge: '自定义类型',
        summary: '平台配置页应承担自定义类型的治理，不应让一线用户频繁进入这里。',
      },
    ],
    perspectives: [
      {
        key: 'types',
        label: '类型视角',
        headline: '类型中心管理的是资源表达，不是面向用户的主导航。',
        summary: '管理员关注 schema、身份规则、搜索字段和可用投影，而不是普通用户的日常操作流。',
        callout: '把类型配置降级到平台配置，是为了让主导航回到用户任务。',
        evidenceTitle: '类型定义',
        evidenceRows: [
          ['Schema', 'JSON Schema + x-identity + x-search-fields'],
          ['投影配置', 'topology / directory / impact / governance'],
          ['来源策略', 'manual / agent / cloud-sync / k8s'],
        ],
        timeline: [
          '定义类型',
          '配置关系和投影',
          '开放给目录和拓扑消费',
        ],
      },
      {
        key: 'rules',
        label: '关系规则',
        headline: '关系规则必须显式配置，不能散落在前后端 if/else 里。',
        summary: '高保真平台页应直接解释哪些关系用于拓扑、哪些用于影响分析、哪些只是归档关系。',
        callout: '这是避免重新长出“隐式主线模型”的关键页面。',
        evidenceTitle: '关系语义',
        evidenceRows: [
          ['contains', '用于业务拓扑与资源池树'],
          ['runs_on', '用于承载关系与影响分析'],
          ['depends_on', '用于依赖链与 blast radius'],
        ],
        timeline: [
          '定义关系类型',
          '绑定到投影语义',
          '供查询层、权限层、AI 共用',
        ],
      },
    ],
    commandDeck: [
      { title: '编辑资源类型', meta: '配置 schema、身份规则和搜索字段' },
      { title: '查看关系规则', meta: '确认拓扑、承载和依赖的语义归属' },
      { title: '配置接入策略', meta: '决定类型是否支持 manual / sync / k8s ingestion' },
    ],
    designNotes: [
      { title: '类型不做主入口', meta: '这页服务管理员，不打扰一线运维。' },
      { title: '规则显式配置', meta: '把拓扑和分析语义从隐式代码逻辑里拎出来。' },
      { title: '为 AI 预留上下文', meta: '类型与关系规则最终会成为受控查询的上下文输入。' },
    ],
  },
];

const sectionMap = new Map(sections.map((section) => [section.key, section]));

const footerNotes = [
  'Hi-Fi prototype only: local state + local mock data.',
  'Navigation is task-oriented; graph concepts stay beneath the UI.',
  'Designed for SRE, platform, and operations review conversations.',
];

const getSection = (sectionKey?: string): SectionDefinition =>
  sectionMap.get((sectionKey as SectionKey) || 'workbench') || sections[0];

const CmdbNextPrototype: React.FC = () => {
  const { section } = useParams<{ section?: string }>();
  const currentSection = getSection(section);

  const [activeSurface, setActiveSurface] = useState(currentSection.surfaces[0].id);
  const [activePerspective, setActivePerspective] = useState(currentSection.perspectives[0].key);

  useEffect(() => {
    setActiveSurface(currentSection.surfaces[0].id);
    setActivePerspective(currentSection.perspectives[0].key);
  }, [currentSection]);

  const selectedSurface =
    currentSection.surfaces.find((item) => item.id === activeSurface) || currentSection.surfaces[0];
  const selectedPerspective =
    currentSection.perspectives.find((item) => item.key === activePerspective)
    || currentSection.perspectives[0];

  return (
    <div className="cmdb-next">
      <div className="cmdb-next__noise" />
      <header className="cmdb-next__masthead">
        <div className="cmdb-next__identity">
          <div className="cmdb-next__brand-mark">RG</div>
          <div className="cmdb-next__identity-copy">
            <p className="cmdb-next__eyebrow">Next-Gen CMDB Prototype</p>
            <h1>面向运维任务，而不是面向底层模型。</h1>
            <p>
              这是一套高保真交互原型，用来讨论下一代 CMDB 的产品表达，而不是替换现有系统。
            </p>
          </div>
        </div>

        <div className="cmdb-next__masthead-meta">
          <span className="cmdb-next__meta-badge">Hi-Fi Interactive Prototype</span>
          <span>{currentSection.sectionLabel}</span>
          <span>Target: 米哈游级别运维协作场景</span>
        </div>
      </header>

      <nav className="cmdb-next__nav" aria-label="Prototype sections">
        {sections.map((item) => (
          <NavLink
            key={item.key}
            to={`/prototype/cmdb-next/${item.key}`}
            className={({ isActive }) =>
              `cmdb-next__nav-item${isActive ? ' cmdb-next__nav-item--active' : ''}`
            }
          >
            <span className="cmdb-next__nav-icon" aria-hidden="true">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <main className="cmdb-next__workspace">
        <section className="cmdb-next__hero">
          <div className="cmdb-next__hero-copy">
            <p className="cmdb-next__eyebrow">{currentSection.eyebrow}</p>
            <h2>{currentSection.title}</h2>
            <p>{currentSection.description}</p>
          </div>

          <div className="cmdb-next__hero-actions">
            <button type="button" className="cmdb-next__primary-action">
              {currentSection.primaryLabel}
            </button>
            <button type="button" className="cmdb-next__secondary-action">
              {currentSection.secondaryLabel}
            </button>
          </div>
        </section>

        <section className="cmdb-next__metrics" aria-label="Section stats">
          {currentSection.stats.map((stat) => (
            <article key={stat.label} className="cmdb-next__metric">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <p>{stat.hint}</p>
            </article>
          ))}
        </section>

        <div className="cmdb-next__main-grid">
          <aside className="cmdb-next__surface-rail">
            <div className="cmdb-next__panel-head">
              <h3>对象轨道</h3>
              <span>当前页面的核心对象</span>
            </div>
            <div className="cmdb-next__surface-list">
              {currentSection.surfaces.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`cmdb-next__surface-item${
                    item.id === selectedSurface.id ? ' cmdb-next__surface-item--active' : ''
                  }`}
                  onClick={() => setActiveSurface(item.id)}
                >
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.meta}</p>
                  </div>
                  <span>{item.badge}</span>
                </button>
              ))}
            </div>

            <div className="cmdb-next__surface-summary">
              <p className="cmdb-next__surface-summary-label">当前对象说明</p>
              <p>{selectedSurface.summary}</p>
            </div>
          </aside>

          <section className="cmdb-next__focus-stage">
            <div className="cmdb-next__panel-head">
              <h3>主操作台</h3>
              <span>用同一张界面承接浏览、判断与动作</span>
            </div>

            <div className="cmdb-next__perspectives">
              {currentSection.perspectives.map((perspective) => (
                <button
                  type="button"
                  key={perspective.key}
                  className={`cmdb-next__perspective${
                    perspective.key === selectedPerspective.key
                      ? ' cmdb-next__perspective--active'
                      : ''
                  }`}
                  onClick={() => setActivePerspective(perspective.key)}
                >
                  {perspective.label}
                </button>
              ))}
            </div>

            <div className="cmdb-next__focus-story">
              <div className="cmdb-next__focus-intro">
                <p className="cmdb-next__focus-tag">{selectedSurface.badge}</p>
                <h3>{selectedPerspective.headline}</h3>
                <p>{selectedPerspective.summary}</p>
                <div className="cmdb-next__callout">{selectedPerspective.callout}</div>
              </div>

              <div className="cmdb-next__evidence-grid">
                <div className="cmdb-next__evidence-card">
                  <div className="cmdb-next__panel-head">
                    <h4>{selectedPerspective.evidenceTitle}</h4>
                    <span>{selectedSurface.label}</span>
                  </div>
                  <div className="cmdb-next__evidence-rows">
                    {selectedPerspective.evidenceRows.map(([label, value]) => (
                      <div key={label} className="cmdb-next__evidence-row">
                        <span>{label}</span>
                        <strong>{value}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="cmdb-next__timeline-card">
                  <div className="cmdb-next__panel-head">
                    <h4>交互节奏</h4>
                    <span>用户在这一页如何工作</span>
                  </div>
                  <ol className="cmdb-next__timeline">
                    {selectedPerspective.timeline.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          </section>

          <aside className="cmdb-next__operator-rail">
            <div className="cmdb-next__panel-head">
              <h3>操作与说明</h3>
              <span>更像真实产品评审稿，而不是线框图</span>
            </div>

            <div className="cmdb-next__operator-block">
              <p className="cmdb-next__operator-label">Command deck</p>
              {currentSection.commandDeck.map((item) => (
                <div key={item.title} className="cmdb-next__operator-item">
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                </div>
              ))}
            </div>

            <div className="cmdb-next__operator-block">
              <p className="cmdb-next__operator-label">设计原则</p>
              {currentSection.designNotes.map((item) => (
                <div key={item.title} className="cmdb-next__operator-item cmdb-next__operator-item--soft">
                  <strong>{item.title}</strong>
                  <p>{item.meta}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>

      <footer className="cmdb-next__footer">
        {footerNotes.map((note) => (
          <span key={note}>{note}</span>
        ))}
      </footer>
    </div>
  );
};

export default CmdbNextPrototype;
