# 端到端整改清单：主机生命周期流转 + 审计与分析

> **来源**：2026-05-31 前端 E2E 测试（浏览器驱动真实 UI + 前端同套 API 等价复现 + 前后端源码定位）
> **环境**：前端 `localhost:5173`（真连后端，非 mock）＋ 后端 `localhost:8080`，`admin` 登录，业务 `e2e-p15(id=1000)`，资源池默认目录 `id=1`
> **路径约定**：`[后端]` 相对 `wende-cmdb-backend/`，`[前端]` 相对 `wende-cmdb/`
> **状态图例**：`[ ]` 待修 · `[~]` 进行中 · `[x]` 已修复并回归

测试覆盖主机流转 4 步：导入 → 分配给业务空闲机 → 空闲机→业务模块 → 业务模块→待回收。结论：**第 1、3 步正常；第 2、4 步功能性损坏**。叠加"审计与分析"模块检查，共 9 项整改 + 1 道架构裂缝。

---

## P0 — 功能性损坏（阻断核心流程，最高优先）

### [ ] R1　主机"分配到业务空闲机"：后端失败 + 前端谎报成功
- **现象**：UI 选业务点确定 → 弹"分配成功" → 但资源池列表纹丝不动，主机实际未分配。
- **后端根因**：`AllocateHosts` 调 `attachProjectionHostToModule` 时对空闲机模块(id=1)报 `"目标模块投影不存在"`，`failed:2` 事务回滚，主机从未移动。`[后端] internal/core/resource_directory/service.go:444`
- **前端根因**：`AssignModal.onOk` 只要 axios 不抛错（HTTP 200）就 `message.success('分配成功')`，**不检查响应体里的 `result.failed`**。`[前端] src/pages/Resource/Host/components/AssignModal/index.tsx:44-52`
- **修复**：
  - [ ] 后端：补齐业务空闲机模块的投影初始化，使 `attachProjectionHostToModule` 能找到目标模块投影
  - [ ] 前端：`onOk` 校验 `result.failed/successful`，失败时报错而非谎报成功（参照 `TransferHost` 的 `assertTransferResult`）

### [ ] R2　"业务模块→待回收"：主机蒸发成孤儿
- **现象**：`transfer-to-pool` 返回 `successful:2`，但事后 e2e-module=0、空闲机=0、资源池=0、整棵拓扑树全 0；主机详情仍 200、`is_destroyed:false`——主机游离于所有视图之外却仍占用 IP（这正是重新导入 `10.0.0.1` 报 `already exists` 的根源）。
- **后端根因**：`TransferHostsToPool` 注释写"转移到资源池"，实现却**只删 `HostModuleRelation`+`HostBusinessRelation`，从不创建 `ResourcePoolHost`**。`[后端] internal/core/topology/service.go:420-453`（对比正常的 `TransferHosts:373` 会维护资源池、`ReclaimHosts` 会 `Create(poolHost)` @ `internal/core/resource_directory/service.go:511`）
- **前端根因**：`handleConfirm` 在 `idlePool` 分支直接 `transferTopologyHostsToPool({host_ids})`，**把用户在弹窗里选定的"待回收"目标模块 `targetModules` 完全丢弃**，不传 `target_module_id`；"移出当前模块"也走同一分支。`[前端] src/pages/Business/BusinessTopology/TransferHost/index.tsx:126-132`
- **修复**：
  - [ ] 后端：`TransferHostsToPool` 补回 `ResourcePoolHost` 创建（止血"主机蒸发"，最高优先）
  - [ ] 前端：idlePool 分支按所选目标模块走 `transferTopologyHosts`（带 `target_module_id`），不再无脑 transfer-to-pool
  - [ ] 运维：清理已产生的孤儿主机（含 `10.0.0.1`、本次测试的 `10.0.0.2/10.0.0.3` 若未回收）

---

## P1 — 数据正确性 / 一致性 / 功能缺失

### [ ] R3　操作审计对核心操作零覆盖（本轮新增）
- **现象**：审计页 UI 完整（主机/业务/资源三 tab + 筛选器 + 列），但三 tab **全部恒空**。实测：跑完整套主机流转（6+ 次写操作）审计零记录。
- **根因（架构裂缝，见末节）**：审计读 `resource_histories` 表（`[后端] internal/storage/audit_repository.go:33`），该表**唯一写入点**是 `dynamic_model` 的 `recordHistory`，仅在动态模型资源 CRUD 时触发（`[后端] internal/core/dynamic_model/service.go:266/282/504`）。主机/业务/拓扑的写操作走专用 service，**全都不调 `recordHistory`** → 永不进审计。
- **修复**：
  - [ ] 在主机/业务/拓扑的写操作里埋审计点（统一调 `recordHistory` 或等价的资源变更通道）

### [ ] R4　运营概览统计图表全是 mock（本轮新增）
- **现象**：顶部 4 个概览卡片（业务/主机/资源类型/实例总数）是**真实数据**（`[前端] src/pages/Analysis/Statistics/Overview/index.tsx:62-66` 调真实 API）；但"主机统计""实例统计"的所有饼/柱/趋势图**全是 mock 示例数据**，页面自挂提示"尚未接入真实统计源"。
- **根因**：`import { mockChartData } from '@/mock/Analysis'` + 满屏 `// TODO: api`。`[前端] src/pages/Analysis/Statistics/Host/index.tsx:9,58`、`Statistics/Instance/index.tsx`
- **修复**：
  - [ ] 后端：提供主机/实例的聚合统计 API（按 OS / 业务 / 管控区域 / 时间趋势）
  - [ ] 前端：替换 `mockChartData` 接入真实统计 API

### [ ] R5　"待回收/故障机"是前端凭空合成的假节点
- **现象**：空闲机池下的"待回收""故障机"在后端不存在，是前端合成的虚拟节点（`key=idle_module-1001/1002`）。
- **根因**：`[前端] src/api/adapters/topologyAdapter.ts:18-22,160-196` 后端没返回这些模块时前端 `REQUIRED_IDLE_MODULES` 合成；且 `[前端] src/pages/Business/BusinessTopology/HostList/index.tsx:104-105` `canContainHosts = isModule && !isSyntheticIdleModule` → 合成节点**永不加载主机**。若转移目标落到 `target_module_id=1001` 会直接失效。
- **修复**：
  - [ ] 后端：业务初始化时真实建出"空闲机/待回收/故障机"三内置模块
  - [ ] 前端：移除合成逻辑，改用后端真实模块（与 R1 的投影初始化同源）

### [ ] R6　allocate 对整数 host_id 直接 4xx/5xx
- **现象**：`host_ids` 传 `["2","3"]`（display_id）→ 后端 400 `invalid UUID length: 1`，原始错误裸暴露。
- **根因**：后端用 UUID 解析 host_id，无类型容错与友好报错。前端目前侥幸传 UUID（`PoolHostStore` 适配 `bk_host_id: item.id`，`[前端] src/store/PoolHostStore.ts:66`）规避了，但接口本身脆弱。
- **修复**：
  - [ ] 后端：host_id 解析失败返回结构化业务错误，不裸抛 UUID 解析异常

### [ ] R7　资源池主机被投影为"业务空闲机"主机
- **现象**：pooled 主机同时出现在业务空闲机模块（`host_count` 与 `idle_module-1/hosts` 都含它们），叠加 R1 造成"看着在空闲机、其实没分配、资源池还在"的认知混乱。
- **修复**：
  - [ ] 明确投影语义：资源池主机是否应计入业务空闲机；与 R1/R5 一并梳理空闲机模块的真实归属

### [ ] R8　API 响应格式不统一
- **现象**：三套规范并存——`/businesses` 用 `{success, data:{items,total,limit,offset}}`；`/resource-pool/*` 用 `{code:0, data:{...,pagination:{page,page_size,total}}}`；`/hosts/batch` 裸返回 `{created_ids,...}` + HTTP **207**。包裹结构、分页字段、状态码三处不一致。
- **修复**：
  - [ ] 后端：统一响应包裹（`code`/`success` 二选一）、统一分页字段、统一批量状态码语义

### [ ] R9　主机 ID 展示不一致
- **现象**：资源池页显示短整数 `display_id`(2/3)，业务拓扑页显示 `UUID`，同一台主机两副面孔。
- **修复**：
  - [ ] 前端：统一以 `display_id` 展示，UUID 仅作内部标识（业务拓扑列 `[前端] src/pages/Business/BusinessTopology/HostList/index.tsx:381-386`）

---

## 架构裂缝（跨多项的根因，与 topology 整改相关）

**精确诊断（已核实代码）——不是"都绕过 mainline"，而是 mainline 复活只走到结构层、主机归属层尚未纳入：**

- **结构节点（集群/模块/业务）与动态模型实例的写 → 已走 mainline 主线**：topology svc 调 `SyncSet`/`SyncModule`/`SyncBusinessLegacy`/`DeleteNodeByRef`（`internal/core/topology/service.go:106/208/479/570…`），instance svc 调 `SyncModelInstance`（`internal/core/instance/service.go:92/162`）。
- **主机归属变更（导入挂载/分配/转移/回收）→ 未纳入 mainline**：`mainline.Service` 接口**无任何 host 维度方法**（`internal/core/mainline/service.go:19-49`，`NodeTypeHost` 仅在 `EnsureBuiltinModels` 作内置模型定义）；`TransferHosts`/`TransferHostsToPool`/`AllocateHosts`/`ReclaimHosts` 内**零 mainline 调用**，主机挂载完全在专用表 `HostModuleRelation`/`HostBusinessRelation`/`ResourcePoolHost`，mainline 不感知。**这就是 mainline 复活的断点**——骨架已进主线，主机这层"血肉"仍游离专用表（→ R1/R2/R7 两套关系手工对账易漏）。
- **审计是第三条独立线**：`resource_histories` 仅由 `dynamic_model.recordHistory` 写入；mainline 同步不落审计、主机归属也不落审计 → R3 审计对主机/结构操作零覆盖。

> 整改方向：在 topology 整改中把"主机归属"纳入 mainline 主线（mainline 增 host 挂载/转移能力，或将主机归属表达为 mainline 实例关系），并让 mainline 同步路径统一落 `resource_histories` —— 一举收口 R1/R2/R3/R7。参见 `docs/MAINLINE_MODEL_PROPOSAL.md`、`docs/P1-truth-layer-convergence.md`。

---

## 测试中确认正常的部分（无需整改）
- ✅ **第 1 步 导入主机**：`POST /v1/hosts/batch` → `/v1/resource-pool/hosts/import` 正常入池
- ✅ **第 3 步 空闲机→业务模块**：`transfer` 是真正的移动（源清空、目标增加、正确移出资源池）`[后端] internal/core/topology/service.go:338-401`
- ✅ **reclaim**：`/v1/resource-pool/hosts/reclaim` 能把主机正确放回资源池
- ✅ **运营概览 4 个概览数字**：真实 API 数据

## 当前数据状态（测试残留）
- `10.0.0.2`/`10.0.0.3` 已 reclaim 回资源池默认目录（pooled）
- `10.0.0.1` 为历史孤儿（占 IP、各列表不可见）——见 R2 清理项
- 测试辅助文件 `.claude/launch.json`（Preview 复用前端用），可保留或删除
