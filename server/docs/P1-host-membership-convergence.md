# P1 真相收敛：主机归属统一关系表（host_node_memberships）

> 配套 `E2E_FIX_PLAN.md`（C1/C2 的落地设计）、`E2E_REMEDIATION_CHECKLIST.md`（R1-R9）、架构判断 `memory/project_host-membership-arch.md`。
> 核心立论（代码 + 蓝鲸双实证）：**host 不进 mainline 树；主机一切归属用一张多对多关系表承载；连资源池也并入，不再独立建表。** 主机的每一次流转 = 改这张表的一行。R1/R2/R3/R7 不是分别修，而是表一收口就消失。

---

## 1. 为什么是"一张表"

当前主机归属散在四处，且语义不对称、互相要手工对账：

| 现有存储 | 语义 | 基数 | 问题 |
|---|---|---|---|
| `host_module_relations(host_id, module_id)` | 主机在业务模块 | 多对多 | 与下面三者各自为政 |
| `host_business_relations(host_id, business_id)` | 主机在业务 | 多对多 | 可由 module→biz 推导，**冗余** |
| `resource_pool_hosts(host_id PK, directory_id)` | 主机在资源池目录 | **单属**（host_id 是主键） | 与业务模块归属**割裂成两套存储** |
| v2 `EdgeV2`(ResourceV2 投影) | 主机↔节点投影 | — | 第三套，frozen，仍在主事务里阻断（R1） |

跨界操作（allocate 池→业务 / reclaim 业务→池 / transfer-to-pool）每次都要"删一套表 + 建另一套表"，搬漏一边即出 bug：
- **R1**：allocate 建了 module 关系但漏删/失败回滚 → 主机仍在池（双重归属表象）
- **R2**：transfer-to-pool 删了 module 关系但**漏建** pool 记录 → 主机蒸发成孤儿
- **R7**：资源池主机又被 v2 投影成业务空闲机主机 → 双重投影
- **R3**：四套写入口没有一个统一落审计 → 审计零覆盖

蓝鲸 bk-cmdb 的答案是**一张 `cc_ModuleHostConfig`**（host/module/set/biz 多对多 + 冗余字段），资源池只是特殊业务，无独立资源池表。本方案据此收敛。

---

## 2. 目标表结构

```sql
CREATE TABLE host_node_memberships (
    id            BIGSERIAL PRIMARY KEY,
    host_id       UUID        NOT NULL,
    -- 多态节点引用：过渡期指向两套节点体系；终态(阶段B)统一指 mainline_instances
    node_kind     VARCHAR(20) NOT NULL,          -- 'pool_directory' | 'biz_module'
    node_id       BIGINT      NOT NULL,          -- → resource_directories.id 或 modules.id
    -- 冗余维度（参考蓝鲸 ModuleHostConfig 的 bk_set_id/bk_biz_id）：写入点保证一致，读侧免 join
    business_id   BIGINT,                        -- biz_module: 所属业务；pool_directory: 资源池保留业务ID(见 §3 不变量)
    set_id        BIGINT,
    relation_type VARCHAR(50) NOT NULL DEFAULT 'member_of',
    source        VARCHAR(30),                   -- import | allocate | transfer | reclaim | recycle
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by    VARCHAR(100),
    UNIQUE (host_id, node_kind, node_id, relation_type)
);
CREATE INDEX idx_hnm_host    ON host_node_memberships (host_id);
CREATE INDEX idx_hnm_node    ON host_node_memberships (node_kind, node_id);
CREATE INDEX idx_hnm_biz     ON host_node_memberships (business_id);
```

> 这张表替代 `host_module_relations` + `host_business_relations` + `resource_pool_hosts` 三表，并退役 v2 `EdgeV2` 主机投影。`business_id` 冗余只读，**唯一可信写入点保证其与 node 一致**。

---

## 3. 不变量（统一表的真正价值）

由唯一写入点 `HostMembershipService` 在单事务内强制保证：

- **I1 无游离**：每个未销毁 host 至少一行 membership。→ 杜绝 R2 主机蒸发（删旧必同事务增新）。
- **I2 池/业务互斥**：同一 host 不同时存在 `pool_directory` 与 `biz_module` 行。进业务即从池移出、回收即从业务移出，**在同一张表内增删，单事务原子**。→ 杜绝 R1 双重归属。
- **I3 资源池也是节点**：资源池目录视为 `pool_directory` 类节点；其 membership 行的 `business_id` 取保留值「资源池业务」（对齐蓝鲸 bk_biz_id=资源池业务），避免 NULL 分支、查询统一。
- **I4 业务多属**：`biz_module` 行可多条（一主机多模块），由 UNIQUE(host_id,node_kind,node_id) 天然承载。
- **I5 单一审计点**：任何 membership 变更都经 `HostMembershipService`，统一写 `resource_histories`。→ 杜绝 R3 审计零覆盖。

---

## 4. 服务原语（C1 的接口落地）

四个业务动作收敛为两个原语，主机流转 = `Move` 到不同节点：

```go
type NodeRef struct { Kind string; ID uint64 } // pool_directory | biz_module

type HostMembershipService interface {
    WithTx(tx *gorm.DB) HostMembershipService
    // 首次归属（导入）：host 进资源池目录
    Attach(ctx, hostIDs []uuid.UUID, node NodeRef, src string) (*Result, error)
    // 归属迁移（分配/转移/回收/待回收）：原子完成 删旧 membership + 增新 + 双端节点统计 + 审计
    Move(ctx, hostIDs []uuid.UUID, to NodeRef, opts MoveOpts) (*Result, error)
    // 查询
    NodesOfHost(ctx, hostID) ([]NodeRef, error)
    HostsOfNode(ctx, node NodeRef, page) ([]Host, int64, error)
}
```

`Move` 内部统一流程（单事务）：
1. 读 host 现有 membership（from 集合）
2. 按 I2/I4 规则计算要删的旧行、要增的新行
3. 删旧行、增 to 行
4. 同步两端节点 `host_count` 等统计
5. `recordHistory(model='host', change='transfer', before={node:from}, after={node:to}, by, ip)`

### 四动作映射

| 业务动作 | 调用 | 表变更 |
|---|---|---|
| 导入主机 | `Attach(hosts, {pool_directory, dirID}, "import")` | 增 pool_directory 行 |
| 分配给业务空闲机 | `Move(hosts, {biz_module, idleModuleID}, allocate)` | 删 pool_directory 行 + 增 biz_module 行（I2） |
| 空闲机→业务模块 | `Move(hosts, {biz_module, targetModuleID}, transfer)` | biz_module 行 node 改为目标模块 |
| 业务模块→待回收 | `Move(hosts, {biz_module, recycleModuleID}, recycle)` | biz_module 行 node 改为待回收模块 |
| 回资源池 | `Move(hosts, {pool_directory, dirID}, reclaim)` | 删 biz_module 行 + 增 pool_directory 行（I2） |

> 注意：原来分散在 topology svc（`TransferHosts`/`TransferHostsToPool`）与 resource_directory svc（`AllocateHosts`/`ReclaimHosts`）的逻辑，全部收敛到此一处；前端 4 个入口照旧调 `/v1/topology/*`、`/v1/resource-pool/*`，handler 内改调 `HostMembershipService`。

---

## 5. Bug 如何"自然消失"（而非逐个修）

| Bug | 旧根因 | 收敛后 |
|---|---|---|
| R1 分配双重/失败 | 建 module 关系与删 pool 分属两套存储 + v2 投影阻断 | 同表内"删 pool 行+增 module 行"单事务，I2 保证互斥；不依赖 v2 投影 |
| R2 主机蒸发 | transfer-to-pool 漏建 pool 记录 | I1 保证删旧必增新，主机永有归属 |
| R3 审计零覆盖 | 四套写入口无人落审计 | I5 唯一写入点统一 recordHistory |
| R7 双重投影 | 资源池表 + v2 EdgeV2 两套 | 单表，v2 投影退役 |

R5（前端合成假节点）、R8（响应规范）、R9（ID 展示）属前端/横切，独立按 `E2E_FIX_PLAN.md` 处理，不在本表范围。

---

## 6. 迁移与双写过渡（不可一刀切）

- **阶段 0｜建表 + 回填**：建 `host_node_memberships`；`host_module_relations`→biz_module 行（business_id/set_id 由 module 推导回填），`resource_pool_hosts`→pool_directory 行。
- **阶段 1｜双写 + 读切换**：`HostMembershipService` 写新表，同时旧三表保持双写一段时间；查询读侧逐步切到新表；上线对账校验（新旧计数一致、无游离）。
- **阶段 2｜退役旧存储**：删 `host_module_relations`/`host_business_relations`/`resource_pool_hosts` 与 v2 `EdgeV2` 主机投影；topology/resource_directory svc 的归属逻辑删空，仅留对 `HostMembershipService` 的调用。

止血层（`E2E_FIX_PLAN.md` F1/F3）可与阶段 0/1 并行先上，互不阻塞。

### 实施现状（2026-06-02 复核纠偏）

阶段 0 完成。阶段 1 **此前只做了一半**：`HostMembershipService` 写新表 + 旧表镜像仅覆盖
`allocate`/`reclaim`/`transfer-to-pool`（经 hms）；但 **4 个改归属的写路径仍直写旧三表、绕过新表**——
`ImportHostsToPool`、`MoveHostsInPool`、`TransferHosts`（空闲机→业务模块）、`MoveSet`（集群转业务）。
即新表当时是“只写影子表 + 写洞”，**尚不可作读源**。

- **阶段 1·里程碑 1（已完成，commit `fb76d34`）｜堵写洞使新表权威**：给 `HostMembershipService`
  加 `SyncFromLegacy(hostID)` 原语（按旧三表重建该主机新表归属，幂等、business_id/set_id 由 module 推导）；
  上述 4 个写路径在写旧表的同一事务内 guarded 调用之，零改动旧表写语义。容器全生命周期 + 浏览器真实动线 +
  全量对账验证：新表与旧表实时一致。**读侧仍读旧表，UI 行为不变。**
  - 遗留（建议废弃而非同步）：host 级 `/hosts/:id/assign|reclaim`（前端未用、storage 层无 hms、语义遗留）；
    `projection` 命令服务（死代码，无构造调用）。
- **阶段 1·里程碑 2（待做）｜读切换**：把 ~31 处读旧三表的查询（7 文件，topology 占 15，10 处需去重）
  切到 `host_node_memberships`；旧表仍双写作安全网。完成后阶段 1 才算收口，方可进阶段 2 退役旧表。

---

## 7. 阶段 B：终态对齐 mainline / 蓝鲸（可选、长期）

阶段 A 的多态 `node_kind` 已能解决全部 bug、且不动底层两套节点表。终态进一步向蓝鲸看齐：
- 建内置「资源池」保留业务，`resource_directories` 并入 `mainline_instances`（作为该业务下的节点）。
- `host_node_memberships.node_id` 统一指 `mainline_instances.id`，去掉 `node_kind` 多态——即 proposal 的 `mainline_node_resources`。
- 此时"资源池/空闲机/业务模块"在数据模型上彻底是同一种 node，主机流转纯粹是改 `node_id`。

阶段 B 不阻塞 bug 修复，作为 topology 整改（`MAINLINE_MODEL_PROPOSAL.md`、`P1-truth-layer-convergence.md`）推进到主机层时的收尾。

---

## 8. 风险与决策点
1. **冗余 `business_id/set_id` 一致性**：靠唯一写入点保证；阶段 1 加对账任务兜底。
2. **资源池保留业务 ID 的取值**：需定一个不冲突的保留值（建议负数或专用区段），避免与真实业务撞号。
3. **node_kind 多态 vs 直接进 mainline**：阶段 A 选多态（改动小、解 bug 快）；是否一步到位做阶段 B，取决于 topology 整改节奏——建议**先 A 后 B**，与"渐进收敛"路线一致。
4. **并发转移**：`Move` 事务内对 host 行加锁（`SELECT ... FOR UPDATE` host）防并发归属竞态。
