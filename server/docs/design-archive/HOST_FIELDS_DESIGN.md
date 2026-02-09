# 主机字段设计：核心字段 vs 扩展字段

## 一、BK-CMDB 的字段分析与精简

### 1.1 BK-CMDB 的 30+ 字段分类

#### 分类1：核心标识字段（必须）⭐⭐⭐⭐⭐

```go
// 这些字段是最基础的，必须有
type HostCore struct {
    ID           uuid.UUID  // 主机ID（数据库主键）
    HostName     string     // 主机名
    InnerIP      string     // 内网IP（或IP列表）
}
```

**用途**：唯一标识主机，云同步必填

#### 分类2：云平台标识（云主机必须）⭐⭐⭐⭐

```go
type HostCloudIdentity struct {
    CloudVendor     string  // aws/tencent/aliyun
    CloudInstanceID string  // i-abc123
    CloudRegion     string  // us-east-1
}
```

**用途**：云同步关键字段，用于匹配和更新

#### 分类3：网络信息（重要）⭐⭐⭐⭐

```go
type HostNetwork struct {
    InnerIP      string   // 内网IP
    OuterIP      string   // 外网IP
    InnerIPv6    string   // IPv6（可选）
    OuterIPv6    string   // IPv6（可选）
}
```

**用途**：网络管理，云同步会填充

#### 分类4：硬件信息（云同步填充）⭐⭐⭐

```go
type HostHardware struct {
    CPU          int     // CPU核心数
    Memory       int     // 内存(MB)
    Disk         int     // 磁盘(GB)
    CPUArch      string  // x86_64/arm64
}
```

**用途**：资源统计，云同步可获取

#### 分类5：操作系统（云同步填充）⭐⭐⭐

```go
type HostOS struct {
    OSType       string  // Linux/Windows
    OSName       string  // Ubuntu/CentOS
    OSVersion    string  // 20.04/7.9
}
```

**用途**：系统管理，云同步可获取

#### 分类6：运维信息（手动维护，可选）⭐⭐

```go
type HostOperations struct {
    Operator     string   // 运维负责人
    BakOperator  string   // 备份负责人
    Comment      string   // 备注
}
```

**用途**：运维管理，手动填写，**可以精简或变为扩展字段**

#### 分类7：资产信息（物理机用，可选）⭐

```go
type HostAsset struct {
    AssetID      string   // 资产编号
    SerialNumber string   // 序列号
    Province     string   // 省份
    ISP          string   // 运营商
}
```

**用途**：资产管理，**云主机不需要，可以精简**

### 1.2 字段精简建议

**必须保留（15个左右）**：
```
✅ 核心标识 (3个)
   - id, host_name, primary_ip

✅ 云平台标识 (3个)
   - cloud_vendor, cloud_instance_id, cloud_region

✅ 网络信息 (2个)
   - inner_ips, outer_ips (JSONB数组)

✅ 硬件信息 (3个)
   - cpu, memory, os_type

✅ 状态管理 (3个)
   - status, is_destroyed, destroyed_at

✅ 元数据 (3个)
   - tenant_id, created_at, updated_at
```

**可选/扩展字段（根据需要添加）**：
```
⚠️ 转为扩展字段
   - operator, bak_operator, comment
   - asset_id, serial_number
   - province, isp
   - disk, cpu_arch, os_version
   - ... 等等
```

---

## 二、推荐方案：核心字段 + 动态扩展

### 2.1 设计思路

```
┌─────────────────────────────────────────┐
│         主机模型设计                      │
├─────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────┐         │
│  │   核心字段（固定表）         │         │
│  │  - 标准化字段                │         │
│  │  - 云同步必填                │         │
│  │  - 查询性能高                │         │
│  └────────────────────────────┘         │
│              ↓                           │
│  ┌────────────────────────────┐         │
│  │  扩展字段（JSONB/动态模型）  │         │
│  │  - 业务自定义                │         │
│  │  - 灵活扩展                  │         │
│  │  - 不影响云同步              │         │
│  └────────────────────────────┘         │
│                                          │
└─────────────────────────────────────────┘
```

### 2.2 数据库设计（推荐方案）

```sql
-- 主机表（核心字段，精简版）
CREATE TABLE hosts (
    -- === 核心标识 ===
    id UUID PRIMARY KEY,
    host_name VARCHAR(256),

    -- === 云平台标识（云同步关键） ===
    cloud_vendor VARCHAR(32),      -- aws/tencent/aliyun/private
    cloud_instance_id VARCHAR(256),
    cloud_region VARCHAR(64),      -- us-east-1

    -- === 网络归属 ===
    network_space_id UUID REFERENCES network_spaces(id),

    -- === 网络信息（JSONB，支持多IP） ===
    primary_ip VARCHAR(64),        -- 主IP（用于唯一性约束）
    ip_addresses JSONB,            -- 所有IP
    /*
    [
        {
            "ip": "10.0.1.10",
            "type": "private",
            "interface": "eth0",
            "is_primary": true
        },
        {
            "ip": "52.1.2.3",
            "type": "public"
        }
    ]
    */

    -- === 硬件信息（云同步填充） ===
    cpu INT,                       -- CPU核心数
    memory INT,                    -- 内存(MB)
    os_type VARCHAR(32),           -- Linux/Windows

    -- === 状态管理 ===
    status VARCHAR(32),            -- running/stopped/terminated
    is_destroyed BOOLEAN DEFAULT false,
    destroyed_at TIMESTAMP,

    -- === 云平台元数据（JSONB，灵活存储云平台特有信息） ===
    cloud_metadata JSONB,
    /*
    AWS: {
        "instance_type": "t3.medium",
        "availability_zone": "us-east-1a",
        "vpc_id": "vpc-abc123",
        "subnet_id": "subnet-xyz",
        "ami_id": "ami-12345",
        "launch_time": "2026-01-01T00:00:00Z"
    }

    腾讯云: {
        "instance_type": "S5.MEDIUM4",
        "zone": "ap-guangzhou-3",
        "vpc_id": "vpc-tencent",
        "subnet_id": "subnet-tencent",
        "image_id": "img-xxx"
    }
    */

    -- === 扩展字段（业务自定义，JSONB） ===
    custom_fields JSONB,
    /*
    {
        "operator": "张三",
        "bak_operator": "李四",
        "asset_id": "ASSET-001",
        "department": "技术部",
        "project": "电商平台",
        "environment": "production",
        "backup_policy": "daily",
        "monitoring_enabled": true,
        ... 业务需要的任意字段
    }
    */

    -- === 元数据 ===
    tenant_id UUID,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,          -- 软删除

    -- === 唯一性约束 ===
    CONSTRAINT uk_network_ip UNIQUE (network_space_id, primary_ip),
    CONSTRAINT uk_cloud_instance UNIQUE (cloud_vendor, cloud_instance_id)
        WHERE cloud_instance_id IS NOT NULL
);

-- 索引
CREATE INDEX idx_host_cloud ON hosts(cloud_vendor, cloud_instance_id);
CREATE INDEX idx_host_network ON hosts(network_space_id, primary_ip);
CREATE INDEX idx_host_status ON hosts(status, is_destroyed);
CREATE INDEX idx_custom_fields ON hosts USING GIN (custom_fields);
```

### 2.3 Go 数据结构

```go
// Host 主机模型
type Host struct {
    // === 核心标识 ===
    ID       uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`
    HostName string    `gorm:"type:varchar(256)" json:"host_name"`

    // === 云平台标识 ===
    CloudVendor     string `gorm:"type:varchar(32)" json:"cloud_vendor"`
    CloudInstanceID string `gorm:"type:varchar(256)" json:"cloud_instance_id"`
    CloudRegion     string `gorm:"type:varchar(64)" json:"cloud_region"`

    // === 网络归属 ===
    NetworkSpaceID uuid.UUID `gorm:"type:uuid" json:"network_space_id"`

    // === 网络信息 ===
    PrimaryIP   string        `gorm:"type:varchar(64)" json:"primary_ip"`
    IPAddresses []IPAddress   `gorm:"type:jsonb" json:"ip_addresses"`

    // === 硬件信息 ===
    CPU    int    `json:"cpu"`
    Memory int    `json:"memory"`
    OSType string `gorm:"type:varchar(32)" json:"os_type"`

    // === 状态管理 ===
    Status      string     `gorm:"type:varchar(32)" json:"status"`
    IsDestroyed bool       `gorm:"default:false" json:"is_destroyed"`
    DestroyedAt *time.Time `json:"destroyed_at,omitempty"`

    // === 云平台元数据 ===
    CloudMetadata map[string]interface{} `gorm:"type:jsonb" json:"cloud_metadata"`

    // === 扩展字段 ===
    CustomFields map[string]interface{} `gorm:"type:jsonb" json:"custom_fields"`

    // === 元数据 ===
    TenantID  uuid.UUID  `gorm:"type:uuid" json:"tenant_id"`
    CreatedAt time.Time  `json:"created_at"`
    UpdatedAt time.Time  `json:"updated_at"`
    DeletedAt *time.Time `gorm:"index" json:"deleted_at,omitempty"`
}

// IPAddress IP地址结构
type IPAddress struct {
    IP        string `json:"ip"`
    Type      string `json:"type"`       // private/public/elastic
    Interface string `json:"interface"`  // eth0/eth1
    IsPrimary bool   `json:"is_primary"`
}
```

---

## 三、云同步时的字段映射

### 3.1 云同步填充的字段

```go
// 云同步服务
type CloudSyncService struct {
    hostRepo HostRepository
}

// 从云实例创建/更新主机
func (s *CloudSyncService) SyncCloudInstance(
    cloudInst *cloudvendor.Instance,
    networkSpace *NetworkSpace,
) error {

    // 1. 尝试查找已存在的主机
    host, err := s.hostRepo.FindByCloudInstance(
        cloudInst.CloudVendor,
        cloudInst.InstanceID,
    )

    if err == NotFound {
        // 2. 不存在，创建新主机
        host = &Host{
            ID: uuid.New(),

            // === 云同步填充：核心标识 ===
            HostName: cloudInst.Name,

            // === 云同步填充：云平台标识 ===
            CloudVendor:     cloudInst.CloudVendor,
            CloudInstanceID: cloudInst.InstanceID,
            CloudRegion:     cloudInst.Region,

            // === 云同步填充：网络归属 ===
            NetworkSpaceID: networkSpace.ID,

            // === 云同步填充：网络信息 ===
            PrimaryIP: cloudInst.PrivateIPs[0],  // 主IP
            IPAddresses: []IPAddress{
                {
                    IP:        cloudInst.PrivateIPs[0],
                    Type:      "private",
                    IsPrimary: true,
                },
            },

            // === 云同步填充：硬件信息 ===
            CPU:    cloudInst.CPU,
            Memory: cloudInst.Memory,
            OSType: cloudInst.OSType,

            // === 云同步填充：状态 ===
            Status:      cloudInst.State,
            IsDestroyed: false,

            // === 云同步填充：云平台元数据 ===
            CloudMetadata: map[string]interface{}{
                "instance_type":     cloudInst.InstanceType,
                "availability_zone": cloudInst.AvailabilityZone,
                "vpc_id":            cloudInst.VpcID,
                "subnet_id":         cloudInst.SubnetID,
                "image_id":          cloudInst.ImageID,
                "launch_time":       cloudInst.LaunchTime,
            },

            // === 扩展字段：保留为空，业务自己填充 ===
            CustomFields: map[string]interface{}{},

            TenantID: networkSpace.TenantID,
        }

        // 添加公网IP
        if len(cloudInst.PublicIPs) > 0 {
            host.IPAddresses = append(host.IPAddresses, IPAddress{
                IP:   cloudInst.PublicIPs[0],
                Type: "public",
            })
        }

        return s.hostRepo.Create(host)
    }

    // 3. 已存在，更新云同步字段
    host.HostName = cloudInst.Name  // 可能改名
    host.CPU = cloudInst.CPU        // 可能升配
    host.Memory = cloudInst.Memory
    host.Status = cloudInst.State   // 状态变化

    // 更新IP（云上可能变化）
    host.PrimaryIP = cloudInst.PrivateIPs[0]
    host.IPAddresses = buildIPAddresses(cloudInst)

    // 更新云元数据
    host.CloudMetadata["instance_type"] = cloudInst.InstanceType
    host.CloudMetadata["availability_zone"] = cloudInst.AvailabilityZone

    // === 重要：不覆盖 CustomFields！===
    // CustomFields 是业务自定义的，云同步不应该覆盖

    return s.hostRepo.Update(host)
}
```

### 3.2 字段职责划分

| 字段类型 | 填充方式 | 云同步行为 | 业务使用 |
|----------|----------|------------|----------|
| **核心标识** | 云同步填充 | 创建时填充，更新时可能变 | 只读 |
| **云平台标识** | 云同步填充 | 创建时填充，不变 | 只读 |
| **网络信息** | 云同步填充 | 创建/更新都填充 | 只读 |
| **硬件信息** | 云同步填充 | 创建/更新都填充 | 只读 |
| **状态** | 云同步填充 | 实时更新 | 只读 |
| **cloud_metadata** | 云同步填充 | 实时更新 | 只读 |
| **custom_fields** | **业务填充** | **不覆盖** | 可读可写 |

---

## 四、业务自定义字段的使用

### 4.1 添加自定义字段

```bash
# API: 更新主机的自定义字段
PUT /api/v1/hosts/{id}/custom-fields
{
    "operator": "张三",
    "bak_operator": "李四",
    "department": "技术部",
    "project": "电商平台",
    "environment": "production",
    "backup_policy": "daily",
    "cost_center": "CC-001",
    "monitoring_enabled": true
}

# 响应
{
    "id": "host-123",
    "host_name": "web-server-01",
    "primary_ip": "10.0.1.10",
    "cpu": 4,
    "memory": 8192,

    // 云同步字段
    "cloud_vendor": "aws",
    "cloud_instance_id": "i-abc123",

    // 业务自定义字段
    "custom_fields": {
        "operator": "张三",
        "bak_operator": "李四",
        "department": "技术部",
        "project": "电商平台"
    }
}
```

### 4.2 按自定义字段查询

```bash
# PostgreSQL JSONB查询
GET /api/v1/hosts?custom_fields.department=技术部

# SQL
SELECT * FROM hosts
WHERE custom_fields->>'department' = '技术部';

# 复杂查询
GET /api/v1/hosts?custom_fields.environment=production&custom_fields.monitoring_enabled=true

# SQL
SELECT * FROM hosts
WHERE custom_fields->>'environment' = 'production'
  AND (custom_fields->>'monitoring_enabled')::boolean = true;
```

### 4.3 Go 代码示例

```go
// 更新自定义字段
func (s *HostService) UpdateCustomFields(
    hostID uuid.UUID,
    fields map[string]interface{},
) error {

    host, err := s.hostRepo.GetByID(hostID)
    if err != nil {
        return err
    }

    // 初始化 CustomFields（如果为空）
    if host.CustomFields == nil {
        host.CustomFields = make(map[string]interface{})
    }

    // 合并更新
    for key, value := range fields {
        host.CustomFields[key] = value
    }

    host.UpdatedAt = time.Now()
    return s.hostRepo.Update(host)
}

// 按自定义字段查询
func (s *HostService) FindByCustomField(
    key string,
    value interface{},
) ([]*Host, error) {

    var hosts []*Host
    err := s.db.Where(
        "custom_fields->>? = ?",
        key,
        value,
    ).Find(&hosts).Error

    return hosts, err
}
```

---

## 五、方案对比

### 5.1 方案A：全部固定字段（BK-CMDB方式）

```sql
CREATE TABLE hosts (
    id UUID,
    host_name VARCHAR,
    inner_ip VARCHAR,
    outer_ip VARCHAR,
    cpu INT,
    memory INT,
    os_type VARCHAR,
    os_name VARCHAR,
    os_version VARCHAR,
    os_bit VARCHAR,
    cpu_module VARCHAR,
    cpu_arch VARCHAR,
    disk INT,
    operator VARCHAR,       -- 固定字段
    bak_operator VARCHAR,   -- 固定字段
    comment TEXT,           -- 固定字段
    asset_id VARCHAR,       -- 固定字段
    serial_number VARCHAR,  -- 固定字段
    province VARCHAR,       -- 固定字段
    isp VARCHAR,            -- 固定字段
    ... 30+ 字段
);
```

**优点**：
- ✅ 查询性能好（有索引）
- ✅ 类型安全
- ✅ 结构清晰

**缺点**：
- ❌ 字段太多，大部分用不上
- ❌ 扩展性差，新增字段要改表
- ❌ 不同业务需求不同，无法满足所有场景

### 5.2 方案B：核心字段 + JSONB扩展（推荐）

```sql
CREATE TABLE hosts (
    id UUID,
    host_name VARCHAR,
    primary_ip VARCHAR,
    cpu INT,
    memory INT,
    os_type VARCHAR,

    cloud_metadata JSONB,   -- 云平台特有信息
    custom_fields JSONB,    -- 业务自定义字段

    ... 15个核心字段
);
```

**优点**：
- ✅ 核心字段固定，查询性能好
- ✅ 扩展字段灵活，无需改表
- ✅ 云同步和业务自定义分离
- ✅ 不同业务可以有不同的自定义字段

**缺点**：
- ⚠️ JSONB查询性能略低于固定字段
- ⚠️ 需要建GIN索引优化JSONB查询

### 5.3 方案C：完全动态模型

```
利用现有的动态模型引擎：
1. 创建 host 模型
2. 添加标准属性（30+个）
3. 业务需要时再添加自定义属性
```

**优点**：
- ✅ 最灵活，任意扩展
- ✅ 复用现有动态模型系统
- ✅ 支持复杂的属性类型

**缺点**：
- ⚠️ 查询性能可能不如专用表
- ⚠️ 云同步时字段映射复杂
- ⚠️ 主机数量大时性能问题

---

## 六、最终推荐方案

### 6.1 混合方案：专用表 + JSONB扩展

**结合优点，避免缺点**

```sql
-- 主机表（15个核心字段 + 2个JSONB）
CREATE TABLE hosts (
    -- 核心字段（固定，云同步填充）
    id UUID PRIMARY KEY,
    host_name VARCHAR(256),
    cloud_vendor VARCHAR(32),
    cloud_instance_id VARCHAR(256),
    cloud_region VARCHAR(64),
    network_space_id UUID,
    primary_ip VARCHAR(64),
    ip_addresses JSONB,           -- IP列表
    cpu INT,
    memory INT,
    os_type VARCHAR(32),
    status VARCHAR(32),
    is_destroyed BOOLEAN,

    -- 云平台元数据（JSONB，云同步填充）
    cloud_metadata JSONB,

    -- 业务自定义字段（JSONB，业务填充）
    custom_fields JSONB,

    -- 元数据
    tenant_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    deleted_at TIMESTAMP
);

-- JSONB索引（优化查询性能）
CREATE INDEX idx_cloud_metadata ON hosts USING GIN (cloud_metadata);
CREATE INDEX idx_custom_fields ON hosts USING GIN (custom_fields);
```

### 6.2 字段设计原则

**核心字段（固定表列）**：
1. ✅ 云同步必填字段
2. ✅ 高频查询字段
3. ✅ 需要索引优化的字段
4. ✅ 需要唯一性约束的字段

**JSONB字段**：
1. ✅ 云平台特有信息 → `cloud_metadata`
2. ✅ 业务自定义字段 → `custom_fields`
3. ✅ 低频查询字段
4. ✅ 可选字段

### 6.3 云同步流程

```go
// 云同步时
host := &Host{
    // 核心字段（固定，云同步填充）
    HostName:        cloudInst.Name,
    CloudVendor:     "aws",
    CloudInstanceID: cloudInst.InstanceID,
    PrimaryIP:       cloudInst.PrivateIP,
    CPU:             cloudInst.CPU,
    Memory:          cloudInst.Memory,

    // 云元数据（JSONB，云同步填充）
    CloudMetadata: map[string]interface{}{
        "instance_type": cloudInst.InstanceType,
        "vpc_id":        cloudInst.VpcID,
        // ... AWS特有字段
    },

    // 业务自定义（JSONB，保持不变）
    CustomFields: existingHost.CustomFields,  // 不覆盖！
}
```

---

## 七、总结

### 你的观点完全正确！

1. ✅ **BK-CMDB的30+字段确实可以精简**
   - 核心字段：15个左右就够
   - 其余字段：转为JSONB扩展

2. ✅ **业务需要时再自定义**
   - 使用 `custom_fields` JSONB
   - 无需改表结构
   - 灵活扩展

3. ✅ **字段设计要考虑云同步**
   - 核心字段：云同步填充
   - cloud_metadata：云平台特有信息
   - custom_fields：业务自己维护，云同步不覆盖

### 最佳实践

**核心字段（15个）**：
```
id, host_name, cloud_vendor, cloud_instance_id, cloud_region,
network_space_id, primary_ip, ip_addresses, cpu, memory, os_type,
status, is_destroyed, tenant_id, created_at
```

**JSONB扩展字段（2个）**：
```
cloud_metadata  - 云平台元数据（云同步填充）
custom_fields   - 业务自定义字段（业务维护）
```

**职责分离**：
- 云同步：只填充核心字段和cloud_metadata
- 业务使用：可读所有字段，可写custom_fields
- 互不干扰，完美配合！🎯
