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
- **关联（新发现，已立项 R10 并修复）**：`DeleteSet`/`DeleteModule` 因 mainline `DeleteNodeByRef` 对 ltree 列用 `~~`(LIKE) 报错、删除 400 —— 见下方 R10（commit `40d73da`，已修）

### [~] R4　运营概览统计图表全是 mock（真数据切片已落：主机分布图 + 实例数量统计接真实数据）
- **现象**：顶部 4 个概览卡片（业务/主机/资源类型/实例总数）是**真实数据**（`[前端] src/pages/Analysis/Statistics/Overview/index.tsx:62-66` 调真实 API）；但"主机统计""实例统计"的所有饼/柱/趋势图**全是 mock 示例数据**，页面自挂提示"尚未接入真实统计源"。
- **根因**：`import { mockChartData } from '@/mock/Analysis'` + 满屏 `// TODO: api`。`[前端] src/pages/Analysis/Statistics/Host/index.tsx:9,58`、`Statistics/Instance/index.tsx`
- **修复**（范围：用户选定"最小真数据切片"）：
  - [x] 后端：主机聚合统计 API `GET /v1/hosts/statistics`（按 os_type/业务/管控区域计数）—— 后端 commit `7be38e2`
  - [x] 前端：主机分布图(OS/业务/管控区域)接真实数据 —— 前端 commit `7b71540`；实测概览"按操作系统类型统计"饼图显示 `linux:3`（真实），横幅文案改为如实说明
  - [x] 后端：实例聚合统计 API `GET /v1/instances/statistics`（按模型计数，mainline set/module + resources）—— commit `b4d2fd5`（采用 R8 `response.OK`）
  - [x] 前端：实例数量统计图接真实数据 —— commit `3ae34d5`；实测显示 `模块:14 / 集群:5`（真实，替换 mock 的 bk_switch 等）
  - [ ] 暂缓（功能/数据积累级，非本切片）：主机数趋势 + 实例变更趋势（需历史快照表/采集）、自定义图表配置持久化

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

### [~] R8　API 响应格式不统一（已立标准+助手，不破坏存量；逐接口迁移留独立任务）
- **现象**：三套规范并存——`/businesses` 用 `{success, data:{items,total,limit,offset}}`；`/resource-pool/*` 用 `{code:0, data:{...,pagination:{page,page_size,total}}}`；`/hosts/batch` 裸返回 `{created_ids,...}` + HTTP **207**。包裹结构、分页字段、状态码三处不一致。
- **修复**（范围：用户选定"只立标准+助手、不破坏存量"）：
  - [x] 后端：统一响应包裹标准（选 `code`）+ 分页/批量语义，落 `internal/api/response`（`OK`/`Created`/`List`/`Error` 助手）+ 规范文档 `docs/API_RESPONSE_STANDARD.md`；新端点 `hosts/statistics`、`instances/statistics` 已采用。零回归。
  - [~] 逐接口迁移存量端点：
    - **`/businesses` 列表已完全收口为标准**——经"附加(c7d3c8d/ceca82b)→消费端全迁(概览/Home/业务列表)→移除旧字段(后端 `d8b0e83` 改 `response.List`、前端 `d0e7935`)"三步，现响应仅 `{code,data:{items,pagination}}`，实测业务列表页"共计 4 条"正常。
    - **`/hosts/batch` 批量导入已完全收口为标准**——后端 `74be870` 改 `response.OK`、批量统一 HTTP **200**（曾 207 部分失败 / 400 全失败），响应 `{code,data:{total,successful,failed,errors,created_ids}}`；前端 `a769ede` `batchCreateHosts` 解包 `data`，消费端 `ImportHost` 按 body 的 `successful/failed` 判定（曾抛错的全失败分支现走成功路径如实展示错误）。新增 handler 单测 `TestHostHandler_BatchImportPartialFailureReturns200Envelope` 锁定契约；容器 curl 三用例(全成功/部分/全失败)实测均 200+envelope，浏览器 origin 全失败用例实测 200（曾 400）。
    - **`/hosts` 列表已收口为标准**——`ListHosts` 从裸 `HostListResponse{total,page,page_size,hosts}` 改 `response.List`（后端 `df10e8e`）→ `{code,data:{items,pagination}}`；前端 `823ebb0` 统计概览读 `data.pagination.total`、`AddHostModal` 读 `data.items`（均防御回退旧扁平字段，过渡期兼容）。handler 测试补 envelope 断言；容器实测 `GET /hosts` 200+envelope（total:3），浏览器运营概览"主机总数 3"正常（读 `pagination.total`）。注：`PoolHostStore` 资源池主机走 `/resource-pool/hosts`，早已是标准 envelope。
    - **`/business-sets` 列表已收口为标准**——`ListBusinessSets` 从 `{success:true,data:{items,total,limit,offset}}` 改 `response.List`（后端 `a777a43`）→ `{code,data:{items,pagination}}`（对齐 `ListBusinesses`）。**前端零改动**：唯一消费端 `BusinessStore` 只读 `data.items`（新旧形状都在）。新增 `TestListBusinessSets` 锁定契约；容器实测 `GET /business-sets` 200+envelope，浏览器整页重载 `BusinessStore` 重新拉取无报错。
    - **`/cloud-areas` 列表已收口为标准**——`ListCloudAreas` 从扁平 `{total,page,page_size,cloud_areas}` 改 `response.List` → `{code,data:{items,pagination}}`。**前端零改动**：唯一可能消费端 `Foreignkey.tsx` 走 mock（`dynamicCloudArea`），真实 `/cloud-areas` 调用被注释未启用，故无前端依赖旧形状。新增 `TestListCloudAreas` 锁定契约（复用 `fakeCloudAreaRepo`，补 `listAreas/listTotal` 字段）；容器实测 `GET /v1/cloud-areas` 200+envelope。
    - **`/:id/dynamic-groups` 列表已收口为标准**——`List` 从 `{code,data:{items,total,limit,offset}}` 改 `response.List` → `{code,data:{items,pagination}}`（并补 `limit<=0` 守卫防 `offset/limit+1` 除零）。前端 `DynamicGroup/index.tsx` 唯一读 total 处改 `data.pagination?.total ?? data.total ?? 0`（防御回退），`items` 读法不变；TS 类型 `ListDynamicGroupsResponse` 加 `pagination`、旧扁平字段降为可选。新增 `TestDynamicGroupList` 锁定契约；前端 `typecheck` 通过；容器实测 `GET /v1/businesses/:id/dynamic-groups` 200+envelope，浏览器动态分组列表计数正常。
    - **`/models/:name/instances/batch` 批量创建已收口为标准**——`BatchCreateInstances` 从裸 `{count,ids}`+201 改 `response.Created` → `{code,data:{count,ids}}`+201（全成功/全失败语义，无部分失败故保留 201）。**前端零消费**（前端只走单条 `POST /models/:name/instances`，无批量调用）。新增 `TestBatchCreateInstancesEnvelope` 锁定契约；容器路由连通性实测（POST 空数组回 400 binding 非 404 即证路由已挂，成功 envelope 由单测覆盖；因实例通用 API 无 DELETE 路由、且仅 mainline 核心模型，故不做污染性 live 建实例）。`/processes/batch` 早已是 `{code,data:result}`，无需动。
    - **`/models/:name/instances` 实例列表已收口为标准**——`ListInstances` 从 `{data:[],meta:{total,page,page_size}}` 改 `response.List` → `{code,data:{items,pagination}}`。**该端点无活前端消费端**：唯一 app-code 引用 `ListModelInstancesResponse`/`listModelInstances` 的 `ModelDetail/index.tsx` 已是**死代码（未被路由——`modelDetail/:name` 走 `LegacyModelRedirect`，活的模型页是 `ModelLayout`+`pages/*`）**；活的"实例列表"tab 由 `InstanceWorkspace` 走**另一端点** `listAggregateInstances`(`/v1/instances`，早已标准)。本次把死代码 `ModelDetail` 的读法 + `ListModelInstancesResponse` 类型一并改为标准形状（`data?.items`/`data?.pagination?.total`，`?.` 链对旧形状优雅降级），保持仓库类型一致 + typecheck 绿（死组件留待单独清理，见 spawn task）。**验证**：新增 `TestListInstancesEnvelope`；容器 curl `GET /models/host/instances` 200+标准 envelope；浏览器活实例 tab（走 aggregate）渲染 3 行真实主机、零报错（证明活 UI 不受影响）；前端 typecheck + `instance-workspace-aggregate-list` 测试通过。
    - **剩余**：v2 `resource_graph`（`{success}` 形状）已裁定不扶正、不迁（原因见 `v2-audit`：整套 v2 已判退役/重做）。**R8 的 list/batch 存量端点（除 v2）至此全部收口。** 策略见 `API_RESPONSE_STANDARD.md`

### [x] R9　主机 ID 展示不一致（已修，commit `af782ab` 后端 + `a964da2` 前端）
- **现象**：资源池页显示短整数 `display_id`(2/3)，业务拓扑页显示 `UUID`，同一台主机两副面孔。
- **修复**：
  - [x] 前端：统一以 `display_id` 展示，UUID 仅作内部标识（业务拓扑列）—— **已完成（后端 node-hosts 补 `display_id` commit `af782ab`；前端 ID 列改 `display_id` commit `a964da2`）；浏览器实测业务拓扑空闲机列表 ID 列显示 2/3（与资源池页一致）**

### [x] R10　删除集群/模块报 ltree 错（本轮新发现并修复）
- **现象**：`DELETE /v1/topology/sets/:id`、`/modules/:id` 恒 400 `operator does not exist: ltree ~~ unknown`，无法删除集群/模块。
- **根因**：`mainline.DeleteNodeByRef`（`internal/core/mainline/service.go:321`）用 `path LIKE ?` 删子树，但 `path` 是 **ltree** 列，`LIKE`(`~~`) 对 ltree 无定义 → 事务回滚。
- **修复**：
  - [x] 改用 ltree `<@`（"是…的子孙或自身"）匹配整棵子树 —— **已完成（commit `40d73da`）；容器实测删 module/set 均 200，mainline 子树软删、拓扑树不再显示、审计出现 delete 记录**

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
