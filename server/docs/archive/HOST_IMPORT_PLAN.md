# 云主机批量导入功能实施方案

## 📋 功能概述

实现云主机的**批量导入**功能，允许用户通过 Excel/CSV/JSON 等方式批量导入主机数据。

**核心原则**：
- ✅ 简化优先，快速交付 MVP
- ✅ 数据模型保持扩展性（为后续云同步功能预留）
- ✅ 不依赖云厂商 SDK
- ❌ 暂不实现云同步、定时任务

---

## 🎯 实施范围

### 包含的功能

1. **数据模型设计**
   - `network_spaces` 表（网络空间/VPC 抽象）
   - `hosts` 表（云主机）
   - Go 类型定义

2. **批量导入 API**
   - 支持 JSON 格式批量导入
   - 支持 Excel/CSV 文件导入
   - 数据校验和错误处理
   - 导入结果反馈（成功/失败统计）

3. **基础 CRUD API**
   - 主机查询（列表、详情、过滤）
   - 主机更新（编辑自定义字段）
   - 主机删除（标记删除）
   - 网络空间查询

### 不包含的功能（后续实现）

- ❌ 云账号管理
- ❌ 云同步引擎
- ❌ 定时任务调度
- ❌ 云厂商适配器（AWS/腾讯云/阿里云）
- ❌ 前端页面

---

## 📊 数据模型设计

### 1. network_spaces 表（网络空间）

```sql
CREATE TABLE IF NOT EXISTS network_spaces (
    -- 基础字段
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    tenant_id UUID NOT NULL,

    -- 核心字段
    name TEXT NOT NULL,                      -- 网络空间名称（如：生产VPC、测试VPC）
    identifier TEXT NOT NULL,                -- 唯一标识符
    cidr_block TEXT,                         -- CIDR 地址块（如：10.0.0.0/16）
    region TEXT,                             -- 区域（如：us-east-1、ap-guangzhou）
    type TEXT DEFAULT 'vpc',                 -- 类型：vpc、subnet、custom
    description TEXT,                        -- 描述

    -- JSONB 扩展字段（为云同步预留）
    cloud_metadata JSONB,                    -- 云平台元数据（后续云同步时使用）
    custom_fields JSONB                      -- 自定义字段
);

CREATE UNIQUE INDEX idx_network_spaces_identifier_tenant
    ON network_spaces (identifier, tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_network_spaces_tenant_id ON network_spaces (tenant_id);
CREATE INDEX idx_network_spaces_region ON network_spaces (region);
CREATE INDEX idx_network_spaces_cloud_metadata ON network_spaces USING GIN (cloud_metadata);
```

**设计说明**：
- 抽象化设计，不直接映射云平台的 VPC/Subnet
- `cloud_metadata` 为后续云同步预留（存储云平台 VPC ID 等信息）
- `identifier` 用于业务层面的唯一标识

### 2. hosts 表（云主机）

```sql
CREATE TABLE IF NOT EXISTS hosts (
    -- 基础字段
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    tenant_id UUID NOT NULL,
    created_by UUID,
    updated_by UUID,

    -- 核心字段（15个）
    host_name TEXT NOT NULL,                 -- 主机名
    network_space_id UUID REFERENCES network_spaces(id) ON DELETE SET NULL,
    primary_ip INET NOT NULL,                -- 主IP地址
    ip_addresses INET[] DEFAULT '{}',        -- 所有IP地址列表

    -- 云平台相关（为云同步预留，手动导入时可为空）
    cloud_vendor TEXT,                       -- 云厂商：aws、tencent_cloud、aliyun、custom（自建）
    cloud_instance_id TEXT,                  -- 云实例ID（如：i-abc123）
    cloud_region TEXT,                       -- 云区域

    -- 硬件配置
    cpu INTEGER,                             -- CPU核数
    memory INTEGER,                          -- 内存（MB）
    disk_size INTEGER,                       -- 磁盘大小（GB）
    os_type TEXT,                            -- 操作系统类型：linux、windows
    os_version TEXT,                         -- 操作系统版本

    -- 状态和生命周期
    status TEXT NOT NULL DEFAULT 'running',  -- 状态：running、stopped、terminated
    is_destroyed BOOLEAN NOT NULL DEFAULT FALSE, -- 是否已销毁（标记删除）

    -- JSONB 扩展字段
    cloud_metadata JSONB,                    -- 云平台特有信息（云同步填充，手动导入可为空）
    custom_fields JSONB                      -- 业务自定义字段（如：部门、负责人、用途等）
);

-- 索引
CREATE INDEX idx_hosts_tenant_id ON hosts (tenant_id);
CREATE INDEX idx_hosts_network_space_id ON hosts (network_space_id);
CREATE INDEX idx_hosts_primary_ip ON hosts (primary_ip);
CREATE INDEX idx_hosts_host_name ON hosts (host_name);
CREATE INDEX idx_hosts_cloud_instance_id ON hosts (cloud_instance_id);
CREATE INDEX idx_hosts_status ON hosts (status);
CREATE INDEX idx_hosts_is_destroyed ON hosts (is_destroyed);

-- 唯一性约束（业务层面）
CREATE UNIQUE INDEX idx_hosts_network_ip
    ON hosts (network_space_id, primary_ip)
    WHERE deleted_at IS NULL AND is_destroyed = FALSE;

-- 云平台标识唯一性（为云同步预留）
CREATE UNIQUE INDEX idx_hosts_cloud_instance
    ON hosts (cloud_vendor, cloud_instance_id)
    WHERE deleted_at IS NULL AND cloud_vendor IS NOT NULL AND cloud_instance_id IS NOT NULL;

-- JSONB 索引
CREATE INDEX idx_hosts_cloud_metadata ON hosts USING GIN (cloud_metadata);
CREATE INDEX idx_hosts_custom_fields ON hosts USING GIN (custom_fields);
```

**设计说明**：
- 15个核心字段 + 2个JSONB扩展，比 BK-CMDB 简洁
- 三层唯一标识体系：
  1. 数据库主键：`id`
  2. 业务唯一：`(network_space_id, primary_ip)`
  3. 云平台标识：`(cloud_vendor, cloud_instance_id)` - 为云同步预留
- `cloud_vendor`、`cloud_instance_id`、`cloud_metadata` 为云同步预留，手动导入时可为空
- `custom_fields` 允许业务自定义字段（如：部门、负责人、用途、标签等）

---

## 🔧 Go 类型定义

### 1. NetworkSpace

```go
package types

import (
    "time"
    "github.com/google/uuid"
)

// NetworkSpace 网络空间（VPC抽象）
type NetworkSpace struct {
    ID            uuid.UUID              `json:"id" db:"id" gorm:"primaryKey;type:uuid"`
    CreatedAt     time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt     time.Time              `json:"updated_at" db:"updated_at"`
    DeletedAt     *time.Time             `json:"-" db:"deleted_at"`
    TenantID      uuid.UUID              `json:"tenant_id" db:"tenant_id"`

    Name          string                 `json:"name" db:"name"`
    Identifier    string                 `json:"identifier" db:"identifier"`
    CIDRBlock     *string                `json:"cidr_block" db:"cidr_block"`
    Region        *string                `json:"region" db:"region"`
    Type          string                 `json:"type" db:"type"` // vpc, subnet, custom
    Description   *string                `json:"description" db:"description"`

    CloudMetadata map[string]interface{} `json:"cloud_metadata,omitempty" db:"cloud_metadata" gorm:"type:jsonb"`
    CustomFields  map[string]interface{} `json:"custom_fields,omitempty" db:"custom_fields" gorm:"type:jsonb"`
}

// CreateNetworkSpaceRequest 创建网络空间请求
type CreateNetworkSpaceRequest struct {
    Name         string                 `json:"name" validate:"required"`
    Identifier   string                 `json:"identifier" validate:"required"`
    CIDRBlock    *string                `json:"cidr_block"`
    Region       *string                `json:"region"`
    Type         *string                `json:"type" validate:"omitempty,oneof=vpc subnet custom"`
    Description  *string                `json:"description"`
    CustomFields map[string]interface{} `json:"custom_fields"`
}
```

### 2. Host

```go
package types

import (
    "time"
    "net"
    "github.com/google/uuid"
)

const (
    HostStatusRunning    = "running"
    HostStatusStopped    = "stopped"
    HostStatusTerminated = "terminated"

    CloudVendorAWS         = "aws"
    CloudVendorTencentCloud = "tencent_cloud"
    CloudVendorAliyun      = "aliyun"
    CloudVendorCustom      = "custom" // 自建机房

    OSTypeLinux   = "linux"
    OSTypeWindows = "windows"
)

// Host 云主机
type Host struct {
    ID              uuid.UUID              `json:"id" db:"id" gorm:"primaryKey;type:uuid"`
    CreatedAt       time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt       time.Time              `json:"updated_at" db:"updated_at"`
    DeletedAt       *time.Time             `json:"-" db:"deleted_at"`
    TenantID        uuid.UUID              `json:"tenant_id" db:"tenant_id"`
    CreatedBy       *uuid.UUID             `json:"created_by" db:"created_by"`
    UpdatedBy       *uuid.UUID             `json:"updated_by" db:"updated_by"`

    // 核心字段
    HostName        string                 `json:"host_name" db:"host_name"`
    NetworkSpaceID  *uuid.UUID             `json:"network_space_id" db:"network_space_id"`
    PrimaryIP       string                 `json:"primary_ip" db:"primary_ip"` // INET type in DB
    IPAddresses     []string               `json:"ip_addresses" db:"ip_addresses" gorm:"type:inet[]"`

    // 云平台相关（可选，手动导入时可为空）
    CloudVendor     *string                `json:"cloud_vendor" db:"cloud_vendor"`
    CloudInstanceID *string                `json:"cloud_instance_id" db:"cloud_instance_id"`
    CloudRegion     *string                `json:"cloud_region" db:"cloud_region"`

    // 硬件配置
    CPU             *int                   `json:"cpu" db:"cpu"`
    Memory          *int                   `json:"memory" db:"memory"` // MB
    DiskSize        *int                   `json:"disk_size" db:"disk_size"` // GB
    OSType          *string                `json:"os_type" db:"os_type"`
    OSVersion       *string                `json:"os_version" db:"os_version"`

    // 状态
    Status          string                 `json:"status" db:"status"`
    IsDestroyed     bool                   `json:"is_destroyed" db:"is_destroyed"`

    // JSONB 扩展
    CloudMetadata   map[string]interface{} `json:"cloud_metadata,omitempty" db:"cloud_metadata" gorm:"type:jsonb"`
    CustomFields    map[string]interface{} `json:"custom_fields,omitempty" db:"custom_fields" gorm:"type:jsonb"`

    // 关联数据（transient，不存储到数据库）
    NetworkSpace    *NetworkSpace          `json:"network_space,omitempty" gorm:"-"`
}

// CreateHostRequest 创建主机请求
type CreateHostRequest struct {
    HostName        string                 `json:"host_name" validate:"required"`
    NetworkSpaceID  *uuid.UUID             `json:"network_space_id"`
    PrimaryIP       string                 `json:"primary_ip" validate:"required,ip"`
    IPAddresses     []string               `json:"ip_addresses"`

    CloudVendor     *string                `json:"cloud_vendor" validate:"omitempty,oneof=aws tencent_cloud aliyun custom"`
    CloudInstanceID *string                `json:"cloud_instance_id"`
    CloudRegion     *string                `json:"cloud_region"`

    CPU             *int                   `json:"cpu" validate:"omitempty,min=1"`
    Memory          *int                   `json:"memory" validate:"omitempty,min=1"`
    DiskSize        *int                   `json:"disk_size" validate:"omitempty,min=1"`
    OSType          *string                `json:"os_type" validate:"omitempty,oneof=linux windows"`
    OSVersion       *string                `json:"os_version"`

    Status          *string                `json:"status" validate:"omitempty,oneof=running stopped terminated"`
    CustomFields    map[string]interface{} `json:"custom_fields"`
}

// UpdateHostRequest 更新主机请求
type UpdateHostRequest struct {
    HostName       *string                `json:"host_name"`
    NetworkSpaceID *uuid.UUID             `json:"network_space_id"`
    PrimaryIP      *string                `json:"primary_ip" validate:"omitempty,ip"`
    IPAddresses    *[]string              `json:"ip_addresses"`

    CPU            *int                   `json:"cpu"`
    Memory         *int                   `json:"memory"`
    DiskSize       *int                   `json:"disk_size"`
    OSType         *string                `json:"os_type"`
    OSVersion      *string                `json:"os_version"`

    Status         *string                `json:"status" validate:"omitempty,oneof=running stopped terminated"`
    CustomFields   map[string]interface{} `json:"custom_fields"`
}

// BatchImportHostsRequest 批量导入主机请求
type BatchImportHostsRequest struct {
    Hosts            []CreateHostRequest `json:"hosts" validate:"required,dive"`
    SkipErrors       bool                `json:"skip_errors"`        // 是否跳过错误继续导入
    CreateNetworkSpace bool              `json:"create_network_space"` // 如果网络空间不存在是否自动创建
}

// BatchImportResult 批量导入结果
type BatchImportResult struct {
    Total      int                    `json:"total"`       // 总数
    Successful int                    `json:"successful"`  // 成功数
    Failed     int                    `json:"failed"`      // 失败数
    Errors     []ImportError          `json:"errors,omitempty"` // 错误详情
    CreatedIDs []uuid.UUID            `json:"created_ids"` // 成功创建的主机ID列表
}

// ImportError 导入错误
type ImportError struct {
    Index   int    `json:"index"`   // 第几条数据（从0开始）
    HostName string `json:"host_name"` // 主机名
    Error   string `json:"error"`   // 错误信息
}

// HostQueryParams 主机查询参数
type HostQueryParams struct {
    NetworkSpaceID  *uuid.UUID `form:"network_space_id"`
    CloudVendor     *string    `form:"cloud_vendor"`
    CloudInstanceID *string    `form:"cloud_instance_id"`
    Status          *string    `form:"status"`
    IncludeDestroyed bool      `form:"include_destroyed"` // 是否包含已销毁主机
    OSType          *string    `form:"os_type"`

    // 分页
    Page     int `form:"page" validate:"min=1"`
    PageSize int `form:"page_size" validate:"min=1,max=100"`
}
```

---

## 🚀 实施步骤

### Phase 1: 数据库迁移（Day 1）

**任务**：
- [x] 创建迁移文件 `20260126_create_hosts.up.sql`
- [x] 创建 `network_spaces` 表
- [x] 创建 `hosts` 表
- [x] 添加索引和约束

**验收**：
- ✓ 数据库表创建成功
- ✓ 唯一性约束正确
- ✓ JSONB 字段有 GIN 索引

### Phase 2: Go 类型定义（Day 1-2）

**任务**：
- [ ] 创建 `internal/types/host.go`
- [ ] 创建 `internal/types/network.go`
- [ ] 添加验证标签
- [ ] 编写单元测试

**验收**：
- ✓ 类型定义完整
- ✓ JSON 序列化/反序列化正确

### Phase 3: Repository 层（Day 2-3）

**任务**：
- [ ] `internal/storage/network_space_repository.go`
  - CreateNetworkSpace
  - GetNetworkSpace
  - ListNetworkSpaces
  - UpdateNetworkSpace
  - DeleteNetworkSpace

- [ ] `internal/storage/host_repository.go`
  - CreateHost
  - BatchCreateHosts（批量创建）
  - GetHost
  - ListHosts（支持复杂查询）
  - UpdateHost
  - MarkAsDestroyed（标记删除）

**验收**：
- ✓ CRUD 操作正常
- ✓ JSONB 查询正常
- ✓ 事务处理正确

### Phase 4: Service 层（Day 3-4）

**任务**：
- [ ] `internal/core/host/service.go`
  - CreateHost（包含数据校验）
  - BatchImportHosts（批量导入逻辑）
  - GetHost
  - ListHosts
  - UpdateHost
  - UpdateCustomFields（更新自定义字段）
  - DeleteHost（标记删除）

- [ ] `internal/core/network/service.go`
  - CreateNetworkSpace
  - GetNetworkSpace
  - ListNetworkSpaces

**核心逻辑**：
```go
// BatchImportHosts 批量导入主机
func (s *Service) BatchImportHosts(ctx context.Context, req *types.BatchImportHostsRequest) (*types.BatchImportResult, error) {
    result := &types.BatchImportResult{
        Total: len(req.Hosts),
        CreatedIDs: make([]uuid.UUID, 0),
        Errors: make([]types.ImportError, 0),
    }

    for i, hostReq := range req.Hosts {
        // 1. 校验数据
        if err := s.validateHost(&hostReq); err != nil {
            result.Failed++
            result.Errors = append(result.Errors, types.ImportError{
                Index: i,
                HostName: hostReq.HostName,
                Error: err.Error(),
            })
            if !req.SkipErrors {
                return result, err
            }
            continue
        }

        // 2. 检查网络空间是否存在
        if hostReq.NetworkSpaceID != nil {
            if _, err := s.networkRepo.GetNetworkSpace(ctx, *hostReq.NetworkSpaceID); err != nil {
                if req.CreateNetworkSpace {
                    // 自动创建网络空间（简化逻辑）
                } else {
                    result.Failed++
                    result.Errors = append(result.Errors, types.ImportError{
                        Index: i,
                        HostName: hostReq.HostName,
                        Error: "network_space not found",
                    })
                    if !req.SkipErrors {
                        return result, err
                    }
                    continue
                }
            }
        }

        // 3. 检查 IP 冲突
        if exists, _ := s.checkIPConflict(ctx, hostReq.NetworkSpaceID, hostReq.PrimaryIP); exists {
            result.Failed++
            result.Errors = append(result.Errors, types.ImportError{
                Index: i,
                HostName: hostReq.HostName,
                Error: "IP conflict in network_space",
            })
            if !req.SkipErrors {
                return result, err
            }
            continue
        }

        // 4. 创建主机
        host, err := s.repo.CreateHost(ctx, &hostReq)
        if err != nil {
            result.Failed++
            result.Errors = append(result.Errors, types.ImportError{
                Index: i,
                HostName: hostReq.HostName,
                Error: err.Error(),
            })
            if !req.SkipErrors {
                return result, err
            }
            continue
        }

        result.Successful++
        result.CreatedIDs = append(result.CreatedIDs, host.ID)
    }

    return result, nil
}
```

**验收**：
- ✓ 业务逻辑正确
- ✓ 数据校验完整
- ✓ 批量导入支持错误跳过
- ✓ 单元测试覆盖率 > 80%

### Phase 5: API Handler（Day 4-5）

**任务**：
- [ ] `internal/api/handlers/host_handler.go`
  ```go
  POST   /api/v1/hosts                    # 创建单个主机
  POST   /api/v1/hosts/batch              # 批量导入主机
  GET    /api/v1/hosts                    # 主机列表（支持过滤）
  GET    /api/v1/hosts/:id                # 主机详情
  PUT    /api/v1/hosts/:id                # 更新主机
  PUT    /api/v1/hosts/:id/custom-fields  # 更新自定义字段
  DELETE /api/v1/hosts/:id                # 删除主机（标记删除）
  ```

- [ ] `internal/api/handlers/network_space_handler.go`
  ```go
  POST   /api/v1/network-spaces           # 创建网络空间
  GET    /api/v1/network-spaces           # 网络空间列表
  GET    /api/v1/network-spaces/:id       # 网络空间详情
  GET    /api/v1/network-spaces/:id/hosts # 该空间下的主机
  ```

**API 示例**：

```bash
# 1. 创建网络空间
POST /api/v1/network-spaces
{
  "name": "生产VPC",
  "identifier": "prod-vpc",
  "cidr_block": "10.0.0.0/16",
  "region": "ap-guangzhou",
  "type": "vpc"
}

# 2. 批量导入主机
POST /api/v1/hosts/batch
{
  "hosts": [
    {
      "host_name": "web-server-01",
      "network_space_id": "uuid-xxx",
      "primary_ip": "10.0.1.10",
      "ip_addresses": ["10.0.1.10"],
      "cloud_vendor": "tencent_cloud",
      "cpu": 4,
      "memory": 8192,
      "os_type": "linux",
      "status": "running",
      "custom_fields": {
        "department": "技术部",
        "owner": "张三",
        "purpose": "Web服务器"
      }
    },
    {
      "host_name": "db-server-01",
      "network_space_id": "uuid-xxx",
      "primary_ip": "10.0.1.20",
      "cloud_vendor": "custom",
      "cpu": 8,
      "memory": 16384,
      "os_type": "linux",
      "custom_fields": {
        "department": "技术部",
        "owner": "李四",
        "purpose": "数据库服务器"
      }
    }
  ],
  "skip_errors": true,
  "create_network_space": false
}

# 响应
{
  "total": 2,
  "successful": 2,
  "failed": 0,
  "errors": [],
  "created_ids": ["uuid-1", "uuid-2"]
}

# 3. 查询主机列表
GET /api/v1/hosts?network_space_id=xxx&status=running&include_destroyed=false

# 4. 更新自定义字段
PUT /api/v1/hosts/:id/custom-fields
{
  "custom_fields": {
    "department": "运维部",
    "tags": ["production", "critical"]
  }
}
```

**验收**：
- ✓ API 接口正常
- ✓ 参数校验正确
- ✓ 错误处理完善
- ✓ Handler 测试覆盖率 > 80%

### Phase 6: Excel/CSV 导入支持（可选，Day 6）

**任务**：
- [ ] 支持 Excel 文件上传
- [ ] 解析 Excel/CSV 转换为 JSON
- [ ] 模板文件下载

**API**：
```go
POST   /api/v1/hosts/import/excel         # 上传Excel文件导入
GET    /api/v1/hosts/import/template      # 下载导入模板
```

**Excel 模板示例**：

| host_name | primary_ip | network_space_id | cloud_vendor | cpu | memory | os_type | status | custom_department | custom_owner |
|-----------|------------|------------------|--------------|-----|--------|---------|--------|-------------------|--------------|
| web-01    | 10.0.1.10  | uuid-xxx         | tencent_cloud| 4   | 8192   | linux   | running| 技术部            | 张三         |
| db-01     | 10.0.1.20  | uuid-xxx         | custom       | 8   | 16384  | linux   | running| 技术部            | 李四         |

**依赖库**：
```go
github.com/xuri/excelize/v2  // Excel 解析
```

---

## 📅 时间线

**总计：5-6 天**

```
Day 1:     数据库迁移 + Go类型定义
Day 2-3:   Repository层 + Service层
Day 4-5:   API Handler
Day 6:     Excel导入支持（可选）+ 集成测试
```

**关键里程碑**：

- **M1 (Day 1)**: 数据模型完成，数据库表创建成功
- **M2 (Day 3)**: Service 层完成，可以通过代码创建主机
- **M3 (Day 5)**: API 完成，可以通过 HTTP 批量导入主机
- **M4 (Day 6)**: Excel 导入支持，完整功能交付

---

## 🧪 测试计划

### 单元测试

- Repository 层测试（CRUD、JSONB 查询）
- Service 层测试（批量导入逻辑、数据校验）
- Handler 层测试（API 调用）

### 集成测试

```bash
# 1. 创建网络空间
# 2. 批量导入100台主机
# 3. 查询主机列表（各种过滤条件）
# 4. 更新自定义字段
# 5. 标记删除
# 6. 验证约束（IP冲突、网络空间不存在等）
```

### 性能测试

- 批量导入 1000 台主机的性能
- JSONB 查询性能
- 列表查询性能（带过滤）

---

## 📝 后续扩展计划

当前实现的批量导入功能已经为云同步功能预留了扩展性：

1. **云同步功能**（Phase 2）
   - 添加 `cloud_accounts` 表
   - 添加 `cloud_sync_tasks` 表
   - 实现云厂商适配器
   - 实现同步引擎
   - 复用现有的 `hosts` 和 `network_spaces` 表

2. **前端页面**（Phase 3）
   - 主机列表页面
   - 批量导入页面（上传Excel）
   - 主机详情页面

3. **高级功能**（Phase 4）
   - 主机变更历史
   - 配置审计
   - 主机关系拓扑
   - 监控集成

---

## ❓ 需要确认的问题

1. **导入格式优先级**
   - 优先支持 JSON API 批量导入？
   - 还是优先支持 Excel/CSV 文件导入？

2. **网络空间处理**
   - 是否需要自动创建网络空间？
   - 还是要求用户先创建网络空间再导入主机？

3. **自定义字段**
   - 是否有预定义的自定义字段列表（如：部门、负责人）？
   - 还是完全自由定义？

4. **数据校验**
   - IP 地址格式校验
   - 是否需要校验 CIDR 和 IP 的关系？
   - 导入时是否允许重复主机名？

---

## 📌 总结

**核心目标**：
- 实现云主机批量导入功能
- 简洁的数据模型（15个核心字段 + 2个JSONB扩展）
- 支持 JSON API 批量导入
- 可选支持 Excel/CSV 导入

**技术亮点**：
- JSONB 灵活扩展自定义字段
- 三层唯一标识体系（为云同步预留）
- 标记删除保留历史
- 智能查询和过滤

**预期时间**：
- 核心功能：5天
- 含 Excel 导入：6天

**下一步**：
- 确认需求细节
- 开始 Phase 1：创建数据库迁移文件 🚀
