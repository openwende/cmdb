# 修复方案：主机流转 + 审计

> 配套问题清单 `docs/E2E_REMEDIATION_CHECKLIST.md`（R1-R9）。本文给解法（F=止血 Fix，C=收口 Converge），并标注 F→R 映射、文件行、验收标准、依赖与顺序。
> 核心判断：很多缺陷同源——**主机归属变更存在多套实现（topology / resource_directory）、三套副作用（关系表 / v2 ResourceV2 投影 / 资源池表），对错不一且都不落审计、都没进 mainline 主线**。因此分两层：先止血，再收口到 mainline 单一通道。

---

## 第一层：止血（P0，最小改动、不碰架构，可当周上线）

### F1 — 修 R2：`TransferHostsToPool` 补建 `ResourcePoolHost`（止"主机蒸发"）
- **文件**：`[后端] internal/core/topology/service.go:420-453`
- **现状**：只删 `HostModuleRelation`+`HostBusinessRelation`，从不建 `ResourcePoolHost` → 主机成孤儿
- **改法（二选一）**：
  - **方案 A（最小内联）**：删关系后，查默认目录（`ResourceDirectory` where `is_default=true`），用 `OnConflict(host_id) DoUpdate` 建 `ResourcePoolHost{HostID, DirectoryID:默认目录, ImportedAt:now, ImportedBy:user}`。`ResourcePoolHost` 结构见 `internal/types/resource_directory.go:44`。
  - **方案 B（推荐，顺带收敛）**：`transfer-to-pool` 改为委托 `resource_directory.ReclaimHosts(host_ids, 默认目录ID)` —— `ReclaimHosts`（`internal/core/resource_directory/service.go:484-527`）已是正确实现（删关系 + detach 投影 + 建 `ResourcePoolHost`）。删除 topology 里的重复实现，消除"两套实现一对一错"的分叉。需给 `TopologyHandler`/topology svc 注入 resource_directory svc。
- **依赖**：默认目录必须存在（seed 已保证；建议加启动断言）
- **验收**：transfer-to-pool / 移出当前模块后，主机出现在资源池列表、IP 可重新导入、不再产生孤儿；接口 `successful` 与实际一致

### F2 — 修 R1（后端）：`attachProjectionHostToModule` 对"投影记录缺失"容错
- **文件**：`[后端] internal/core/resource_directory/service.go:561-567`
- **现状**：`findProjectionModuleByRef` 返回 `gorm.ErrRecordNotFound`（表在、模块投影记录不存在）时，抛 `"目标模块投影不存在"` → 整个 `AllocateHosts` 事务回滚 → 分配失败。而表不存在（`isMissingProjectionTableError`）却 `return nil` 容错——**策略不一致**。
- **改法**：v2 ResourceV2 投影是旁路（已 frozen），不应阻断核心分配。把 `ErrRecordNotFound` 与 missing-table 一视同仁：
  ```go
  if err != nil {
      if isMissingProjectionTableError(err) || errors.Is(err, gorm.ErrRecordNotFound) {
          return nil // v2 投影缺失不阻断主流程
      }
      return fmt.Errorf("attach projection: %w", err)
  }
  ```
  更稳妥：`AllocateHosts` 里把整个 `attachProjectionHostToModule` 的返回降级为 warning（log 不回滚），让主流程（建关系 + 删 `ResourcePoolHost`）始终成功。
- **验收**：分配到业务空闲机后，主机真正离开资源池、`successful:2`；资源池列表不再显示这两台

### F3 — 修 R1（前端）：`AssignModal` 校验分配结果
- **文件**：`[前端] src/pages/Resource/Host/components/AssignModal/index.tsx:39-58`
- **现状**：`onOk` 只要 HTTP 200 就 `message.success('分配成功')`，不看 `result.failed`
- **改法**：拿到响应后判 `result.failed > 0 || result.successful === 0` → `message.error` 并保留弹窗（参照 `TransferHost` 的 `assertTransferResult`，`src/pages/Business/BusinessTopology/TransferHost/index.tsx:92-101`）
- **验收**：后端 failed 时前端如实报错，不再谎报成功

### F4 — 修 R2（前端）：`TransferHost` 的 `idlePool` 分支别丢目标
- **文件**：`[前端] src/pages/Business/BusinessTopology/TransferHost/index.tsx:126-132`
- **现状**：选"待回收"等目标后，`idlePool` 分支直接 `transferTopologyHostsToPool({host_ids})`，丢弃 `targetModules`
- **改法**：按所选目标模块走 `transferTopologyHosts({host_ids, target_module_id})`；仅当目标确为"资源池"时才走 transfer-to-pool
- **依赖**：完整的"转到待回收"语义需 **C5**（后端真实建出待回收模块）配合；在 C5 落地前，F4+F1 至少保证"不丢主机"（最坏退化为回资源池而非蒸发）
- **验收**：业务模块→待回收，主机进入业务空闲机池下的待回收模块（C5 后）

### F5 — 清理现存孤儿主机
- **动作**：对历史孤儿（`10.0.0.1` 及本次 `10.0.0.2/10.0.0.3` 若未回收）执行 `reclaim` 到默认目录归位；或一次性 SQL 校正（无 `ResourcePoolHost` 且无 `HostModuleRelation` 的 host → 补默认目录）
- **验收**：无"查得到主机记录但不在任何资源池/模块"的孤儿

### F6 — 独立小修
- **R6** `[后端]`：host_id 解析失败返回结构化业务错误，不裸抛 `invalid UUID`
- **R9** `[前端]`：业务拓扑主机列表 ID 列统一展示 `display_id`，UUID 仅内部用（`src/pages/Business/BusinessTopology/HostList/index.tsx:381-386`）

---

## 第二层：收口（治本，并入 topology / mainline 整改 → P1 真相收敛）

### C1 — 主机归属变更收敛为单一通道
- **现状**：`TransferHosts`(topology) / `AllocateHosts`,`ReclaimHosts`(resource_directory) / `TransferHostsToPool`(topology) 四个入口、三套副作用，对错不一（R1 漏处理投影、R2 漏建 pool、R7 双重投影）
- **目标**：抽出单一 `HostMembershipService`，在一个事务内原子完成：归属关系表（终态 `mainline_node_resources`，过渡期 `HostModuleRelation`/`HostBusinessRelation`/`ResourcePoolHost`）+ 模块 `host_count` 等节点统计同步 + 审计。所有入口都走它 → 从根上消除 R1/R2/R7 分叉（注意：主机本身不进 mainline 树，见 C2）

### C2 — 主机归属收敛到 `mainline_node_resources` 关系表（**主机不进 mainline 树**）
- **依据（权威设计）**：`MAINLINE_MODEL_PROPOSAL.md:228-256` 明确"主机不建议直接当作主线层级的一部分管理"——主机是第一层动态模型实例，通过专门关系表 `mainline_node_resources(node_id→mainline_instances, resource_id→host, relation_type='member_of')` 挂到模块叶子节点，多对多天然承载。**不要把主机塞进 `mainline_instances` 树**（MainlineInstance 是 ltree/level/parent 的层级节点结构，不适配海量多属主机）。
- **现状差距**：`mainline_node_resources` 尚未实现（代码 grep 为空）；主机归属散在 `HostModuleRelation`+`HostBusinessRelation`+`ResourcePoolHost`+v2 `EdgeV2` 投影四处并存 = R1/R2/R7 根源。
- **目标终态**：主机归属变更统一改写 `mainline_node_resources`（proposal line 321/414）；主机本身留在动态模型层。
- **比 proposal 再进一步（已核实蓝鲸 + 本项目代码）**：连 `ResourcePoolHost` 也应并入这张统一归属表 —— 资源池目录/空闲机/业务模块都只是 `node_id` 指向的不同节点，主机流转=改同一行 `node_id`。蓝鲸无独立资源池表（资源池=特殊 biz/空闲机 module，归属统一在 `cc_ModuleHostConfig`），故跨界天然一致。当前把资源池单拎一张表、与 `HostModuleRelation` 割裂，正是 R1(漏删→双重)/R2(漏建→蒸发)/R7 的真根因。佐证：本项目 `mainline/service.go` 已将 host 标为 `isMainline=false`，host 本就不是主线层级。
- **务实路径（不必先建新表）**：先 C1(单一归属服务)+C4(废 v2 `EdgeV2` 投影)+C3(落审计)，事实来源暂用现有 `HostModuleRelation`/`ResourcePoolHost`；待 mainline 整改推进到主机层再切存储到 `mainline_node_resources`（proposal 双写过渡 line 389）。
- 参见 `docs/MAINLINE_MODEL_PROPOSAL.md`、`docs/P1-truth-layer-convergence.md`

### C3 — 统一落审计（解决 R3）
- **现状**：审计 `resource_histories` 只接 `dynamic_model.recordHistory`；主机/拓扑/mainline 操作均不写
- **目标**：C1 的单一通道统一写 `resource_histories`（主机 import/transfer/allocate/reclaim 都产审计）；进一步让 mainline 同步路径落审计，覆盖结构变更 → 审计三 tab 真正有数据

### C4 — v2 `ResourceV2` 投影旁路化/退役
- **现状**：`attach/detachProjectionHostToModule` 在主事务内操作 ResourceV2（v2 已裁定不可信，见 `project_v2-audit`），是 R1 阻断与 R7 双重投影的来源
- **目标**：将投影移出主事务（异步/旁路）或随 v2 一并退役；与 v2-audit 结论一致

### C5 — 前端去除合成的"待回收/故障机"假节点（修 R5）
- **现状**：`[前端] src/api/adapters/topologyAdapter.ts:18-22,160-196` 后端缺模块时前端合成虚拟节点（`idle_module-1001/1002`，后端不存在）；`HostList:104-105` 合成节点永不加载主机
- **目标**：后端 `InitializeBusiness` 真实建出"空闲机/待回收/故障机"三内置模块（与 F2 的投影初始化同源）；前端删除合成逻辑，用后端真实节点。**F4 的完整语义依赖此项**

---

## R8 — API 响应规范统一（横切，可独立推进）
统一响应包裹（`code` / `success` 二选一）、分页字段（`page/page_size/total` vs `limit/offset/total`）、批量状态码（207 vs 200）。建议在 `internal/api` 出统一 envelope/分页 helper，逐接口迁移。

---

## 建议执行顺序
1. **本周止血**：F1（R2，最高优先）→ F2 → F3 → F4 → F5 清理；F6 顺手
2. **并入 P1 真相收敛**：C1 → C2 → C3（单一通道 + 入 mainline + 落审计，一举收口 R1/R2/R3/R7）
3. **清理与规范**：C4（v2 退役）、C5（真实内置模块 + 前端去合成）、R8（响应规范）

## F→R 覆盖对照
| 修复 | 解决 | 层 |
|---|---|---|
| F1 | R2 | 止血 |
| F2+F3 | R1 | 止血 |
| F4(+C5) | R2前端/语义 | 止血+收口 |
| F5 | R2 残留 | 止血 |
| F6 | R6,R9 | 止血 |
| C1/C2/C3 | R1,R2,R3,R7 根因 | 收口 |
| C4 | R7 | 收口 |
| C5 | R5 | 收口 |
| R8 | R8 | 横切 |
