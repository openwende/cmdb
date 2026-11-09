# CMDB 模型与实例系统设计方案

> **版本**: v1.0  
> **日期**: 2026-01-12  
> **状态**: 设计完成，待实施

---

## 概述

本文档定义了 Wende CMDB 的模型与实例系统架构，采用**渐进式三阶段实施策略**，平衡**快速上线**和**长期扩展性**。

### 核心目标
- ✅ 支持业务拓扑管理（业务 → 集群 → 模块 → 主机）
- ✅ 资源池管理（未分配资源统一管理）
- ✅ 预定义核心模型（主机、容器、应用、数据库等）
- ✅ 支持用户自定义模型和字段（长期）
- ✅ 模型关系管理
- ✅ 高性能 + 高灵活性

### 设计原则
1. **渐进式演进**：分阶段实施，避免过度设计
2. **性能优先**：核心资源使用专用表
3. **灵活扩展**：支持 JSONB 动态字段
4. **标准兼容**：参考蓝鲸 CMDB 架构

---

## 架构概览

### 资源组织结构

```
┌─────────────────────────────────────┐
│     资源池 (Resource Pool)           │
│  - 待分配主机                        │
│  - 待分配容器                        │
│  - 其他未分配资源                    │
└──────────────┬──────────────────────┘
               │ 分配
               ▼
┌─────────────────────────────────────┐
│         业务 (Business)              │
│  ├─ 空闲机池                        │
│  └─ 业务拓扑                        │
│      ├─ 集群 (Cluster)              │
│      │   └─ 模块 (Module)           │
│      │       └─ 主机 (Host)         │
│      └─ 集群 2                      │
└─────────────────────────────────────┘
```

### 三阶段演进路线

| 阶段 | 时间 | 核心功能 | 存储方式 |
|-----|------|---------|---------|
| **Phase 1** | 2-3天 | 固定核心模型 + 拓扑 | 专用表 + JSONB 扩展 |
| **Phase 2** | 3-5天 | 模型元数据 + 动态字段 | 元数据表 + 专用表 |
| **Phase 3** | 1-2周 | 完全动态模型系统 | 通用实例表 |

---

## Phase 1：核心固定模型（立即实施）

### 目标
快速上线核心功能，支持主机管理和业务拓扑。

### 数据库设计

#### 1. 主机表

```sql
CREATE TABLE hosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL,
    
    -- 归属信息
    pool_type VARCHAR(50) DEFAULT 'resource_pool',  -- resource_pool | business
    business_id UUID REFERENCES businesses(id),
    cluster_id UUID,
    module_id UUID,
    
    -- 核心字段（高频查询，固定列）
    hostname VARCHAR(255) NOT NULL,
    inner_ip VARCHAR(50),
    outer_ip VARCHAR(50),
    ipv6 VARCHAR(100),
    status VARCHAR(50) DEFAULT 'running',
    
    -- 操作系统
    os_name VARCHAR(100),
    os_type VARCHAR(50),
    os_version VARCHAR(100),
    
    -- 硬件
    cpu_arch VARCHAR(50),
    cpu_model VARCHAR(200),
    cpu_cores INT,
    memory_mb INT,
    disk_gb INT,
    
    -- 云资源
    cloud_provider VARCHAR(50),
    cloud_region VARCHAR(100),
    cloud_zone VARCHAR(100),
    cloud_instance_id VARCHAR(255),
    
    -- 物理位置
    idc VARCHAR(100),
    rack VARCHAR(100),
    
    -- 扩展字段（灵活，JSONB）
    properties JSONB DEFAULT '{}',
    
    CONSTRAINT check_pool_type CHECK (pool_type IN ('resource_pool', 'business')),
    CONSTRAINT check_status CHECK (status IN ('running', 'stopped', 'maintenance', 'offline'))
);

-- 索引
CREATE INDEX idx_hosts_tenant ON hosts(tenant_id);
CREATE INDEX idx_hosts_business ON hosts(business_id);
CREATE INDEX idx_hosts_pool_type ON hosts(pool_type);
CREATE INDEX idx_hosts_inner_ip ON hosts(inner_ip);
CREATE INDEX idx_hosts_properties ON hosts USING GIN (properties);
```

#### 2. 集群表

```sql
CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(255) NOT NULL,
    description TEXT,
    cluster_type VARCHAR(50) DEFAULT 'default',  -- default, test, production
    properties JSONB DEFAULT '{}',
    
    UNIQUE(business_id, identifier)
);
```

#### 3. 模块表

```sql
CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_by UUID,
    updated_by UUID,
    tenant_id UUID NOT NULL,
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    
    name VARCHAR(255) NOT NULL,
    identifier VARCHAR(255) NOT NULL,
    description TEXT,
    module_type VARCHAR(50) DEFAULT 'default',  -- web, db, cache, mq
    properties JSONB DEFAULT '{}',
    
    UNIQUE(cluster_id, identifier)
);
```

### API 设计

#### 资源池 API

```
GET    /api/v1/resource-pool/hosts
```
# CMDB 完全动态模型系统实施计划 (PostgreSQL 版)

## 🎯 业务目标
基于 PostgreSQL 构建一套媲美蓝鲸 CMDB 的完全动态模型系统。
- **规模**: 支持 5万 - 10万+ 主机实例。
- **性能**: 核心查询响应时间 < 100ms，最大不超过 300ms。
- **灵活性**: 支持自定义模型、自定义字段、动态验证。
- **关系**: 支持简单的业务拓扑关系（业务 -> 集群 -> 模块 -> 主机/资源）。

---

## 🏗️ 核心架构设计

### 1. 存储策略：元数据 + 统一实例表
- **元数据 (Metadata)**: 存储模型定义（models）、字段定义（attributes）、关系定义（relationships）。
- **数据 (Data)**: 使用 `model_instances` 统一存储所有实例数据，字段存储在 `JSONB` 格式的 `properties` 中。

### 2. 性能保障方案
- **JSONB 优化**: 使用 `GIN` 索引支持模糊查询和包含查询。
- **表达式索引**: 针对高频核心字段（如 `ip`, `hostname`）建立表达式索引。
- **分区表**: 针对 `model_instances` 表按 `model_id` 进行声明式分区，确保单表数据量受控，提升索引效率。
- **拓扑查询**: 使用 `ltree` 扩展实现高效的树状拓扑查询。

### 3. 数据一致性与验证
- **应用层验证**: 在 Service 层根据属性定义（attributes）的类型和逻辑规则，对写入的 JSON 数据进行前置校验。
- **数据库约束**: 关键字段（如唯一标识符）通过索引确保全局唯一。

---

## 📊 数据库 Schema (v2.0)

### 第一部分：模型定义 (元数据)

```sql
-- 模型定义
CREATE TABLE models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,      -- 英文标识，如 host, switch
    display_name VARCHAR(200) NOT NULL,     -- 显示名称
    classification VARCHAR(50) NOT NULL,   -- 分类：基础设施、组织架构等
    is_builtin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 字段定义
CREATE TABLE model_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES models(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,             -- 字段标识，如 inner_ip
    display_name VARCHAR(200) NOT NULL,
    field_type VARCHAR(50) NOT NULL,        -- singlechar, int, enum, bool, etc.
    is_required BOOLEAN DEFAULT FALSE,
    is_unique BOOLEAN DEFAULT FALSE,
    is_editable BOOLEAN DEFAULT TRUE,
    options JSONB DEFAULT '{}',              -- 枚举值、正则表达式等
    sort_order INT DEFAULT 0,
    UNIQUE(model_id, name)
);
```

### 第二部分：实例存储 (数据)

```sql
-- 统一实例表（支持声明式分区）
CREATE TABLE model_instances (
    id UUID NOT NULL,
    model_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    business_id UUID,                       -- 归属业务（可选）
    properties JSONB NOT NULL DEFAULT '{}', -- 动态字段核心存储
    path ltree,                             -- 拓扑路径，支持 biz.cluster.module.inst
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id, model_id)               -- 分区表要求包含分区键
) PARTITION BY LIST (model_id);

-- GIN 索引用于通用检索
CREATE INDEX idx_inst_props_gin ON model_instances USING GIN (properties);
```

---

## 📈 百万级扩容演进路线 (1M+ Scale)

**关键结论**: 本方案**不会**堵死未来的扩容之路。相反，它提供了一个标准化的接口层，允许底层存储在未来根据压力进行透明替换。

当单一模型（如 `host`）的数据量突破 100万+ 甚至 1000万+ 时，我们可以通过以下三步平滑升级，**无需重构上层业务代码**：

### 1. 存储层：热点分离 (Hot-Model Offloading)
**原理**: 利用 Service 层的接口抽象，将特定模型（如 `host`）的存储从通用表 `model_instances` 迁移到专用表。
- **操作**: 
    - 保持 `model_instances` 用于存储低频模型（如 Switch, Firewall）。
    - 为高频模型 `host` 创建物理专用表 `hosts_optimized`（纯列式存储，去 JSONB）。
    - 在 Service 层实现路由逻辑：`if model == 'host' { use HostRepo } else { use GenericRepo }`。
- **代价**: 仅需为特定模型编写优化的 Repository 层代码。

### 2. 索引层：搜索卸载 (Search Offloading)
**原理**: PostgreSQL 负责事务写入（Source of Truth），Elasticsearch 负责复杂搜索。
- **操作**:
    - 利用 PostgreSQL 的 `Logical Replication` (CDC) 实时将数据流同步到 Elasticsearch。
    - 将 `/api/v1/search` 接口的读流量切到 ES。
- **优势**: JSONB 在 ES 中是原生支持的，亿级数据的检索响应可保持在 ms 级。

### 3. 架构层：读写分离与分库
- **操作**: 
    - 由于我们可以按 `top-level` 的 `business_id` 或 `tenant_id` 进行分库。
    - 动态模型的元数据体积很小，可以全量缓存到 Redis，数据库只承担 IO。

---

## 🚀 实施路线图 (AI 加速版)

---

## ⚠️ 关键难点与对策

1. **动态验证性能**: 验证逻辑在 Golang 内存中完成，避免复杂的数据库触发器。
2. **多租户隔离**: 强制在查询层级加上 `tenant_id` 过滤。
3. **前端配合**: 提供 `describe` 接口，以便前端动态渲染表单和列表。
---

## 性能预估

| 场景 | 数据量 | 预期性能 | 优化方案 |
|-----|--------|---------|---------|
| 主机列表查询 | 1万 | < 50ms | B-Tree 索引 |
| 主机列表查询 | 10万 | < 200ms | 分区表 |
| JSONB 字段查询 | 1万 | < 100ms | GIN 索引 |
| 拓扑树查询 | 5层深 | < 150ms | 递归查询优化 |

---

## 后续扩展方向

1. **云资源发现**：自动同步云厂商资源
2. **配置回收**：定期清理过期资源
3. **变更审计**：记录所有变更历史
4. **拓扑可视化**：图形化展示资源关系
5. **智能推荐**：基于历史数据推荐配置

---

## 参考资料

- 蓝鲸 CMDB 架构：https://github.com/TencentBlueKing/bk-cmdb
- PostgreSQL JSONB 最佳实践
- 本项目认证系统设计：`deploy/auth-design.md`

---

## 附录：完整 SQL Schema

见 `migrations/` 目录下的迁移文件。

---

**审核**: 待审核  
**实施**: 待开始  
**负责人**: TBD
