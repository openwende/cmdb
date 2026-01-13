# CMDB 模型与实例系统设计方案

> **版本**: v1.0  
> **日期**: 2026-01-12  
> **状态**: 设计完成，待实施

---

## 概述

本文档定义了 WEND CMDB 的模型与实例系统架构，采用**渐进式三阶段实施策略**，平衡**快速上线**和**长期扩展性**。

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
POST   /api/v1/resource-pool/hosts
GET    /api/v1/resource-pool/hosts/:id
PUT    /api/v1/resource-pool/hosts/:id
DELETE /api/v1/resource-pool/hosts/:id

POST   /api/v1/resource-pool/hosts/:id/assign    # 分配到业务
POST   /api/v1/businesses/:bid/hosts/:hid/recycle # 回收到资源池
```

#### 拓扑 API

```
POST   /api/v1/businesses/:business_id/clusters
GET    /api/v1/businesses/:business_id/clusters
PUT    /api/v1/clusters/:id
DELETE /api/v1/clusters/:id

POST   /api/v1/clusters/:cluster_id/modules
GET    /api/v1/clusters/:cluster_id/modules

GET    /api/v1/businesses/:business_id/topology   # 完整拓扑树
GET    /api/v1/modules/:module_id/hosts           # 模块下的主机
```

---

## Phase 2：模型元数据层

### 目标
引入模型定义，支持动态字段和验证规则。

### 关键表

```sql
-- 模型定义
CREATE TABLE models (
    id UUID PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    is_builtin BOOLEAN DEFAULT FALSE,
    storage_type VARCHAR(50) DEFAULT 'dedicated',
    table_name VARCHAR(100),
    ...
);

-- 字段定义
CREATE TABLE model_attributes (
    id UUID PRIMARY KEY,
    model_id UUID REFERENCES models(id),
    name VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    storage_type VARCHAR(50) DEFAULT 'properties',
    is_required BOOLEAN DEFAULT FALSE,
    options JSONB DEFAULT '{}',
    ...
);
```

### API

```
GET    /api/v1/models
POST   /api/v1/models
GET    /api/v1/models/:id/attributes
POST   /api/v1/models/:id/attributes
```

---

## Phase 3：完全动态模型

### 目标
用户自定义模型，无需改代码。

### 通用实例表

```sql
CREATE TABLE model_instances (
    id UUID PRIMARY KEY,
    model_id UUID REFERENCES models(id),
    tenant_id UUID NOT NULL,
    properties JSONB NOT NULL DEFAULT '{}',
    ...
);
```

---

## 关键技术决策

### 1. 混合存储策略

| 资源类型 | 存储方式 | 原因 |
|---------|---------|------|
| 主机、集群、模块 | 专用表 | 高频查询，需要性能 |
| 用户自定义模型 | 通用表 `model_instances` | 灵活，无需 DDL |

### 2. 字段存储

| 字段类型 | 位置 | 示例 |
|---------|-----|------|
| 核心字段 | 固定列 | `hostname`, `ip` |
| 扩展字段 | JSONB | `sn`, `warranty_expire` |

### 3. JSONB 使用示例

```json
{
  "sn": "SN12345678",
  "warranty_expire": "2025-12-31",
  "env": "production",
  "tags": ["web", "nginx"]
}
```

查询：
```sql
SELECT * FROM hosts WHERE properties @> '{"env": "production"}';
```

---

## 实施优先级

### 推荐路线

1. **Phase 1**（立即，2-3天）
   - 主机管理 + 拓扑
   - 资源池 + 分配流程
   - **目标**：快速上线，满足 80% 需求

2. **观察期**（2-4周）
   - 实际使用
   - 收集真实需求

3. **Phase 2**（按需，3-5天）
   - 如果需要大量自定义字段
   - 如果需要字段级验证

4. **Phase 3**（长期，1-2周）
   - 如果用户确实需要自定义模型
   - 如果需要复杂的关系管理

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
