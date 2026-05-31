# 端到端整改清单：主机生命周期流转 + 审计与分析

> **来源**：2026-05-31 前端 E2E 测试（浏览器驱动真实 UI + 前端同套 API 等价复现 + 前后端源码定位）
> **环境**：前端 `localhost:5173`（真连后端，非 mock）＋ 后端 `localhost:8080`，`admin` 登录，业务 `e2e-p15(id=1000)`，资源池默认目录 `id=1`
> **路径约定**：`[后端]` 相对 `wende-cmdb-backend/`，`[前端]` 相对 `wende-cmdb/`
> **状态图例**：`[ ]` 待修 · `[~]` 进行中 · `[x]` 已修复并回归

测试覆盖主机流转 4 步：导入 → 分配给业务空闲机 → 空闲机→业务模块 → 业务模块→待回收。结论：**第 1、3 步正常；第 2、4 步功能性损坏**。叠加"审计与分析"模块检查，共 9 项整改 + 1 道架构裂缝。

---

## P0 — 功能性损坏（阻断核心流程，最高优先）

### [~] R1　主机"分配到业务空闲机"：后端失败 + 前端谎报成功（前端 F3 已修，后端 F2 待办）
- **现象**：UI 选业务点确定 → 弹"分配成功" → 但资源池列表纹丝不动，主机实际未分配。
- **后端根因**：`AllocateHosts` 调 `attachProjectionHostToModule` 时对空闲机模块(id=1)报 `"目标模块投影不存在"`，`failed:2` 事务回滚，主机从未移动。`[后端] internal/core/resource_directory/service.go:444`
- **前端根因**：`AssignModal.onOk` 只要 axios 不抛错（HTTP 200）就 `message.success('分配成功')`，**不检查响应体里的 `result.failed`**。`[前端] src/pages/Resource/Host/components/AssignModal/index.tsx:44-52`
- **修复**：
  - [ ] 后端：补齐业务空闲机模块的投影初始化，使 `attachProjectionHostToModule` 能找到目标模块投影
  - [x] 前端：`onOk` 校验 `result.failed/successful`，失败时报错而非谎报成功（参照 `TransferHost` 的 `assertTransferResult`）—— **F3 已完成（2026-05-31，浏览器验证通过）**；注意响应是信封 `{code,data}` 且恒 HTTP 200，实际校验内层 `data.failed`/`data.successful`

### [~] R2　"业务模块→待回收"：主机蒸发成孤儿（前端 F4 已修，后端 F1/孤儿清理待办）
- **现象**：`transfer-to-pool` 返回 `successful:2`，但事后 e2e-module=0、空闲机=0、资源池=0、整棵拓扑树全 0；主机详情仍 200、`is_destroyed:false`——主机游离于所有视图之外却仍占用 IP（这正是重新导入 `10.0.0.1` 报 `already exists` 的根源）。
- **后端根因**：`TransferHostsToPool` 注释写"转移到资源池"，实现却**只删 `HostModuleRelation`+`HostBusinessRelation`，从不创建 `ResourcePoolHost`**。`[后端] internal/core/topology/service.go:420-453`（对比正常的 `TransferHosts:373` 会维护资源池、`ReclaimHosts` 会 `Create(poolHost)` @ `internal/core/resource_directory/service.go:511`）
- **前端根因**：`handleConfirm` 在 `idlePool` 分支直接 `transferTopologyHostsToPool({host_ids})`，**把用户在弹窗里选定的"待回收"目标模块 `targetModules` 完全丢弃**，不传 `target_module_id`；"移出当前模块"也走同一分支。`[前端] src/pages/Business/BusinessTopology/TransferHost/index.tsx:126-132`
- **修复**：
  - [ ] 后端：`TransferHostsToPool` 补回 `ResourcePoolHost` 创建（注：经 hms 通道上交资源池实测已能正确落 `ResourcePoolHost`/`pool_directory` 归属、未再孤儿，待确认是否仍需单独补这条旧路径）
  - [x] 前端：idlePool 分支按所选目标模块走 `transferTopologyHosts`（带 `target_module_id` + `source_module_id`），不再无脑 transfer-to-pool —— **已完成（2026-05-31，前端 commit `b2dd430`）；浏览器实测转移到空闲机/故障机均正确落入业务、不再蒸发到资源池**
  - [ ] 运维：清理已产生的孤儿主机（注：本次测试机 `10.0.0.2` 已回收进业务故障机、`10.0.0.3` 在 e2e-module；历史 `10.0.0.1` 待清）

---

## P1 — 数据正确性 / 一致性 / 功能缺失

### [x] R3　操作审计对核心操作零覆盖（主机 + 业务/拓扑写操作均已落审计）
- **现象**：审计页 UI 完整（主机/业务/资源三 tab + 筛选器 + 列），但三 tab **全部恒空**。实测：跑完整套主机流转（6+ 次写操作）审计零记录。
- **根因（架构裂缝，见末节）**：审计读 `resource_histories` 表（`[后端] internal/storage/audit_repository.go:33`），该表**唯一写入点**是 `dynamic_model` 的 `recordHistory`，仅在动态模型资源 CRUD 时触发（`[后端] internal/core/dynamic_model/service.go:266/282/504`）。主机/业务/拓扑的写操作走专用 service，**全都不调 `recordHistory`** → 永不进审计。
- **修复**：
  - [x] 在主机/业务/拓扑的写操作里埋审计点 —— **已完成**：主机流转 `1787c47`（host_membership 审计录制器）；业务/拓扑结构 `461fc31`（新增 `internal/core/auditlog` 统一入口，topology set/module + business 的 create/update/delete 落 `resource_histories`，model_uid ∈ {set,module,business}）。实测建 set+module → 审计"业务"tab 出现 2 条 create（此前恒空）
- **遗留（非本项，新发现）**：`DeleteSet`/`DeleteModule` 因 mainline `DeleteNodeByRef` 对 ltree 列用了 `~~`(LIKE) 报 `operator does not exist: ltree ~~ unknown` → 删除集群/模块 400。属 mainline 删除路径独立 bug，待单独修（建议作 R10）

### [ ] R4　运营概览统计图表全是 mock（本轮新增）
- **现象**：顶部 4 个概览卡片（业务/主机/资源类型/实例总数）是**真实数据**（`[前端] src/pages/Analysis/Statistics/Overview/index.tsx:62-66` 调真实 API）；但"主机统计""实例统计"的所有饼/柱/趋势图**全是 mock 示例数据**，页面自挂提示"尚未接入真实统计源"。
- **根因**：`import { mockChartData } from '@/mock/Analysis'` + 满屏 `// TODO: api`。`[前端] src/pages/Analysis/Statistics/Host/index.tsx:9,58`、`Statistics/Instance/index.tsx`
- **修复**：
  - [ ] 后端：提供主机/实例的聚合统计 API（按 OS / 业务 / 管控区域 / 时间趋势）
  - [ ] 前端：替换 `mockChartData` 接入真实统计 API

### [x] R5　"待回收/故障机"是前端凭空合成的假节点（后端 C5 建真实模块 + 前端删合成，已闭合）
- **现象**：空闲机池下的"待回收""故障机"在后端不存在，是前端合成的虚拟节点（`key=idle_module-1001/1002`）。
- **根因**：`[前端] src/api/adapters/topologyAdapter.ts:18-22,160-196` 后端没返回这些模块时前端 `REQUIRED_IDLE_MODULES` 合成；且 `[前端] src/pages/Business/BusinessTopology/HostList/index.tsx:104-105` `canContainHosts = isModule && !isSyntheticIdleModule` → 合成节点**永不加载主机**。若转移目标落到 `target_module_id=1001` 会直接失效。
- **修复**：
  - [x] 后端：业务初始化时真实建出"空闲机/待回收/故障机"三内置模块 —— **已完成（2026-05-31，commit `f246b93`）；`InitializeBusinessTopology` 幂等补建，每次取拓扑树时对每个业务回填，旧业务自动补出**
  - [x] 前端：移除合成逻辑，改用后端真实模块 —— **已完成（commit `5718f46`）；删除 `topologyAdapter.ts` 的 `REQUIRED_IDLE_MODULES` 合成块及相关 helper，直接透传后端子节点，测试改为断言透传。另转移弹窗 `filterTransferNodesByMode` 已认"空闲机池下所有模块"使三模块可选（commit `b2dd430`）**
- **附带修复**：`countModuleHosts` 此前对 is_default 的空闲机模块去数 `resource_pool_hosts`（资源池），主机分配进业务后池空→空闲机 `host_count` 恒 0、"分配后没出现在业务空闲机池"。已改为按 `module_id` 数 `host_module_relations`（commit `f246b93`），与节点主机列表口径一致

### [x] R6　allocate 对整数 host_id 直接 4xx/5xx（已修，commit `8fa8850`）
- **现象**：`host_ids` 传 `["2","3"]`（display_id）→ 后端 400 `invalid UUID length: 1`，原始错误裸暴露。
- **根因**：后端用 UUID 解析 host_id，无类型容错与友好报错。前端目前侥幸传 UUID（`PoolHostStore` 适配 `bk_host_id: item.id`，`[前端] src/store/PoolHostStore.ts:66`）规避了，但接口本身脆弱。
- **修复**：
  - [x] 后端：host_id 解析失败返回结构化业务错误，不裸抛 UUID 解析异常 —— **已完成（commit `8fa8850`）；`bindHostRequestError` 套用于 allocate/import/move/reclaim，整数 host_id 返回 `{code:INVALID_HOST_ID}` + 400，API 实测通过**

### [x] R7　资源池主机被投影为"业务空闲机"主机（已被 host_count 修复 + hms 归属模型解决）
- **现象**：pooled 主机同时出现在业务空闲机模块（`host_count` 与 `idle_module-1/hosts` 都含它们），叠加 R1 造成"看着在空闲机、其实没分配、资源池还在"的认知混乱。
- **修复**：
  - [x] 明确投影语义：资源池主机**不**计入业务空闲机 —— **已解决**：空闲机模块 host_count/节点主机均只读 `host_module_relations`（commit `f246b93`），pooled 主机无此关系故不再现身；实测 reclaim 后该机从空闲机列表/计数消失、只在资源池。v2 `EdgeV2` 旁路投影随 v2 退役(C4)另议

### [ ] R8　API 响应格式不统一
- **现象**：三套规范并存——`/businesses` 用 `{success, data:{items,total,limit,offset}}`；`/resource-pool/*` 用 `{code:0, data:{...,pagination:{page,page_size,total}}}`；`/hosts/batch` 裸返回 `{created_ids,...}` + HTTP **207**。包裹结构、分页字段、状态码三处不一致。
- **修复**：
  - [ ] 后端：统一响应包裹（`code`/`success` 二选一）、统一分页字段、统一批量状态码语义

### [x] R9　主机 ID 展示不一致（已修，commit `af782ab` 后端 + `a964da2` 前端）
- **现象**：资源池页显示短整数 `display_id`(2/3)，业务拓扑页显示 `UUID`，同一台主机两副面孔。
- **修复**：
  - [x] 前端：统一以 `display_id` 展示，UUID 仅作内部标识（业务拓扑列）—— **已完成（后端 node-hosts 补 `display_id` commit `af782ab`；前端 ID 列改 `display_id` commit `a964da2`）；浏览器实测业务拓扑空闲机列表 ID 列显示 2/3（与资源池页一致）**

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
