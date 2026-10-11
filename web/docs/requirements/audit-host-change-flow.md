# 审计页显示真实变更内容和主机流向

## 背景

审计页（数据分析 → 审计）点开一条主机记录，详情里的属性表全是 `--`，列表里也看不出这条记录改了什么。主机流转（分配、转移、回收）只显示成"修改"，看不出主机是从哪里到哪里。人工核对 AI 调查助手引用的审计记录（`record_id`）时，只能去翻原始数据。

原因（已查代码）：

- `src/pages/Analysis/Audit/components/OperationDetail/index.tsx` 的属性表用的是 mock 数据 `dynamicGroupCondition`（`src/mock/business.ts`，59 个 `bk_*` 蓝鲸字段），和后端真实返回的字段（`module_names`、`memory`、`custom_fields.备份`…）对不上，所以只能显示 `--`。
- 列表只显示 `action`（create / update / delete），流转在后端也记成 `update`，区别在 `cur_data.source`，前端没有读。
- 后端返回的 `operation_time` 是 UTC、不带时区（`2026-09-14 09:30:00`，实际是北京时间 17:30），页面原样显示。

## 目标

只有一个：**把后端返回的真实数据显示在页面上，包括主机的流向**。界面不大改：列表加一列，详情抽屉在现有布局里加一块流向、把属性表换成真实字段。

## 后端数据（`GET /api/v1/audit?audit_type=host`，本地 777 条，不改后端）

每条记录的 `operation_detail.details` 有 `pre_data`、`cur_data`、`update_fields`。按 `cur_data.source` 分 6 种：

| 类型         | 判断                            | 条数 | pre_data                             | cur_data                                   |
| ------------ | ------------------------------- | ---- | ------------------------------------ | ------------------------------------------ |
| 新建主机     | `action = create`               | 155  | null                                 | 完整配置快照                               |
| 导入资源池   | `source = import`               | 155  | 只有 host_name、primary_ip（无归属） | `directory_id`                             |
| 分配到业务   | `source = allocate`             | 110  | `directory_id`                       | `business_name`、`module_names`            |
| 转移         | `source = transfer`             | 200  | `business_name`、`module_names`      | `business_name`、`module_names`            |
| 回收到资源池 | `source = reclaim`              | 19   | `business_name`、`module_names`      | `directory_id`                             |
| 配置变更     | `action = update` 且无 `source` | 138  | 完整配置快照                         | 完整配置快照，`update_fields` 是改了的字段 |

- `module_names` 可以有多个（如记录 613：`["支付网关","风控服务"]`）
- 资源池位置只有 `directory_id`，目录名用已有的 `getResourceDirectoryTree()`（`src/api/services/business.ts`）换成名称
- 配置变更出现过的字段：`status`、`custom_fields.故障原因`、`custom_fields.标签`、`custom_fields.备份`、`custom_fields.责任团队`、`os_version`、`memory`、`disk_size`、`custom_fields.环境`；快照里还有 `cpu`、`host_name`、`ip_addresses`、`cloud_area_id`、`custom_fields.SLA` 等

## 显示规则

**位置文案**

- 业务内：`业务名 / 模块名`，多个模块用"、"连接，如 `支付清结算 / 支付网关、风控服务`
- 资源池：`资源池 / 目录名`；目录名查不到时显示 `资源池 / 目录 #<id>`
- pre_data 里既没有业务也没有目录（导入资源池）：`无归属`

**流向**（导入、分配、转移、回收四种）：`<类型> 变更前位置 → 变更后位置`，类型用小标签显示：导入资源池 / 分配到业务 / 转移 / 回收到资源池

**配置变更**：按 `update_fields` 列出 `字段名 变更前 → 变更后`

- 字段名：`status` 状态、`memory` 内存（MB）、`disk_size` 磁盘（GB）、`cpu` CPU（核）、`os_version` 系统版本、`os_type` 系统类型、`host_name` 主机名、`ip_addresses` IP 地址；`custom_fields.<名称>` 显示为 `<名称>`；其他字段显示原始字段名
- 值：布尔显示"是 / 否"，数组用"、"连接，空值显示 `--`
- `module_id`、`module_ids`、`business_id`、`directory_id`、`source` 这类内部字段不单独列出（已经体现在流向里）

**新建主机**：摘要显示"新建主机"；详情属性表列出新建时的配置

## 改哪里

1. **列表**（`AuditList/index.tsx`）：在"操作实例"和"操作描述"之间加一列"变更内容"
   - 流转记录：类型标签 + `变更前 → 变更后`
   - 配置变更：最多显示前 2 个字段的 `字段 前 → 后`，多出来的显示"等 N 项"
   - 内容过长时省略，鼠标悬停显示全文
   - 移动端卡片同样显示这一行
   - 其他列不变
2. **详情抽屉**（`OperationDetail/index.tsx`）：顶部基本信息不变
   - 流转记录：在基本信息和属性表之间加一个"流向"区块，左右两块分别是变更前、变更后的位置（业务 / 模块或资源池目录），中间一个箭头，带类型标签
   - 属性表：行来自真实的 `pre_data` / `cur_data`，默认只显示改了的字段，点"展开"显示快照里的全部字段；字段名和值按上面的规则显示；不再使用 `dynamicGroupCondition`
   - 业务、资源两个页签的详情也走同一个组件，同样改为显示真实字段（不做流向）
3. **时间**：列表、移动端卡片、详情里的时间都把后端的 UTC 时间转成北京时间（Asia/Shanghai）显示
4. 数据转换逻辑放在纯函数里（`src/pages/Analysis/utils.ts` 或新文件），在 `src/utils/__tests__/` 加单测
5. 新增文案中英文 locale 都加

## 验收标准

用 `admin / admin123456` 登录，打开 数据分析 → 审计 → 主机：

- AC1 回收：记录 622（10.40.1.15）列表"变更内容"显示 `回收到资源池  数据中台 / 待回收 → 资源池 / 高配计算`；时间显示 `2026-09-14 17:30:00`；详情的流向区块显示同样的前后位置
- AC2 多模块转移：记录 613（10.20.1.11）显示 `转移  支付清结算 / 风控服务 → 支付清结算 / 支付网关、风控服务`，时间 `2026-09-17 09:12:00`
- AC3 分配：记录 885（10.10.2.11）显示 `分配到业务  资源池 / 默认目录 → 支付清结算 / 空闲机`
- AC4 导入：任意一条导入记录（如 404，10.10.90.23）显示 `导入资源池  无归属 → 资源池 / 腾讯云上海弹性备机`
- AC5 配置变更：记录 627（10.20.4.12）列表显示 `备份 是 → 否；标签 db → db、维护窗口`；详情属性表默认只有这两行，展开后显示全部字段且值不是全 `--`；记录 617 显示磁盘 300 → 500、状态 stopped → running
- AC6 新建：任意一条新建记录详情能看到新建时的配置（CPU、内存、磁盘等），不是全 `--`
- AC7 业务、资源页签：点开任意一条记录，详情属性表显示真实字段，不报错
- AC8 中英文切换后新增文案都有翻译，没有裸露的 i18n key；控制台没有新的报错和警告
- AC9 列表其他列、分页、筛选、窄屏卡片的现有行为不变
- AC10 `pnpm format:check`、`lint`、`typecheck`、`vitest run`、`build` 全过

## 约束

- 不改后端；不改分页和筛选
- 界面不大改：沿用 AntD 现有组件（Table、Tag、Descriptions、Tooltip）和项目的 CSS 变量，不引入新依赖
- 不删除 `src/mock/business.ts` 里的 `dynamicGroupCondition`（别处可能在用），只是审计详情不再用它
- 在 `dev` 分支直接开发（用户指定），不推送

## 已知问题（本次不改）

- 日期筛选也按 UTC 的整天计算：筛"09-14"实际是北京时间 09-14 08:00 到 09-15 08:00。要修需要改后端，留到后续
- 回收到资源池的记录，列表"所属业务"列为空（后端 `biz_name` 为空）；流向里已经能看到原业务，本次不改这一列
