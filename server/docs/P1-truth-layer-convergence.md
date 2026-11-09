# P1:真相层收敛(5 套 → 三层骨架的第一步)

> - 状态:**核心已实施并验证**(2026-05-31)。下方为原计划,实施结果见"实施记录"。
> - 隶属:[`ARCHITECTURE_DIRECTION.md`](./ARCHITECTURE_DIRECTION.md) §5 收敛路线
> - 前置:P0 止血已完成(build/test/vet 全绿)
>
> ### 实施记录(2026-05-31)
> - **核实纠正**:`topology.Service` 读路径(`GetTopologyTree`/`GetNodeChildren`)**本就从 mainline 读**(先 `SyncBusinessLegacy` 同步、再 `buildMainlineNode`/`ListChildren`),并非"mainline 无人读"。被架空的只是 HTTP handler 把 v2 摆在 `topology.Service` 之前。**提案阶段2(双写 mainline)+ 阶段3(读走 mainline)其实已在 `topology.Service` 内部落地**,故 P1 核心动作收敛为"冻结 v2"。
> - **改动(冻结 v2,6 文件)**:`topology_handler.go`/`mainline_handler.go` 移除 `projection`/`commands` 所有前置调用与 v2 辅助函数;`routes_topology.go`/`routes_mainline.go` 不再注入;两个 handler 测试适配(删 v2 读路径测试、改名为 legacy 语义)。`projection`/`resource_graph` 包与 `/api/v2` 端点**保留**(P3 处置)。
> - **数据账(实测空库)**:该环境无遗留拓扑数据 → P1.1 回填无需。两侦察结论冲突厘清:v2 命令路径**不**回写 `sets`/`modules`/`mainline`(结构节点),但主机流转**回灌** `host_module_relations`(`syncLegacyAllocatedHost`/`syncLegacyIdleHost`)。
> - **验收全过**:`go build`/`vet`/`test ./...` 全绿(含 projection/resource_graph 自身测试);**docker 真实 PG+HTTP e2e**:`ENABLE_COMPAT=true`(v2 表在)下经 HTTP 建 business/set/module,数据全进 `sets`/`modules`/`mainline_instances`,`resources_v2`/`edges_v2` **保持为 0**。
> - **未做(顺延)**:提案阶段4(`sets`/`modules` 退场、mainline 完全自包含)→ P2+;`ref_id` 锚定 legacy 的清理;legacy 树补 `bk_module_type` 字段(当前用 `is_default` 表达,前端已适配)。

---

## 1. 目标

把**业务拓扑(`business→set→module`)的结构真相**,从当前"v2 优先(dev 假象)/ legacy 实写 / mainline 影子"的三套纠缠,收敛为**清晰的一条**:

> **mainline 主线 = 业务拓扑结构的唯一真相(第二层);legacy 旧表退为兼容;v2 在拓扑上的投影冻结。**

完成后,纯 canonical 生产部署(无 v2 表)下拓扑功能**完整且确定**,不再依赖 `ENABLE_COMPAT_AUTOMIGRATE`、不再有"静默回退 legacy"的二义性。

这是 [`MAINLINE_MODEL_PROPOSAL.md`](./MAINLINE_MODEL_PROPOSAL.md) **阶段3(切主)/ 阶段4(收口)** 的落地,只是要先把被 v2 截胡的局面理顺。

---

## 2. 边界:P1 不做什么

- ❌ **不动 A/B 元数据合一**(留 P2)。
- ❌ **不重做第一层通用关系图**(留 P3)。
- ❌ **不引入 AI 能力**(留 P4)。
- ❌ **不改主机↔模块关系的归属**:`host_module_relations` 在 P1 **保持为主机挂载真相**,P1 只收敛**拓扑结构节点树**(business/set/module)。主机关系统一到关系图留 P3。(注:提案设想的 `mainline_node_resources` 表**不在 P1 引入**——避免又造一套。)
- ❌ **不删 v2 代码**:P1 只**断开** v2 在拓扑读写路径上的优先级(冻结),代码与 `/api/v2/*` 实验端点保留,去留 P3 再定。

---

## 3. 第 0 步:精确核实清单(动手前必做)

P1 的第一个动作不是改代码,是用第一手证据确认以下事实(遵循 `verify-before-delete`):

1. **🔴 关键:`mainline_instances` 数据是否完整?**
   - 写 mainline 的有两条路:legacy 路径 `topology.Service.CreateSet/CreateModule`(每次 `SyncSet`/`SyncModule`,见 `internal/core/topology/service.go:234-281`)和 mainline 自定义节点 API。
   - 但 HTTP 写在 dev(开 v2)走的是 `projection.BusinessTopologyCommandService`。**需查清:经 v2 命令路径创建的拓扑节点,是否回写了 `mainline_instances` 和 `sets`/`modules`?** 若否,dev 环境数据已分裂——复活 mainline 读路径前必须先回填。
   - 生产(canonical,无 v2)走 legacy `topology.Service`,理论上 mainline 被双写、数据完整;需实测确认。
2. **v2 写路径是否回灌 `host_module_relations`?** —— 两次侦察结论有出入(一说 `syncLegacyAllocatedHost/syncLegacyIdleHost` 回灌、一说 v2 只写自己)。直接读 `internal/core/projection/business_topology_command_service.go` 的主机流转方法确认。影响主机数据在切换时是否需要迁移。
3. **mainline 的读/写/引用确切位置**(下面 §4 是上一轮侦察结论,动手前复验行号):
   - 读被架空点:`topology_handler.go:70`(`GetTopologyTree` projection-first)、`mainline_handler.go:133`、`topology_handler.go:144`(`GetNodeDetail`)。
   - 写优先点:`topology_handler.go:414`(`CreateSet` commands-first)等。
   - 回退判定:`topology_handler.go:182` `shouldFallbackProjection`。
   - mainline 活引用:`instance.Service`(`internal/core/instance/service.go:85-92`)、`topology.AggregateService`(`aggregate_service.go:47/52`)、`instance.AggregateService`(`aggregate_service.go:131-168`)。

**核实产物**:一张"拓扑域数据流真相图"(谁写谁、谁读谁、数据完整性),据此决定是否需要回填步骤。

---

## 4. 现状盘点(拓扑域三套精确接线 — 上一轮侦察,待复验)

```
HTTP /api/v1/topology/*  ┐
HTTP /api/v1/mainline/*  ┼─► [若 h.projection/h.commands != nil] ─► v2 projection ─► resources_v2/edges_v2   (dev-only,优先命中)
                         │        │
                         │        └─(v2 表缺失/记录未找到时 shouldFallbackProjection)─┐
                         │                                                          ▼
                         └────────────────────────────────────────────► topology.Service ─► sets/modules (写真相)
                                                                                    │
                                                                                    └─ SyncSet/SyncModule ─► mainline_instances (影子,被持续写)
节点详情 GetNodeDetail ─► AggregateService ─► 读 mainline_instances + SyncBusinessLegacy
```

**症结**:HTTP 层把 v2 摆在最前(dev 假象),legacy 在中间实写,mainline 在最后被双写却没人读。P1 要把这个顺序**倒过来并简化**:让 mainline 成为读真相、legacy 退兼容、v2 在此路径上消失。

---

## 5. 收敛步骤(渐进,每步独立可验证、可回滚提交)

> 每步完成后跑 `go build ./...` + `go test ./...` + docker-compose 端到端;分步 commit。

1. **核实 + 回填(若需)**:执行 §3;若 dev 数据分裂,先写一次性回填脚本把 v2 投影的拓扑节点补进 `sets`/`modules`/`mainline_instances`,使三者一致。
2. **确立 mainline 写完整性**:确认/修正 `topology.Service` 的 `CreateSet`/`CreateModule`/`DeleteSet`/`DeleteModule`/`TransferHosts` 对 `mainline_instances` 的双写正确、覆盖全部结构变更。这是 mainline 当真相的数据基础。
3. **切读路径到 mainline**:移除 `topology_handler` / `mainline_handler` 读方法(`GetTopologyTree`/`GetNodeDetail`/tree 等)的 `h.projection` 优先,改由 `topology.Service`/`AggregateService` 从 mainline(+legacy 兼容)读。
4. **切写路径到 legacy+mainline**:移除写方法(`CreateSet`/`CreateModule`/`TransferHosts` 等)的 `h.commands` 优先,统一走 `topology.Service`(写 legacy + 双写 mainline)。
5. **冻结 v2 投影**:`TopologyHandler`/`MainlineHandler` 不再注入/调用 `projection.*`;`shouldFallbackProjection` 等嗅探逻辑随之移除。v2 引擎代码、`/api/v2/*` 实验端点保留不动。
6. **退兼容 + 收口(提案阶段3/4)**:legacy 旧表读仅作兼容;评估把 `topology.Service` 逐步收敛为 mainline 的产品包装层(可顺延至 P2 开头)。
7. **文档**:更新本文为"已完成",在 `ARCHITECTURE_DIRECTION.md` §5 标 P1 ✅。

---

## 6. 风险与回滚

| 风险 | 缓解 |
|---|---|
| dev 经 v2 创建的节点未进 mainline → 切读后拓扑缺节点 | 第 0 步先核实;第 1 步回填脚本;切换前对比 v2 与 mainline 节点数 |
| `AggregateService` 读 mainline 但 mainline 曾陈旧 → 节点详情错 | 第 2 步先保证写完整;端到端验证节点详情 |
| 移除 projection 优先牵连 `resource_directory`/资源池投影 | §3 先 grep projection 的全部调用方;P1 只断拓扑路径,资源池投影若耦合则单列子任务 |
| 主机挂载数据(`host_module_relations` vs v2 边)在切换时不一致 | 第 0 步核实 #2;P1 保持 `host_module_relations` 为真相、不动主机关系 |

**回滚**:每步独立 commit;失败 `git revert` 单步即可,不影响前序。

---

## 7. 验收标准

- [ ] `/api/v1/topology/*` 与 `/api/v1/mainline/*` 的读写均以 **mainline(+legacy 兼容)** 为准,代码路径不再触达 `core/projection`。
- [ ] **纯 canonical 部署(不设 `ENABLE_COMPAT_AUTOMIGRATE`、无 v2 表)下,业务拓扑增删改查 + 节点详情 + 主机转移功能完整**,无"静默回退"。
- [ ] `go build ./...` / `go vet ./...` / `go test ./...` 全绿。
- [ ] docker-compose 端到端:全新库 → canonical 迁移 → seed → 建业务 → 建 set/module → 转移主机 → 读树/详情,全部正确。
- [ ] mainline 与 legacy 拓扑结构数据一致性校验通过(节点数、父子、路径)。
- [ ] 本文与 `ARCHITECTURE_DIRECTION.md` 路线状态更新。
