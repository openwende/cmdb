# 主机资源：搜索和主机详情

## 背景

用户 2026-10-11 人工核对 AI 调查助手的回答时发现两个问题：主机资源页的搜索框不能用；系统里看不到一台主机的详细属性（CPU、内存、自定义字段等），没法核对。AI 回答里的 `[host_id=43]` 目前也只是不可点击的标签（提示"暂无主机详情页"）。

现状（2026-10-13 查代码）：

- **搜索框是空壳**：资源 → 主机（`/resource/host`）的 `src/pages/Resource/Host/HostList/index.tsx:214-219` 是一个没有 `value` / `onChange` / `onSearch` 的 `Input.Search`；列表数据来自 `src/store/PoolHostStore.ts`，查询参数只有 `directoryId`、`page`、`pageSize`（服务端分页）。占位文字写"请输入IP或固资编号"，但固资编号不是主机表字段，只出现在部分主机的自定义字段里（如 `custom_fields.固资编号`），本次不做按自定义字段搜索
- **后端也不支持**：`GET /api/v1/resource-pool/hosts` 只收 `directory_id`、`page`、`page_size`，没有关键字，查询也没有排序（分页顺序不稳定）
- **没有主机详情**：前端没有任何主机详情抽屉或页面（`pages/Resource/Host/components/OperationDetails` 是删除历史的 mock，不是详情）。后端 `GET /api/v1/hosts/:id` 只认 UUID、不带 `{code,data}` 外壳、不带业务 / 集群 / 模块名称，前端也没调用过。主机列表只显示 ID、IPv4、IPv6、云区域、状态
- **编号**：页面上显示的主机 ID、AI 回答里的 `host_id`、主机审计记录的 `resource_id` 都是主机的 `display_id`（自增整数），不是 UUID
- 可沿用的模式：审计页按记录 ID 打开详情的深链（`src/pages/Analysis/Audit/hooks/useAuditRecordDeepLink.ts`、`src/utils/routes.ts` 的 `getAuditRecordPath`）；AI 面板里审计引用的可点击标签（`src/components/AIAssistant/CitationTag.tsx` 的 `RecordCitation`）；`Descriptions` 抽屉（`pages/Resource/Model/components/InstanceWorkspace`）
- 业务拓扑的主机列表（`pages/Business/BusinessTopology/HostList`）的搜索能用，但每按一个键就发请求、换关键字后页码不回第 1 页

## 目标

**主机资源页能按 IP 或主机名搜索；任何地方都能点开一台主机看到它的完整属性、当前归属和最近变更，AI 回答里的主机引用也能点开核对。**

## 依赖的接口（主会话在前端开发开始前完成，前端只调用）

后端 `wende-cmdb-backend`：

1. `GET /api/v1/resource-pool/hosts` 加 `keyword`：按主机名或 IP 做不区分大小写的包含匹配，先过滤再计算总数；结果按 `display_id` 升序，分页稳定。其他参数和返回结构不变
2. 新增 `GET /api/v1/hosts/display/:display_id`：按 `display_id` 取一台主机，返回 `{code:0, data:{...}}`，包含主机表全部字段（含 `custom_fields`、`cloud_metadata`），加上云区域名称和当前归属（每处归属的业务、集群、模块名称；在资源池时给目录名称）。不存在返回 404，编号不是正整数返回 400；只读账号可以访问
3. `GET /api/v1/audit` 加 `resource_id`：和 `audit_type=host` 一起用时，按主机 `display_id` 精确过滤（现有的 `host` 参数按 IP 模糊匹配，`10.20.1.1` 会匹配到 `10.20.1.11`）

接口已完成并实测（2026-10-13，后端未提交，`cmdb-server` 已重建）。顺带修了业务拓扑主机列表的关键字搜索：`GET /api/v1/topology/nodes/:id/hosts?keyword=` 原来在 PostgreSQL 上直接报错（`inet ~~ unknown`），现在和资源池列表同一口径（主机名或 IP，不区分大小写，`%`、`_` 按字面匹配）。注意这个接口的返回行没有 `host_name`。

```
GET /api/v1/resource-pool/hosts?keyword=POOL&page=1&page_size=3
→ {"code":0,"data":{"items":[Host...],"pagination":{"page":1,"page_size":3,"total":59}}}   # 不带 keyword 时 total=67，按 display_id 升序

GET /api/v1/hosts/display/43
→ {"code":0,"data":{
    "id":"<uuid>","display_id":43,"host_name":"pay-gw-01","primary_ip":"10.20.1.11","ip_addresses":[...],
    "status":"running","is_destroyed":false,"os_type":"linux","os_version":"...","cpu":8,"memory":32768,"disk_size":200,
    "cloud_vendor":"...","cloud_area_id":"<uuid>","cloud_area_name":"腾讯云广州支付 VPC","cloud_instance_id":"...","cloud_region":"...","vpc_id":"...","subnet_id":"...",
    "custom_fields":{"SLA":"99.95%","固资编号":"WD-2024-00038","备份":false,"标签":["gw","扩容"],"环境":"生产","监控":true,"责任团队":"支付 SRE"},
    "cloud_metadata":{...},"created_at":"...","updated_at":"...","tenant_id":"...","created_by":"...","updated_by":"...",
    "placements":[
      {"kind":"business","business_id":1027,"business_name":"支付清结算","set_id":35,"set_name":"生产集群","module_id":97,"module_name":"支付网关"},
      {"kind":"business","business_id":1027,"business_name":"支付清结算","set_id":35,"set_name":"生产集群","module_id":99,"module_name":"风控服务"}]}}
  # 资源池主机（如 display_id=2）："placements":[{"kind":"pool","directory_id":1,"directory_name":"默认目录"}]
  # memory 单位 MB，disk_size 单位 GB；可选字段为空时可能不出现；没有归属时 placements 为 []
  # 404 {"success":false,"error":"NOT_FOUND","message":"host with identifier '999999' not found"}
  # 400 {"success":false,"error":"INVALID_INPUT","message":"Invalid input for field 'display_id': must be a positive integer"}

GET /api/v1/audit?audit_type=host&resource_id=43&page=1&page_size=5
→ 和现有审计列表同一结构 {"code":0,"data":{"count":8,"info":[{"id":613,...},{"id":612,...},...]}}，按时间倒序
  # resource_id 不是正整数 → 400 {"error":"invalid resource_id"}
```

## 界面与交互

- **搜索**：主机资源页的搜索框按回车或点搜索按钮时触发（不按键即搜）；页码回到第 1 页；和左侧目录筛选同时生效；切换目录、改每页条数时保留关键字；清空（点 × 或删空后回车）恢复全部；没有结果时显示空状态和"清除搜索"。占位文字改成"请输入IP或主机名"
- **业务拓扑主机列表的搜索**：改成和主机资源页一致——回车或点搜索按钮时触发、页码回到第 1 页（现在每按一个键就发请求、换关键字后页码不回第 1 页）
- **详情抽屉**：右侧抽屉，只读。入口：
  - 主机资源页列表、业务拓扑主机列表里的主机 ID 可点击
  - 深链 `/resource/host?host_id=43`（`host_id` 是 `display_id`），沿用审计深链的做法：自动打开、关闭时去掉参数、不存在时提示并去掉参数
  - AI 回答里的 `[host_id=43]` 变成可点击标签，点击跳到上面的深链；AI 对话抽屉保持打开、内容不丢
- **详情内容**（分组，空值显示 `--`）：
  - 基本信息：ID、主机名、内网 IP、全部 IP、状态、操作系统和版本、CPU（核）、内存、磁盘
  - 当前归属：每处归属一行"业务 / 集群 / 模块"，可能多处；在资源池时显示目录
  - 云信息：云厂商、云区域、实例 ID、地域、VPC、子网
  - 自定义字段：按键值原样显示（键名不翻译，嵌套值显示成 JSON 文本）
  - 时间：创建、更新时间（按本地时区显示）
  - 最近变更：最近 5 条主机审计记录（时间、操作、操作人），点击跳到审计详情 `/analysis/audit?record_id=`
- 不做：编辑主机或自定义字段、进程信息、按主机过滤审计页的"查看全部"

## 验收标准

前提：后端（8080）、AI 服务（8090）在跑；用 `admin / admin123456` 登录；只读账号 `viewer`（见后端 `internal/storage/auth_migrations.go`）。

- **AC1 搜索**：在主机资源页输入 IP 片段（如 `10.20.1`）或主机名片段，回车后列表只剩匹配的主机，总数随之变化；大小写不敏感
- **AC2 清空与空结果**：清空后恢复全部主机；输入一个不存在的关键字，显示空状态和"清除搜索"，点击后恢复
- **AC3 组合与分页**：搜索和左侧目录同时生效；搜索后页码回到 1；切换目录、改每页条数时关键字保留；连续快速搜索两次，只显示最后一次的结果
- **AC3b 业务拓扑搜索**：业务拓扑主机列表里输入关键字，按键过程中不发请求，回车后才搜索；在第 2 页搜索后回到第 1 页
- **AC4 详情入口**：主机资源页和业务拓扑主机列表里点主机 ID，打开该主机的详情抽屉，内容和列表行一致
- **AC5 详情内容**：抽屉按上面的分组显示；一台在多个模块的主机（如 `10.20.1.11`）列出全部归属；资源池里的主机显示目录；有自定义字段的主机显示全部键值
- **AC6 最近变更**：抽屉显示该主机最近 5 条变更（不混入其他主机的记录，比如看 `10.20.1.1` 时不出现 `10.20.1.11` 的记录），点击一条跳到审计页并打开这条记录的详情
- **AC7 深链**：直接打开 `/resource/host?host_id=43` 自动打开详情；`?host_id=999999` 提示主机不存在并去掉参数；关闭抽屉后 URL 去掉参数；没有参数时页面行为和现在一样
- **AC8 AI 引用**：在 AI 助手里问一个会引用主机的问题（如"10.20.1.11 为什么同时在两个模块？"），回答里的主机标签可点击，点击后打开该主机详情，AI 对话抽屉还在、内容不丢
- **AC9 权限**：只读账号能搜索、能打开详情；抽屉里没有编辑入口
- **AC10 i18n 与控制台**：中英文都有翻译、没有裸 key；控制台没有 React key 警告和 antd 静态 message 警告
- **AC11 质量门禁**：`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm vitest run`、`pnpm build` 全部通过；搜索参数拼装、详情数据适配（归属、空值、自定义字段）、主机深链参数解析有单测

## 约束

- 不改后端和 AI 服务的代码（接口由主会话提供）；接口和本文不一致时报给主会话
- 编号统一用 `display_id`；路径用 `src/utils/routes.ts` 的 helper 拼
- 新增主机类型放 `src/api/types/`，服务放 `src/api/services/`；后端结构和界面模型不一致时走 `src/api/adapters/`
- 不改 AI 助手以外的引用行为；AI 助手的改动只限主机引用变成可点击

## 不做（本次）

- 编辑主机、编辑自定义字段、进程信息
- 业务列表页（`pages/Resource/Business/BusinessList`）的搜索（同样是空壳，另立需求，已记入工作区 PROGRESS 待办）
- 模型中心里主机模型的字段定义和主机表对不上的问题
