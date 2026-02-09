# 云主机批量导入功能 - 架构调整总结

## 📋 调整原因

基于对蓝鲸CMDB源码的研究，发现蓝鲸采用**双维度设计**：
1. **云区域（bk_cloud_id）** - 用于IP隔离
2. **业务（bk_biz_id）** - 用于资源归属（NULL = 资源池）

这个设计比我们之前的"网络空间"方案更合理，因为：
- ✅ 同时支持IP隔离和业务管理
- ✅ 资源池概念清晰（business_id = NULL）
- ✅ 符合主流CMDB的使用习惯

---

## ✅ 已完成的修改

### 1. 数据库迁移文件 ✅

**文件**: `migrations/20260126120000_create_hosts.up.sql`

**核心变更**:
```sql
-- 旧表名: network_spaces
-- 新表名: cloud_areas

-- 旧字段（hosts表）
network_space_id UUID

-- 新字段（hosts表）
cloud_area_id UUID    -- 云区域（IP隔离维度）
business_id UUID      -- 业务归属（NULL = 资源池）
vpc_id TEXT           -- VPC ID（冗余存储）
subnet_id TEXT        -- 子网ID

-- IP唯一性约束
-- 旧: (network_space_id, primary_ip)
-- 新: (cloud_area_id, primary_ip)  ← 类似蓝鲸的 (bk_cloud_id, bk_host_innerip)
```

**默认云区域**:
```sql
INSERT INTO cloud_areas (id, name, identifier, type)
VALUES ('00000000-...', '直连区域', 'default', 'direct');
-- 类似蓝鲸的 bk_cloud_id=0
```

### 2. Go 类型定义 ✅

**新增文件**: `internal/types/cloud_area.go`
- CloudArea 结构体
- CreateCloudAreaRequest
- UpdateCloudAreaRequest
- CloudAreaQueryParams

**修改文件**: `internal/types/host.go`
```go
type Host struct {
    // 新增字段
    CloudAreaID *uuid.UUID  // 云区域（IP隔离）
    BusinessID  *uuid.UUID  // 业务归属（NULL = 资源池）
    VPCID       *string     // VPC ID
    SubnetID    *string     // 子网ID

    // 删除字段
    // NetworkSpaceID *uuid.UUID  ← 已删除
}

// 新增类型
type AssignHostToBusinessRequest  // 分配主机到业务
type HostQueryParams {
    CloudAreaID *uuid.UUID
    BusinessID  *uuid.UUID
    InPool      *bool  // 查询资源池
}
```

### 3. Repository 层 ✅

**新增文件**: `internal/storage/cloud_area_repository.go`
```go
type CloudAreaRepository interface {
    CreateCloudArea
    GetCloudArea
    GetCloudAreaByIdentifier
    GetDefaultCloudArea  // 获取默认云区域
    ListCloudAreas
    UpdateCloudArea
    DeleteCloudArea
}
```

**修改文件**: `internal/storage/host_repository.go`
```go
type HostRepository interface {
    // 新增方法
    GetHostByCloudAreaIP    // 按云区域+IP查询
    AssignToBusiness        // 分配到业务
    ReclaimToPool           // 回收到资源池

    // 修改方法
    CheckIPConflict         // 改为按 cloud_area_id 检查
    ListHosts               // 支持按 business_id、in_pool 查询

    // 删除方法
    // GetHostByNetworkIP    ← 已删除
}
```

---

## 🚧 待完成的修改

由于改动较大，以下部分还需要继续完成：

### 4. Service 层 (待完成)

**需要创建**: `internal/core/cloud_area/service.go`
- 替换原来的 `internal/core/network/service.go`
- 提供云区域管理业务逻辑

**需要修改**: `internal/core/host/service.go`
```go
type Service struct {
    hostRepo      storage.HostRepository
    cloudAreaRepo storage.CloudAreaRepository  // 改名
}

// 需要修改的方法
func (s *Service) CreateHost(...) {
    // 1. 如果未指定 cloud_area_id，使用默认云区域
    // 2. 检查IP冲突（按cloud_area_id）
    // 3. business_id 可以为 NULL（资源池）
}

func (s *Service) BatchImportHosts(...) {
    // 适配新的 cloud_area 和 business 逻辑
}

// 需要新增的方法
func (s *Service) AssignToBusiness(hostID, businessID uuid.UUID) error
func (s *Service) ReclaimToPool(hostID uuid.UUID) error
```

### 5. Handler 层 (待完成)

**需要创建**: `internal/api/handlers/cloud_area_handler.go`
- 替换 `network_space_handler.go`

**需要修改**: `internal/api/handlers/host_handler.go`
```go
// 新增 API
PUT /api/v1/hosts/:id/assign     // 分配到业务
PUT /api/v1/hosts/:id/reclaim    // 回收到资源池

// 修改查询 API
GET /api/v1/hosts?in_pool=true   // 查询资源池
GET /api/v1/hosts?business_id=xxx // 按业务查询
GET /api/v1/hosts?cloud_area_id=xxx // 按云区域查询
```

### 6. 路由配置 (待完成)

**需要修改**: `internal/api/server/routes_host.go`
```go
// 旧路由
v1.Group("/network-spaces")

// 新路由
v1.Group("/cloud-areas")

// hosts 路由新增
hosts.PUT("/:id/assign", hostHandler.AssignToBusiness)
hosts.PUT("/:id/reclaim", hostHandler.ReclaimToPool)
```

### 7. 清理工作 (待完成)

**需要删除的文件**:
- `internal/types/network.go`
- `internal/storage/network_space_repository.go`
- `internal/core/network/service.go`
- `internal/api/handlers/network_space_handler.go`

---

## 🎯 核心概念对比

| 概念 | 旧设计 | 新设计（蓝鲸模式） |
|------|--------|------------------|
| **IP隔离** | network_space_id | cloud_area_id |
| **资源归属** | 无 | business_id (NULL=资源池) |
| **默认区域** | 无 | 直连区域（identifier='default'） |
| **IP唯一性** | (network_space, IP) | (cloud_area, IP) |
| **资源池** | network_space=NULL | business_id=NULL |

---

## 📝 使用场景示例

### 场景1：导入到资源池（默认云区域）

```bash
POST /api/v1/hosts/batch
{
  "use_default_cloud_area": true,  # 使用默认云区域
  "hosts": [
    {
      "host_name": "host-01",
      "primary_ip": "192.168.1.10",
      # cloud_area_id 自动设为默认
      # business_id = NULL（资源池）
    }
  ]
}
```

### 场景2：多云环境，IP相同不冲突

```bash
# 1. 创建AWS云区域
POST /api/v1/cloud-areas
{
  "name": "AWS-美东",
  "identifier": "aws-us-east-1",
  "type": "vpc",
  "cloud_vendor": "aws",
  "vpc_id": "vpc-abc123"
}

# 2. 创建腾讯云区域
POST /api/v1/cloud-areas
{
  "name": "腾讯云-广州",
  "identifier": "tencent-ap-guangzhou",
  "type": "vpc",
  "cloud_vendor": "tencent_cloud",
  "vpc_id": "vpc-xyz789"
}

# 3. 导入主机（相同IP不冲突）
POST /api/v1/hosts/batch
{
  "hosts": [
    {
      "host_name": "aws-web-01",
      "cloud_area_id": "AWS-ID",
      "primary_ip": "10.0.1.10"  # AWS的IP
    },
    {
      "host_name": "tx-web-01",
      "cloud_area_id": "TX-ID",
      "primary_ip": "10.0.1.10"  # 腾讯云的IP，不冲突！
    }
  ]
}
```

### 场景3：从资源池分配到业务

```bash
# 1. 查询资源池主机
GET /api/v1/hosts?in_pool=true

# 2. 分配到业务
PUT /api/v1/hosts/{id}/assign
{
  "business_id": "电商平台-ID"
}

# 3. 回收到资源池
PUT /api/v1/hosts/{id}/reclaim
```

---

## 🔧 下一步行动

### 立即需要做的：

1. **完成 Service 层修改**
   - 创建 `cloud_area/service.go`
   - 修改 `host/service.go`

2. **完成 Handler 层修改**
   - 创建 `cloud_area_handler.go`
   - 修改 `host_handler.go`（新增分配/回收API）

3. **更新路由配置**
   - 修改 `routes_host.go`

4. **清理旧文件**
   - 删除所有 network 相关文件

5. **测试**
   - 运行数据库迁移
   - 测试API功能
   - 更新文档

### 预估工作量：

- Service 层：30分钟
- Handler 层：30分钟
- 路由和清理：15分钟
- 测试和文档：30分钟

**总计**: 约2小时可以全部完成

---

## 💡 优势总结

新设计的优势：

1. ✅ **完全符合蓝鲸CMDB设计理念**
2. ✅ **双维度管理**：IP隔离 + 业务归属
3. ✅ **资源池概念清晰**：business_id=NULL
4. ✅ **支持多云IP重叠**：按cloud_area隔离
5. ✅ **用户体验更好**：不需要强制创建网络空间
6. ✅ **符合使用习惯**：类似主流CMDB

---

**当前进度**: 50% 完成
**状态**: Repository 层已完成，Service/Handler/Routes 待完成

你要我继续完成剩余的部分吗？

