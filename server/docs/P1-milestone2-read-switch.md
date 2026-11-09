# 阶段1·里程碑2：读切换（host 归属读路径迁到 host_node_memberships）

> 前置：里程碑1（堵写洞，commit `685cdb2`）已完成——新表 `host_node_memberships` 现与旧三表实时一致（写侧 4 个洞经 `HostMembershipService.SyncFromLegacy` 在同事务回填，allocate/reclaim/transfer-to-pool 早经 hms）。本里程碑把**读侧**从旧三表切到新表。**旧三表仍保持双写作安全网，本里程碑不删旧表**（删除是阶段2）。
>
> 背景与总体设计见 `docs/P1-host-membership-convergence.md`（§2 表结构、§6 实施现状）。

## 目标

所有**面向用户的查询读**（列表/计数/统计/拓扑树）从 `host_node_memberships` 读取，不再读 `host_module_relations` / `host_business_relations` / `resource_pool_hosts`。完成后阶段1 收口，方可进阶段2（退役旧表+v2 EdgeV2 投影）。

## 迁移规则（Strategy A：SQL 内表替换 + node_kind 过滤）

新表 schema（见 P1 §2）：`host_node_memberships(host_id, node_kind, node_id, business_id, set_id, ...)`，其中 `node_kind ∈ {'biz_module','pool_directory'}`，`business_id/set_id` 是**冗余列**（读侧免 join，写入点保证一致）。

| 旧表（按啥过滤） | 新表等价 |
|---|---|
| `host_module_relations`（`module_id`） | `host_node_memberships` WHERE `node_kind='biz_module'`，用 `node_id` 当 module_id |
| `host_business_relations`（`business_id`） | `host_node_memberships` WHERE `node_kind='biz_module'`，用冗余列 `business_id` |
| `resource_pool_hosts`（`directory_id`） | `host_node_memberships` WHERE `node_kind='pool_directory'`，用 `node_id` 当 directory_id |

**⚠️ `node_kind` 过滤必加**：`node_id` 在两类节点间数值可重叠（module.id 与 directory.id 各自自增），不带 `node_kind` 过滤会把资源池目录误当模块（反之亦然）。

**⚠️ 去重**：新表是「一主机·一模块·一行」。旧 `host_business_relations` 是「一主机·一业务·一行」。所以**按 business 维度查主机**时，同一业务多模块的主机在新表会出现多行——凡产出主机列表/计数的 business 级查询必须 `DISTINCT host_id`（或 `GROUP BY host_id`）。下表标 `去重` 的站点要特别核对。

**特殊：「在资源池/不在业务」判定**（`host_repository.go:194` 用 `LEFT JOIN host_business_relations ... WHERE hbr.host_id IS NULL` 找池外/未分配主机）→ 新表等价：`LEFT JOIN host_node_memberships hnm ON hnm.host_id=hosts.id AND hnm.node_kind='biz_module' WHERE hnm.host_id IS NULL`（无业务模块归属者）。

## 读切换站点清单（逐条迁）

> 来源：本会话 Explore 全仓调查（2026-06-02）。迁前请 `git grep` 复核行号（代码可能漂移）。

### internal/core/topology/service.go（user-facing 读，全切）
| 行 | 函数 | 查询 | 旧表 | 去重 |
|---|---|---|---|---|
| 251 | GetModule | Count(DISTINCT host) by module_id | mod | |
| 269 | ListModules | 逐模块 Count by module_id | mod | |
| 349 | DeleteModule | 删前 Count by module_id | mod | |
| 737 | buildModuleHostNodes | JOIN by module_id 出主机 | mod | |
| 776 | countModuleHosts | Count(DISTINCT) by module_id | mod | |
| 861 | buildModuleNode | Count by module_id | mod | |
| 885 | buildModuleNode | JOIN by module_id 出主机 | mod | |
| 988 | GetStatistics | Count(DISTINCT host) by business_id | biz | ✅ |
| 1180 | GetModuleHosts | JOIN by module_id 分页 | mod | |
| 1219 | GetNodeHosts(business) | JOIN biz + LEFT pool + LEFT mod，WHERE biz AND pool IS NULL | biz+pool+mod | ✅ 一主机多模块多行，需 DISTINCT |
| 1235 | GetNodeHosts(set) | JOIN by modules.set_id | mod | |
| 1248 | GetNodeHosts(module) | JOIN by module_id | mod | |
| 1262 | GetNodeHosts(idle) | JOIN by default module/set | mod | |

### internal/storage/host_repository.go
| 行 | 函数 | 查询 | 旧表 | 去重 |
|---|---|---|---|---|
| 188 | ListHosts | JOIN by business_id（已 DISTINCT） | biz | ✅ |
| 194 | ListHosts | LEFT JOIN ... IS NULL（池外/未分配主机） | biz | 特殊（见上） |
| 480 | fillHostRelations | SELECT business_id WHERE host IN | biz | ✅（DISTINCT） |
| 495 | fillHostRelations | SELECT module_id WHERE host IN | mod | |
| 546 | HostStatistics | LEFT JOIN biz，GROUP b.name，Count(DISTINCT host) | biz | ✅ |

### internal/core/instance/aggregate_service.go
| 行 | 函数 | 查询 | 旧表 | 去重 |
|---|---|---|---|---|
| 342 | loadHostBindingContext | SELECT business_id by host_id | biz | ✅（DISTINCT） |
| 351 | loadHostBindingContext | SELECT module_id by host_id | mod | |

### internal/core/dynamic_group/service.go
| 行 | 函数 | 查询 | 旧表 | 去重 |
|---|---|---|---|---|
| 235/236 | Preview | JOIN biz + LEFT mod，WHERE biz，GROUP h.id | biz+mod | ✅（已有 GROUP BY，迁后复核） |

> 注：dynamic_group 前端有他人未提交 WIP，但这是**后端读**，不碰前端文件，影响小。仍建议放在靠后单独一提交。

### internal/core/service_template/service.go
| 行 | 函数 | 查询 | 旧表 | 去重 |
|---|---|---|---|---|
| 105 | ListServiceTemplates | JOIN mod + JOIN modules WHERE service_template_id，Count(DISTINCT host) | mod | |

### internal/core/resource_directory/service.go
| 行 | 函数 | 查询 | 旧表 | 去重 |
|---|---|---|---|---|
| 941 | GetStatistics | JOIN resource_directories on directory_id，GROUP dir 名，Count | pool | |

### ❌ 不切（写路径内部读，旧表写逻辑保留；阶段2 才动）
- `topology/service.go:439` `removeIdleModuleRelation`：读旧表找 idle 模块以驱动**旧表删除**（TransferHosts 内部），属写逻辑，新表由 SyncFromLegacy 回填。**保留**。
- `projection/business_topology_command_service.go:1018`：同上，且 projection 命令服务是**死代码**（无构造调用）。**保留/留待阶段2 删**。

## 建议迁移顺序（小→大，逐文件一提交 + 验证）

1. service_template（1）→ resource_directory GetStatistics（1）→ aggregate（2）：叶子、低风险热身。
2. host_repository（5）：含 ListHosts 的 business/pool 过滤（去重 + IS NULL 特殊），核心列表。
3. dynamic_group（2）：单独一提交。
4. **topology（13）**：最大、最核心（拓扑树计数 + GetNodeHosts），建议拆 2-3 提交（计数类 / GetNodeHosts 类）。

每文件：改 SQL → `go build ./...` → `go test ./...` → 容器 `docker compose up -d --build app` → curl/浏览器核对该读路径数字与旧表一致。

## 验证

- **逐路径对账**：迁某读路径后，构造该路径的真实查询，对比"读新表"结果 == "读旧表"结果（因旧表仍双写，二者应永远一致）。
- **浏览器真实动线**：业务拓扑树各节点计数（业务/集群/模块/空闲机）、主机列表、运营概览主机数、资源目录统计、动态分组预览。
- **回归**：全量 18 包 `go test ./...` 绿。
- 数据现状（里程碑1 验证后）：web-server-01/02/03 三台都在资源池 dir1（`host_node_memberships` 与 `resource_pool_hosts` 均 pool_directory:1，全对账一致）。要测业务模块读，先用真实动线（导入→分配→转移）把主机放进模块（这些写都已进新表）。对账 SQL：

```sql
WITH new_m AS (SELECT host_id, node_kind, node_id FROM host_node_memberships),
old_m AS (SELECT host_id,'biz_module' k,module_id n FROM host_module_relations
          UNION ALL SELECT host_id,'pool_directory',directory_id FROM resource_pool_hosts)
SELECT h.display_id, h.host_name,
  (SELECT string_agg(node_kind||':'||node_id,',' ORDER BY 1) FROM new_m WHERE host_id=h.id) new,
  (SELECT string_agg(k||':'||n,',' ORDER BY 1) FROM old_m WHERE host_id=h.id) old
FROM hosts h WHERE h.is_destroyed=false ORDER BY h.display_id;
```

## 收口后

阶段1 完成（写双写 + 读全切新表）。进**阶段2**：删旧三表 + v2 EdgeV2 投影 + 删 SyncFromLegacy/mirror 过渡逻辑 + 清空 topology/resource_directory 残留旧表写、清理 host 级 `/hosts/:id/assign|reclaim`（前端未用、语义遗留）与 projection 死代码。见 P1 §6/§7。
