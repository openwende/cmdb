# Wende CMDB Browser Click QA Report

测试日期：2026-05-04  
测试环境：前端 `http://localhost:5173`，后端 Docker `cmdb-server:8080`，PostgreSQL `cmdb-db:5432`  
测试账号：admin / admin123456  
测试方式：浏览器真实点击、表单输入、页面 DOM 快照、前端控制台日志、后端容器日志。未使用 curl。

## 覆盖范围

- 登录：未登录重定向、空表单校验、错误密码、默认管理员登录。
- 首页：指标卡、快捷入口、空业务状态。
- 业务/资源目录：业务列表空数据、新建业务抽屉、空提交校验、主机资源列表。
- 资源类型：类型总览、模型详情、详情页各 Tab。
- 主机导入：导入抽屉首屏、模板入口、取消/关闭交互。
- 审计与分析：父级入口、操作审计 Tab、筛选/清空、运营概览。
- 用户管理：父级入口、账号列表、新增用户空提交校验。

截图目录：`docs/qa/2026-05-04-click-test/`

## 主要问题

### P1 - 父级路由直达为空白内容

复现路径：

- 访问 `/model`，页面只显示顶部导航、侧栏和面包屑“资源类型”，未自动进入“类型总览”。
- 访问 `/analysis`，页面只显示侧栏“操作审计 / 运营概览”和面包屑“审计与分析”。
- 访问 `/admin`，页面只显示侧栏“账号列表”和面包屑“用户管理”。

期望：点击顶部一级菜单或直接访问父级路径时，应自动进入默认子页面，例如 `/model/overview`、`/analysis/audit`、`/admin/users`。

证据：

- `08-model-overview.png` 记录了 `/model` 空内容状态。
- `src/routes/index.tsx` 中 `/analysis`、`/admin` 没有 index redirect；`/model` 虽有 index redirect，但实测未生效，需要一起回归。

### P1 - 模型详情页唯一校验/关系接口 404

复现路径：

1. 进入 `/model/overview`。
2. 点击 “QA测试服务器”。
3. 切换到“唯一校验”和“关系”Tab。

实际结果：

- “唯一校验”显示“该类型暂无唯一规则”，同时弹出重复的“加载唯一规则失败”。
- “关系”显示“该类型暂无关系定义”，同时弹出重复的“加载类型关系失败”。
- 前端控制台出现 `[HTTP] Not Found` 和 `AxiosError`。
- 后端日志显示：
  - `GET /api/v1/dynamic-models/qa_server/unique-rules` -> 404
  - `GET /api/v1/dynamic-models/qa_server/associations` -> 404
  - `GET /api/v1/dynamic-models/qa_server/available-relations` -> 404
  - 查询 `dynamic_models.uid = 'qa_server'` 时 `record not found`

期望：模型详情页使用同一套模型标识和接口命名；如果 `qa_server` 来自 `/api/v1/models`，则 schema、唯一规则、关系接口也应能解析该模型，或前端明确禁用并解释不可用原因。

证据：

- `12-model-unique-rules.png`
- `13-model-relations.png`
- 前端调用位于 `src/api/services/modelUniqueRule.ts`、`src/api/services/modelRelation.ts`。

### P1 - 主机导入抽屉打开后无法通过取消/关闭退出

复现路径：

1. 进入 `/resource/host`。
2. 点击“导入主机”。
3. 点击抽屉右上角关闭按钮、底部“取消”，以及键盘激活焦点按钮。

实际结果：抽屉保持打开，按钮只进入 active/focus 状态，测试只能开新标签继续。

期望：未选择文件时，点击“取消”或右上关闭按钮应立即关闭抽屉。

证据：

- `16-host-import-modal.png`
- `src/pages/Resource/Host/components/ImportHost/index.tsx:260` 至 `:307` 已传 `onClose` 和取消按钮，但实测未关闭。

### P1 - 主机导入仍是 mock/random 流程

代码证据：`src/pages/Resource/Host/components/ImportHost/index.tsx:96` 至 `:114` 中真实导入 API 被 TODO 注释，提交结果由 `Math.random()` 决定。

风险：用户即使上传 xlsx，也不会真正进入后端导入链路，成功/失败结果不可复现，无法用于真实 QA 验证和生产交付。

### P2 - 审计页面筛选不生效且数据为过期 mock

复现路径：

1. 进入 `/analysis/audit`。
2. 默认时间范围显示 `2026-04-04` 到 `2026-05-04`。
3. 表格仍显示 `2025-10-21`、`2025-10-23` 的记录。
4. 点击“清空”后，筛选区仍保留默认日期。
5. “主机 / 业务 / 资源”三个 Tab 都展示同一批 host 记录。

期望：审计数据应来自后端或至少被当前筛选条件过滤；“清空”应清除筛选项；不同审计对象 Tab 应展示对应对象数据。

代码证据：

- `src/pages/Analysis/Audit/Host/index.tsx:14` 引入 `mockOperationDetails`。
- `src/pages/Analysis/Audit/Host/index.tsx:30` 至 `:42` 搜索时仍重新加载 mock。
- `src/mock/Analysis.ts:67` 至 `:149` 是 2025 年固定审计数据。

### P2 - 运营概览指标与真实数据不一致

复现路径：

- 首页显示业务数为 `0`，主机资源页显示 `0` 条。
- `/analysis/statistics` 显示业务总数 `7`、主机总数 `210`。

期望：运营概览应读取后端实时统计，或明确标注为演示数据。

代码证据：

- `src/pages/Analysis/Statistics/Overview/index.tsx:12` 使用 `mockStatisticsData`。
- `src/mock/Analysis.ts:152` 至 `:169` 固定写死 `biz=7`、`host=210`。

### P2 - 空业务状态下“进入业务拓扑”动线不清晰

复现路径：

1. 首页业务数为 `0`。
2. 点击“进入业务拓扑”。
3. 实际跳转到 `/resource/business` 的业务列表空状态。

期望：按钮文案和目标页面一致。可选方案：

- 保持跳转业务列表，但按钮改成“创建/选择业务”；
- 或进入业务拓扑空状态页，提供创建业务 CTA。

证据：

- `04-home-after-login.png`
- `05-business-entry-empty.png`

### P3 - 控制台存在多处组件弃用/上下文警告

控制台观察到：

- `[antd: Card] bordered is deprecated`
- `[rc-collapse] children will be removed`
- `[antd: Select] onDropdownVisibleChange is deprecated`
- `[antd: Descriptions] Sum of column span...`
- `[antd: message] Static function can not consume context...`

风险：短期不阻断功能，但会污染 QA 日志，后续升级 Ant Design / rc 组件时容易变成破坏性问题。

## 已通过的关键点

- 未登录访问 `/` 会进入 `/login`。
- 登录空提交显示必填校验。
- 错误密码显示“用户名或密码错误”。
- 默认 admin 登录成功，首页和账号列表可访问。
- 新建业务空提交会校验业务名和运维人员。
- 新增用户空提交会校验用户名、显示名称、密码。
- 主机资源列表、业务列表空数据状态能正常渲染。

## 未执行/未确认

- 未上传 xlsx 文件，避免触发本地文件传输。
- 未创建业务、用户、模型或主机，避免污染测试数据。
- 点击新建业务抽屉“取消”后出现“确认离开当前页”弹窗，本次未点击确认丢弃。
- 未做生产构建回归；父级路由和截图超时问题建议在 `pnpm build && pnpm preview` 下再确认一次。
