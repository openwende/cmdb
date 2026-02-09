# 系统架构文档

本文档描述 WEND CMDB Backend 的系统架构、核心设计决策和关键技术实现。

## 📐 系统架构概览

### 分层架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     API Layer (Handler)                      │
│  - HTTP路由和请求处理                                          │
│  - 参数验证和序列化                                            │
│  - 错误处理和响应格式化                                         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  Business Layer (Service)                    │
│  - 业务逻辑实现                                               │
│  - 事务管理                                                   │
│  - 数据校验和转换                                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 Data Layer (Repository)                      │
│  - 数据访问抽象                                               │
│  - SQL查询构建                                                │
│  - 数据库操作                                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  - 关系型数据存储                                             │
│  - JSONB扩展字段支持                                          │
│  - 事务和约束管理                                              │
└─────────────────────────────────────────────────────────────┘
```

### 目录结构

```
wend-cmdb-backend/
├── cmd/
│   └── server/              # 应用入口
├── internal/
│   ├── api/
│   │   ├── handlers/        # API处理器（HTTP层）
│   │   └── server/          # HTTP服务器和路由
│   ├── core/                # 核心业务逻辑
│   │   ├── business/        # 业务管理
│   │   ├── host/            # 主机管理
│   │   ├── topology/        # 拓扑管理
│   │   ├── process/         # 进程模板
│   │   ├── cloud_area/      # 云区域管理
│   │   └── dynamic_model/   # 动态模型引擎
│   ├── storage/             # 数据访问层
│   │   ├── business_repository.go
│   │   ├── host_repository.go
│   │   └── ...
│   ├── types/               # 数据类型定义
│   │   ├── business.go
│   │   ├── host.go
│   │   └── ...
│   ├── import_export/       # 导入导出功能
│   └── migration/           # 数据迁移工具
├── migrations/              # 数据库迁移文件
├── docs/                    # 文档
└── examples/               # 示例代码
```

## 🎯 核心设计决策

### 1. 云区域隔离设计

#### 设计背景

在多云/混合云环境中，不同云平台或VPC的主机可能使用相同的内网IP地址，导致IP冲突问题。

**问题场景**：
```
AWS VPC-A:     10.0.1.10 (Web服务器)
AWS VPC-B:     10.0.1.10 (DB服务器)   ❌ IP相同！
腾讯云 VPC:     10.0.1.10 (缓存服务器) ❌ IP相同！
```

#### 解决方案：云区域（Cloud Area）

借鉴蓝鲸CMDB的设计理念，引入**云区域**概念进行逻辑隔离。

```sql
-- 云区域表
CREATE TABLE cloud_areas (
    id UUID PRIMARY KEY,
    name VARCHAR(256) NOT NULL,
    cloud_vendor VARCHAR(32),     -- aws/tencent_cloud/aliyun/private
    vpc_id VARCHAR(256),          -- 云平台VPC ID
    region VARCHAR(64),           -- us-east-1/ap-guangzhou
    status VARCHAR(32),
    tenant_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 主机表（简化）
CREATE TABLE hosts (
    id UUID PRIMARY KEY,
    cloud_area_id UUID REFERENCES cloud_areas(id),
    inner_ip VARCHAR(256) NOT NULL,

    -- 唯一性约束：云区域 + 内网IP
    CONSTRAINT uk_cloud_ip UNIQUE (cloud_area_id, inner_ip)
);
```

**核心原则**：
- ✅ **复合键唯一性**: `(cloud_area_id, inner_ip)` 保证同一云区域内IP唯一
- ✅ **跨区域隔离**: 不同云区域可以有相同的IP地址
- ✅ **灵活映射**: 云区域可以对应VPC、Region或物理机房

#### 三级标识体系

| 标识方式 | 组成 | 用途 | 优先级 |
|---------|------|------|--------|
| 数据库主键 | `id (UUID)` | 内部系统使用 | ⭐⭐⭐ |
| 云实例ID | `(cloud_vendor, cloud_instance_id)` | 云主机同步 | ⭐⭐⭐ |
| 云区域+IP | `(cloud_area_id, inner_ip)` | 业务唯一标识 | ⭐⭐ |

```go
// 智能主机查找（按优先级尝试）
func FindHost(identifier *HostIdentifier) (*Host, error) {
    // 优先级1：数据库主键（最快）
    if identifier.ID != uuid.Nil {
        return hostRepo.FindByID(ctx, identifier.ID)
    }

    // 优先级2：云实例ID（云主机首选）
    if identifier.CloudVendor != "" && identifier.InstanceID != "" {
        return hostRepo.FindByCloudInstance(ctx,
            identifier.CloudVendor,
            identifier.InstanceID)
    }

    // 优先级3：云区域 + IP（传统方式）
    if identifier.CloudAreaID != uuid.Nil && identifier.InnerIP != "" {
        return hostRepo.FindByCloudAndIP(ctx,
            identifier.CloudAreaID,
            identifier.InnerIP)
    }

    return nil, errors.New("invalid host identifier")
}
```

### 2. 主机标识策略

#### 数据模型

```go
type Host struct {
    // 第一级：数据库主键
    ID uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`

    // 第二级：业务唯一标识
    CloudAreaID uuid.UUID `gorm:"type:uuid;not null" json:"cloud_area_id"`
    InnerIP     string    `gorm:"type:varchar(256);not null" json:"inner_ip"`

    // 第三级：云平台标识
    CloudVendor     string `gorm:"type:varchar(32)" json:"cloud_vendor"`
    CloudInstanceID string `gorm:"type:varchar(256)" json:"cloud_instance_id"`

    // 基本信息
    HostName string `json:"host_name"`
    OuterIP  string `json:"outer_ip"`
    Status   string `json:"status"`

    // 硬件信息
    CPU    int `json:"cpu"`
    Memory int `json:"memory"`
    Disk   int `json:"disk"`

    // 操作系统
    OSType    string `json:"os_type"`
    OSName    string `json:"os_name"`
    OSVersion string `json:"os_version"`

    // 业务关联
    BusinessID *uuid.UUID `gorm:"type:uuid" json:"business_id,omitempty"`

    // 租户和时间戳
    TenantID  uuid.UUID  `json:"tenant_id"`
    CreatedAt time.Time  `json:"created_at"`
    UpdatedAt time.Time  `json:"updated_at"`
    DeletedAt *time.Time `gorm:"index" json:"deleted_at,omitempty"`
}
```

#### 唯一性约束

```sql
-- 数据库约束
ALTER TABLE hosts
ADD CONSTRAINT uk_cloud_ip
UNIQUE (cloud_area_id, inner_ip);

ALTER TABLE hosts
ADD CONSTRAINT uk_cloud_instance
UNIQUE (cloud_vendor, cloud_instance_id)
WHERE cloud_instance_id IS NOT NULL AND cloud_instance_id != '';
```

### 3. 资源池管理

#### 主机生命周期

```
┌─────────────────────────────────────────────────────────────┐
│                    主机生命周期状态机                          │
└─────────────────────────────────────────────────────────────┘

    创建/导入
        ↓
   ┌─────────┐
   │ 资源池  │ ←─────── 回收 ────────┐
   │(待分配) │                       │
   └─────────┘                       │
        │                           │
      分配                          │
        ↓                           │
   ┌─────────┐                 ┌─────────┐
   │  测试   │ ────────────→   │  上线   │
   └─────────┘     上线        └─────────┘
        │                           │
        └────── 故障 ────────────────┤
                ↓                   │
           ┌─────────┐              │
           │  已故障 │ ─────────────┘
           └─────────┘    修复
                │
              销毁
                ↓
           ┌─────────┐
           │  已销毁 │
           └─────────┘
```

#### 资源池操作

```go
// 主机分配到业务
func (s *HostService) AssignToBusiness(ctx context.Context,
    hostID, businessID uuid.UUID) error {

    host, err := s.repo.FindByID(ctx, hostID)
    if err != nil {
        return err
    }

    // 检查主机状态
    if host.BusinessID != nil {
        return errors.New("host already assigned to business")
    }

    // 分配到业务
    host.BusinessID = &businessID
    host.Status = "testing" // 初始状态为测试中

    return s.repo.Update(ctx, host)
}

// 主机回收到资源池
func (s *HostService) ReclaimToPool(ctx context.Context, hostID uuid.UUID) error {
    host, err := s.repo.FindByID(ctx, hostID)
    if err != nil {
        return err
    }

    // 回收到资源池
    host.BusinessID = nil
    host.Status = "available"

    return s.repo.Update(ctx, host)
}
```

### 4. 动态模型引擎

WEND CMDB 支持动态创建和管理模型，无需修改代码即可扩展新的资源类型。

#### 核心概念

```go
// 模型定义
type Model struct {
    ID             uuid.UUID `json:"id"`
    Name           string    `json:"name"`            // 模型唯一标识
    DisplayName    string    `json:"display_name"`    // 显示名称
    Classification string    `json:"classification"`   // 分类：resource/network/application
    Description    string    `json:"description"`
    TenantID       uuid.UUID `json:"tenant_id"`
}

// 模型属性
type ModelAttribute struct {
    ID          uuid.UUID              `json:"id"`
    ModelID     uuid.UUID              `json:"model_id"`
    Name        string                 `json:"name"`         // 属性名
    DisplayName string                 `json:"display_name"` // 显示名
    FieldType   string                 `json:"field_type"`   // string/int/bool/enum/json
    IsRequired  bool                   `json:"is_required"`
    IsUnique    bool                   `json:"is_unique"`
    Options     map[string]interface{} `json:"options"`      // 字段选项
}

// 模型实例（通用）
type ModelInstance struct {
    ID         uuid.UUID              `json:"id"`
    ModelID    uuid.UUID              `json:"model_id"`
    Properties map[string]interface{} `json:"properties"` // 动态属性（JSONB）
    TenantID   uuid.UUID              `json:"tenant_id"`
    CreatedAt  time.Time              `json:"created_at"`
    UpdatedAt  time.Time              `json:"updated_at"`
}
```

#### 使用示例

```bash
# 创建自定义模型：数据库实例
POST /api/v1/models
{
  "name": "database_instance",
  "display_name": "数据库实例",
  "classification": "application"
}

# 添加属性
POST /api/v1/models/database_instance/attributes
{
  "name": "db_type",
  "display_name": "数据库类型",
  "field_type": "enum",
  "is_required": true,
  "options": {
    "enum_values": ["MySQL", "PostgreSQL", "MongoDB", "Redis"]
  }
}

# 创建实例
POST /api/v1/models/database_instance/instances
{
  "properties": {
    "db_type": "PostgreSQL",
    "version": "14.5",
    "port": 5432,
    "max_connections": 100
  }
}
```

## ⚡ 性能优化

### N+1 查询问题修复

#### 问题描述

在列出业务列表时，原实现存在 N+1 查询问题：

```go
// ❌ 原实现（N+1 查询）
func (s *BusinessService) ListBusinesses(ctx context.Context) ([]*types.Business, error) {
    businesses, err := s.repo.List(ctx)
    if err != nil {
        return nil, err
    }

    // 为每个业务单独查询 ResourceDirectory（N次查询）
    for _, biz := range businesses {
        rd, _ := s.rdRepo.FindByBusinessID(ctx, biz.ID)
        biz.ResourceDirectory = rd
    }

    return businesses, nil
}
```

**性能问题**：
- 1次查询业务列表
- N次查询资源目录（每个业务一次）
- 总计：1 + N 次数据库查询

#### 解决方案：批量查询

```go
// ✅ 优化后（2次查询）
func (s *BusinessService) ListBusinesses(ctx context.Context) ([]*types.Business, error) {
    // 1. 查询所有业务
    businesses, err := s.repo.List(ctx)
    if err != nil {
        return nil, err
    }

    if len(businesses) == 0 {
        return businesses, nil
    }

    // 2. 批量查询资源目录
    businessIDs := make([]uuid.UUID, len(businesses))
    for i, biz := range businesses {
        businessIDs[i] = biz.ID
    }

    rds, err := s.rdRepo.ListByBusinessIDs(ctx, businessIDs)
    if err != nil {
        return nil, err
    }

    // 3. 构建映射表（内存操作）
    rdMap := make(map[uuid.UUID]*types.ResourceDirectory)
    for _, rd := range rds {
        rdMap[rd.BusinessID] = rd
    }

    // 4. 关联数据
    for _, biz := range businesses {
        if rd, exists := rdMap[biz.ID]; exists {
            biz.ResourceDirectory = rd
        }
    }

    return businesses, nil
}

// 新增批量查询方法
func (r *ResourceDirectoryRepository) ListByBusinessIDs(
    ctx context.Context,
    businessIDs []uuid.UUID,
) ([]*types.ResourceDirectory, error) {
    var rds []*types.ResourceDirectory
    err := r.db.Where("business_id IN ?", businessIDs).Find(&rds).Error
    return rds, err
}
```

#### 性能提升

| 业务数量 | 原实现查询次数 | 优化后查询次数 | 性能提升 |
|---------|--------------|--------------|---------|
| 10      | 11 (1+10)    | 2            | **5.5x** |
| 100     | 101 (1+100)  | 2            | **50x** |
| 1000    | 1001         | 2            | **500x** |

### 数据库索引优化

```sql
-- 主机查询索引
CREATE INDEX idx_hosts_cloud_area ON hosts(cloud_area_id);
CREATE INDEX idx_hosts_business ON hosts(business_id) WHERE business_id IS NOT NULL;
CREATE INDEX idx_hosts_cloud_instance ON hosts(cloud_vendor, cloud_instance_id);

-- 复合索引
CREATE INDEX idx_hosts_cloud_ip ON hosts(cloud_area_id, inner_ip);

-- 资源目录查询索引
CREATE INDEX idx_resource_directory_business ON resource_directories(business_id);

-- JSONB字段索引（动态模型）
CREATE INDEX idx_model_instances_props ON model_instances USING gin(properties);
```

## 🔒 安全性设计

### 1. 环境变量配置

敏感信息通过环境变量管理，避免硬编码：

```go
// ❌ 不安全：硬编码密码
dsn := "postgres://user:password123@localhost:5432/cmdb"

// ✅ 安全：使用环境变量
password := os.Getenv("DB_PASSWORD")
if password == "" {
    log.Fatal("DB_PASSWORD environment variable not set")
}
dsn := fmt.Sprintf("postgres://user:%s@localhost:5432/cmdb", password)
```

### 2. 多租户隔离

所有资源都关联 `tenant_id`，确保租户间数据隔离：

```go
// 查询时自动过滤租户
func (r *BusinessRepository) List(ctx context.Context, tenantID uuid.UUID) ([]*types.Business, error) {
    var businesses []*types.Business
    err := r.db.Where("tenant_id = ?", tenantID).
        Where("deleted_at IS NULL").
        Find(&businesses).Error
    return businesses, err
}
```

### 3. 软删除

关键资源使用软删除，防止误删除：

```go
type Business struct {
    ID        uuid.UUID  `gorm:"type:uuid;primary_key"`
    // ... 其他字段
    DeletedAt *time.Time `gorm:"index" json:"deleted_at,omitempty"`
}

// GORM 自动过滤已删除记录
db.Find(&businesses) // 自动添加 WHERE deleted_at IS NULL
```

### 4. 业务删除保护

业务在归档状态才能删除：

```go
func (s *BusinessService) Delete(ctx context.Context, id uuid.UUID) error {
    biz, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return err
    }

    // 检查生命周期状态
    if biz.Lifecycle != types.Archived {
        return errors.New("只有归档状态的业务可以删除")
    }

    return s.repo.Delete(ctx, id)
}
```

## 📊 数据模型设计

### 核心表结构

#### 业务表 (businesses)

```sql
CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(256) NOT NULL,
    lifecycle VARCHAR(32) NOT NULL,  -- testing/online/offline/archived
    operator VARCHAR(256),
    developer VARCHAR(256),
    tester VARCHAR(256),
    maintainer VARCHAR(256),
    description TEXT,

    tenant_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,

    CONSTRAINT uk_tenant_name UNIQUE (tenant_id, name, deleted_at)
);
```

#### 主机表 (hosts)

```sql
CREATE TABLE hosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- 网络标识
    cloud_area_id UUID NOT NULL REFERENCES cloud_areas(id),
    inner_ip VARCHAR(256) NOT NULL,
    outer_ip VARCHAR(256),

    -- 云平台标识
    cloud_vendor VARCHAR(32),
    cloud_instance_id VARCHAR(256),

    -- 基本信息
    host_name VARCHAR(256),
    status VARCHAR(32),

    -- 硬件信息
    cpu INT,
    memory INT,
    disk INT,

    -- 操作系统
    os_type VARCHAR(64),
    os_name VARCHAR(256),
    os_version VARCHAR(128),

    -- 业务关联
    business_id UUID REFERENCES businesses(id),

    -- 租户和时间戳
    tenant_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,

    -- 唯一性约束
    CONSTRAINT uk_cloud_ip UNIQUE (cloud_area_id, inner_ip),
    CONSTRAINT uk_cloud_instance UNIQUE (cloud_vendor, cloud_instance_id)
);
```

#### 云区域表 (cloud_areas)

```sql
CREATE TABLE cloud_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(256) NOT NULL,
    cloud_vendor VARCHAR(32),
    vpc_id VARCHAR(256),
    region VARCHAR(64),
    cidr VARCHAR(64),
    status VARCHAR(32),

    tenant_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## 🧪 测试策略

### 测试覆盖率

当前覆盖率（2026-02）：
- `internal/core/business`: **23.5%**
- `internal/core/host`: **16.8%**
- `internal/storage`: **14.0%**

目标覆盖率：
- 核心业务逻辑: **70%+**
- 总体覆盖率: **40%+**

### 测试层次

```
单元测试 (Unit Tests)
├─ Service层：业务逻辑测试（使用Mock Repository）
├─ Repository层：数据访问测试（使用测试数据库）
└─ Util层：工具函数测试

集成测试 (Integration Tests)
├─ API端到端测试
└─ 数据库集成测试

性能测试 (Performance Tests)
└─ N+1查询优化验证
```

详细测试指南参见 [TESTING.md](TESTING.md)

## 🚀 部署架构

### 应用部署

```
┌──────────────────────────────────────────┐
│          Load Balancer (Nginx)           │
└──────────────────────────────────────────┘
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
┌─────────┐   ┌─────────┐   ┌─────────┐
│ CMDB #1 │   │ CMDB #2 │   │ CMDB #3 │
│ (Go)    │   │ (Go)    │   │ (Go)    │
└─────────┘   └─────────┘   └─────────┘
    └───────────────┼───────────────┘
                    ↓
        ┌─────────────────────┐
        │   PostgreSQL 14+    │
        │   (Primary/Replica) │
        └─────────────────────┘
```

### 环境要求

- **Go**: 1.24+
- **PostgreSQL**: 14+
- **OS**: Linux/macOS/Windows
- **内存**: 最小 2GB，推荐 4GB+
- **存储**: SSD推荐

## 📝 API设计原则

### RESTful风格

```
GET    /api/v1/businesses        # 列表
POST   /api/v1/businesses        # 创建
GET    /api/v1/businesses/:id    # 详情
PUT    /api/v1/businesses/:id    # 更新
DELETE /api/v1/businesses/:id    # 删除
```

### 错误响应格式

```json
{
  "error": "BusinessNotFound",
  "message": "业务不存在",
  "details": {
    "business_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### 分页响应

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 100
  }
}
```

## 🔮 未来扩展

### 计划中的功能

1. **云资源同步**
   - AWS、腾讯云、阿里云适配器
   - 定时同步调度
   - 增量同步优化

2. **网络拓扑管理**
   - VPC、Subnet、Security Group
   - 网络可视化
   - 路由表管理

3. **IP地址池管理**
   - IP段规划
   - 自动分配/回收
   - IP使用率统计

4. **监控和告警**
   - 主机状态监控
   - 业务拓扑监控
   - 异常告警

详细路线图参见 [ROADMAP.md](ROADMAP.md)

## 📚 参考资料

### 设计参考

- [蓝鲸CMDB (BK-CMDB)](https://github.com/TencentBlueKing/bk-cmdb) - 云区域隔离设计
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) - 分层架构
- [PostgreSQL JSONB](https://www.postgresql.org/docs/current/datatype-json.html) - 动态字段存储

### 相关文档

- [API 文档](API.md)
- [测试指南](TESTING.md)
- [快速开始](QUICKSTART.md)
- [贡献指南](CONTRIBUTING.md)

---

## 附录：关键技术点

### A. 云区域映射策略

| 场景 | 云区域定义 | 示例 |
|-----|----------|------|
| 单VPC | 1个云区域 = 1个VPC | AWS VPC-A → CloudArea-1 |
| 多VPC同Region | 1个云区域 = 1个VPC | VPC-A → CA-1, VPC-B → CA-2 |
| 物理机房 | 1个云区域 = 1个机房 | IDC-Beijing → CloudArea-3 |
| 混合云 | 按网络隔离划分 | 灵活配置 |

### B. 主机状态流转

| 状态 | 说明 | 允许的操作 |
|-----|------|----------|
| available | 资源池可用 | 分配到业务 |
| testing | 测试中 | 上线、回收 |
| online | 已上线 | 下线、故障标记 |
| offline | 已下线 | 回收、销毁 |
| faulty | 故障 | 修复、销毁 |
| destroyed | 已销毁 | 无 |

### C. 性能优化检查清单

- [x] N+1查询优化（批量查询）
- [x] 数据库索引优化
- [ ] 查询结果缓存
- [ ] 连接池优化
- [ ] 慢查询监控
- [ ] 数据库分区

---

**文档版本**: 1.0
**最后更新**: 2026-02-09
**维护者**: WEND CMDB Team
