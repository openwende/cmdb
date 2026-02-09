# 主机唯一标识方案分析

## BK-CMDB 的主机标识策略

### 一、核心问题：IP 冲突

**为什么内网IP会冲突？**

```
场景1：不同云区域（VPC）的IP可能相同
├─ AWS VPC-A: 10.0.1.10 (Web服务器)
└─ AWS VPC-B: 10.0.1.10 (DB服务器)  ❌ IP相同！

场景2：不同云厂商的IP可能相同
├─ 腾讯云: 172.16.1.100
└─ AWS:    172.16.1.100  ❌ IP相同！

场景3：混合云环境
├─ 公有云: 10.1.1.5
├─ 私有云: 10.1.1.5
└─ IDC机房: 10.1.1.5  ❌ 全部相同！
```

### 二、BK-CMDB 的三层标识体系

#### 层级 1️⃣：数据库主键（内部标识）

```sql
-- 主机表结构
CREATE TABLE cc_HostBase (
    bk_host_id BIGINT PRIMARY KEY AUTO_INCREMENT,  -- 数据库主键
    -- ... 其他字段
);
```

**特点**：
- ✅ 数据库自增ID，绝对唯一
- ✅ 系统内部使用
- ❌ 不面向用户
- ❌ 不具备业务语义

#### 层级 2️⃣：业务唯一标识（复合键）

```sql
-- 业务层唯一约束
CREATE UNIQUE INDEX idx_host_unique
ON cc_HostBase (bk_cloud_id, bk_host_innerip);
```

**组合方式**：`云区域ID (bk_cloud_id) + 内网IP (bk_host_innerip)`

**示例**：
```
主机A: (cloud_id=1, ip=10.0.1.10)  ✅ 唯一
主机B: (cloud_id=2, ip=10.0.1.10)  ✅ 唯一（不同云区域）
主机C: (cloud_id=1, ip=10.0.1.10)  ❌ 冲突！
```

**核心逻辑**：
```go
// 主机查询/创建时的唯一性检查
func GetHostByCloudAndIP(cloudID int64, innerIP string) (*Host, error) {
    return db.Where("bk_cloud_id = ? AND bk_host_innerip = ?",
                    cloudID, innerIP).First()
}

func CreateHost(host *Host) error {
    // 检查 (cloud_id, innerip) 组合是否已存在
    exists, err := db.Where(
        "bk_cloud_id = ? AND bk_host_innerip = ?",
        host.CloudID, host.InnerIP,
    ).Exists()

    if exists {
        return fmt.Errorf("host already exists in cloud area %d with IP %s",
                         host.CloudID, host.InnerIP)
    }

    return db.Create(host)
}
```

#### 层级 3️⃣：云平台标识（外部映射）

```sql
ALTER TABLE cc_HostBase
ADD COLUMN bk_cloud_inst_id VARCHAR(256);  -- 云实例ID

-- 云主机唯一索引
CREATE UNIQUE INDEX idx_cloud_instance
ON cc_HostBase (bk_cloud_vendor, bk_cloud_inst_id);
```

**云实例ID示例**：
```
AWS:        i-0abcd1234efgh5678
腾讯云:     ins-abc123def456
阿里云:     i-bp1234567890abcde
VMware:     vm-12345
物理机:     SN:ABC123XYZ  (序列号)
```

**云同步时的标识逻辑**：
```go
// 云资源同步时的主机匹配
func SyncCloudHost(cloudInstance *CloudInstance) error {
    // 优先使用云实例ID匹配
    host, err := db.Where(
        "bk_cloud_vendor = ? AND bk_cloud_inst_id = ?",
        cloudInstance.Vendor,
        cloudInstance.InstanceID,
    ).First()

    if err == NotFound {
        // 云实例ID不存在，使用 (cloud_id, innerip) 匹配
        host, err = db.Where(
            "bk_cloud_id = ? AND bk_host_innerip = ?",
            cloudInstance.CloudAreaID,
            cloudInstance.PrivateIP,
        ).First()
    }

    if err == NotFound {
        // 都不存在，创建新主机
        return CreateHost(cloudInstance)
    }

    // 存在则更新
    return UpdateHost(host, cloudInstance)
}
```

### 三、完整的唯一性保证机制

#### 数据库层面（多重约束）

```sql
CREATE TABLE cc_HostBase (
    -- 主键
    bk_host_id BIGINT PRIMARY KEY AUTO_INCREMENT,

    -- 云区域相关
    bk_cloud_id BIGINT NOT NULL DEFAULT 0,  -- 云区域ID，0表示"直连区域"
    bk_cloud_vendor VARCHAR(32),            -- aws/tencent_cloud/aliyun
    bk_cloud_inst_id VARCHAR(256),          -- 云实例ID

    -- 网络信息
    bk_host_innerip VARCHAR(256),
    bk_host_outerip VARCHAR(256),
    bk_host_name VARCHAR(256),

    -- 其他字段...
    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    -- 唯一性约束1：云区域 + 内网IP
    CONSTRAINT uk_cloud_ip UNIQUE (bk_cloud_id, bk_host_innerip),

    -- 唯一性约束2：云厂商 + 云实例ID
    CONSTRAINT uk_cloud_instance UNIQUE (bk_cloud_vendor, bk_cloud_inst_id)
);

-- 索引优化查询
CREATE INDEX idx_cloud_id ON cc_HostBase(bk_cloud_id);
CREATE INDEX idx_innerip ON cc_HostBase(bk_host_innerip);
CREATE INDEX idx_cloud_inst ON cc_HostBase(bk_cloud_inst_id);
```

#### 应用层面（业务逻辑）

```go
// 主机标识符结构
type HostIdentifier struct {
    // 方式1：云区域 + IP
    CloudID  int64  `json:"cloud_id"`
    InnerIP  string `json:"inner_ip"`

    // 方式2：云实例ID
    CloudVendor string `json:"cloud_vendor"`  // aws/tencent_cloud
    InstanceID  string `json:"instance_id"`   // i-xxxx

    // 方式3：数据库主键
    HostID int64 `json:"host_id"`
}

// 智能主机查找（按优先级尝试）
func FindHost(identifier *HostIdentifier) (*Host, error) {
    // 优先级1：数据库主键（最快）
    if identifier.HostID > 0 {
        return db.Find(identifier.HostID)
    }

    // 优先级2：云实例ID（云主机首选）
    if identifier.CloudVendor != "" && identifier.InstanceID != "" {
        host, err := db.Where(
            "bk_cloud_vendor = ? AND bk_cloud_inst_id = ?",
            identifier.CloudVendor,
            identifier.InstanceID,
        ).First()
        if err == nil {
            return host, nil
        }
    }

    // 优先级3：云区域 + IP（传统方式）
    if identifier.CloudID >= 0 && identifier.InnerIP != "" {
        return db.Where(
            "bk_cloud_id = ? AND bk_host_innerip = ?",
            identifier.CloudID,
            identifier.InnerIP,
        ).First()
    }

    return nil, errors.New("invalid host identifier")
}
```

### 四、云区域（Cloud Area）概念

**云区域是什么？**

```
云区域（bk_cloud_id）是一个逻辑隔离单元：
├─ 0: 直连区域（默认，直接管理的物理机）
├─ 1: AWS US-East-1 VPC-A
├─ 2: AWS US-West-2 VPC-B
├─ 3: 腾讯云广州一区 VPC-A
├─ 4: 阿里云杭州 VPC-C
└─ 5: 私有云IDC机房
```

**云区域表结构**：
```sql
CREATE TABLE cc_CloudArea (
    bk_cloud_id BIGINT PRIMARY KEY AUTO_INCREMENT,
    bk_cloud_name VARCHAR(256) NOT NULL,
    bk_cloud_vendor VARCHAR(32),  -- aws/tencent_cloud/aliyun/private
    bk_vpc_id VARCHAR(256),       -- 云平台VPC ID
    bk_region VARCHAR(64),        -- us-east-1/ap-guangzhou
    status VARCHAR(32),           -- active/inactive
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 五、IP 冲突的实际处理场景

#### 场景1：新建主机时IP冲突

```go
// API: 创建主机
POST /api/v1/hosts
{
    "cloud_id": 1,
    "inner_ip": "10.0.1.10",
    "host_name": "web-server-01"
}

// 后端处理
func CreateHost(req *CreateHostRequest) error {
    // 检查 (cloud_id, inner_ip) 是否已存在
    exists, err := hostRepo.ExistsByCloudAndIP(req.CloudID, req.InnerIP)
    if err != nil {
        return err
    }

    if exists {
        return &ConflictError{
            Message: fmt.Sprintf(
                "主机已存在：云区域 %d 下的 IP %s 已被占用",
                req.CloudID,
                req.InnerIP,
            ),
            ConflictingHost: existingHost,
        }
    }

    // 创建主机
    return hostRepo.Create(&Host{
        CloudID: req.CloudID,
        InnerIP: req.InnerIP,
        // ...
    })
}
```

**错误响应示例**：
```json
{
    "error": "Conflict",
    "message": "主机已存在：云区域 1 下的 IP 10.0.1.10 已被占用",
    "details": {
        "conflicting_host": {
            "host_id": 12345,
            "host_name": "existing-server",
            "cloud_id": 1,
            "inner_ip": "10.0.1.10"
        }
    },
    "suggestion": "请检查云区域设置，或使用不同的IP地址"
}
```

#### 场景2：云同步时的IP冲突处理

```go
// 云同步场景
func SyncCloudInstances(instances []*CloudInstance) error {
    for _, inst := range instances {
        // 1. 先用云实例ID查找
        host, err := hostRepo.FindByCloudInstance(
            inst.Vendor,
            inst.InstanceID,
        )

        if err == nil {
            // 找到了，更新信息
            host.InnerIP = inst.PrivateIP
            host.OuterIP = inst.PublicIP
            host.Status = inst.Status
            hostRepo.Update(host)
            continue
        }

        // 2. 云实例ID找不到，用 (cloud_id, ip) 查找
        host, err = hostRepo.FindByCloudAndIP(
            inst.CloudAreaID,
            inst.PrivateIP,
        )

        if err == nil {
            // 找到了旧记录，补充云实例ID
            host.CloudVendor = inst.Vendor
            host.CloudInstanceID = inst.InstanceID
            host.Status = inst.Status
            hostRepo.Update(host)

            log.Info("关联云实例: host_id=%d, instance_id=%s",
                    host.ID, inst.InstanceID)
            continue
        }

        // 3. 都找不到，创建新主机
        newHost := &Host{
            CloudID:         inst.CloudAreaID,
            CloudVendor:     inst.Vendor,
            CloudInstanceID: inst.InstanceID,
            InnerIP:         inst.PrivateIP,
            OuterIP:         inst.PublicIP,
            HostName:        inst.Name,
            Status:          inst.Status,
        }
        hostRepo.Create(newHost)
    }
}
```

#### 场景3：多IP主机的处理

```go
// 主机可能有多个内网IP
type Host struct {
    ID              int64
    CloudID         int64
    PrimaryInnerIP  string    // 主内网IP（唯一性约束使用）
    InnerIPs        []string  // 所有内网IP（JSON数组）
    OuterIPs        []string  // 所有外网IP
}

// 查询时按主IP匹配
func FindByIP(cloudID int64, ip string) (*Host, error) {
    // 1. 先查主IP
    host, err := db.Where(
        "bk_cloud_id = ? AND primary_inner_ip = ?",
        cloudID, ip,
    ).First()

    if err == nil {
        return host, nil
    }

    // 2. 再查所有IP（JSONB查询）
    return db.Where(
        "bk_cloud_id = ? AND inner_ips @> ?",
        cloudID,
        fmt.Sprintf(`["%s"]`, ip),
    ).First()
}
```

### 六、最佳实践建议

#### 对于我们的项目

**推荐方案：三级标识体系**

```go
// 主机数据结构
type Host struct {
    // 第一级：数据库主键
    ID uuid.UUID `gorm:"type:uuid;primary_key" json:"id"`

    // 第二级：业务唯一标识
    CloudAreaID uuid.UUID `gorm:"type:uuid;not null;index:idx_cloud_ip" json:"cloud_area_id"`
    InnerIP     string    `gorm:"type:varchar(256);not null;index:idx_cloud_ip" json:"inner_ip"`

    // 第三级：云平台标识
    CloudVendor     string `gorm:"type:varchar(32);index:idx_cloud_inst" json:"cloud_vendor"`
    CloudInstanceID string `gorm:"type:varchar(256);index:idx_cloud_inst" json:"cloud_instance_id"`

    // 其他字段
    HostName string   `json:"host_name"`
    OuterIP  string   `json:"outer_ip"`
    Status   string   `json:"status"`

    // 多IP支持（可选）
    InnerIPs []string `gorm:"type:jsonb" json:"inner_ips"`
    OuterIPs []string `gorm:"type:jsonb" json:"outer_ips"`

    TenantID  uuid.UUID  `json:"tenant_id"`
    CreatedAt time.Time  `json:"created_at"`
    UpdatedAt time.Time  `json:"updated_at"`
    DeletedAt *time.Time `gorm:"index" json:"deleted_at,omitempty"`
}

// 数据库约束
func (Host) TableName() string {
    return "hosts"
}

// Gorm 迁移时添加约束
db.AutoMigrate(&Host{})
db.Exec(`
    ALTER TABLE hosts
    ADD CONSTRAINT uk_cloud_ip
    UNIQUE (cloud_area_id, inner_ip);

    ALTER TABLE hosts
    ADD CONSTRAINT uk_cloud_instance
    UNIQUE (cloud_vendor, cloud_instance_id)
    WHERE cloud_instance_id IS NOT NULL AND cloud_instance_id != '';
`)
```

**云区域表设计**：

```go
type CloudArea struct {
    ID          uuid.UUID  `gorm:"type:uuid;primary_key" json:"id"`
    Name        string     `gorm:"type:varchar(256);not null" json:"name"`
    CloudVendor string     `gorm:"type:varchar(32)" json:"cloud_vendor"` // aws/tencent/aliyun/private
    VpcID       string     `gorm:"type:varchar(256)" json:"vpc_id"`
    Region      string     `gorm:"type:varchar(64)" json:"region"`
    Status      string     `gorm:"type:varchar(32)" json:"status"`

    TenantID    uuid.UUID  `json:"tenant_id"`
    CreatedAt   time.Time  `json:"created_at"`
    UpdatedAt   time.Time  `json:"updated_at"`
}
```

### 七、API 设计示例

```bash
# 1. 创建云区域
POST /api/v1/cloud-areas
{
    "name": "AWS US-East VPC-A",
    "cloud_vendor": "aws",
    "vpc_id": "vpc-abc123",
    "region": "us-east-1"
}

# 响应
{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "AWS US-East VPC-A",
    "cloud_vendor": "aws",
    "vpc_id": "vpc-abc123",
    "region": "us-east-1"
}

# 2. 创建主机（手动添加）
POST /api/v1/hosts
{
    "cloud_area_id": "550e8400-e29b-41d4-a716-446655440000",
    "inner_ip": "10.0.1.10",
    "host_name": "web-server-01"
}

# 3. 云同步创建主机（自动）
POST /api/v1/cloud-sync/execute
{
    "account_id": "xxx",
    "region": "us-east-1"
}
# 自动创建主机并填充 cloud_instance_id

# 4. 查询主机（多种方式）
# 4.1 按ID查询
GET /api/v1/hosts/550e8400-e29b-41d4-a716-446655440000

# 4.2 按云区域+IP查询
GET /api/v1/hosts?cloud_area_id=xxx&inner_ip=10.0.1.10

# 4.3 按云实例ID查询
GET /api/v1/hosts?cloud_vendor=aws&cloud_instance_id=i-abc123

# 4.4 列出云区域下所有主机
GET /api/v1/hosts?cloud_area_id=xxx
```

### 八、总结

**BK-CMDB 的主机标识策略**：

| 标识方式 | 组成 | 用途 | 优先级 |
|---------|------|------|--------|
| 数据库主键 | `bk_host_id` | 内部系统使用 | ⭐⭐⭐ |
| 云实例ID | `(cloud_vendor, cloud_inst_id)` | 云主机同步 | ⭐⭐⭐ |
| 云区域+IP | `(bk_cloud_id, bk_host_innerip)` | 业务唯一标识 | ⭐⭐ |

**IP冲突的解决方案**：
1. ✅ **云区域隔离** - 不同云区域可以有相同IP
2. ✅ **云实例ID优先** - 云主机优先使用云平台ID
3. ✅ **复合键约束** - `(cloud_area_id, inner_ip)` 保证唯一
4. ✅ **智能匹配** - 同步时按优先级尝试多种标识方式

**关键设计原则**：
- 🎯 **单一主键** - 数据库层面用UUID/自增ID
- 🎯 **多重标识** - 业务层面支持多种标识方式
- 🎯 **逻辑隔离** - 通过云区域隔离不同网络空间
- 🎯 **外部映射** - 保存云平台原生ID便于同步
