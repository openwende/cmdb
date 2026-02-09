# BK-CMDB IP冲突解决方案评价与优化建议

## 一、BK-CMDB 方案评价

### 1.1 当前方案回顾

```sql
-- BK-CMDB 的核心设计
CREATE TABLE hosts (
    bk_host_id BIGINT PRIMARY KEY,
    bk_cloud_id BIGINT NOT NULL,           -- 云区域ID
    bk_host_innerip VARCHAR(256) NOT NULL, -- 内网IP
    bk_cloud_inst_id VARCHAR(256),         -- 云实例ID

    -- 唯一性约束
    CONSTRAINT uk_cloud_ip UNIQUE (bk_cloud_id, bk_host_innerip)
);
```

### 1.2 优点分析 ✅

#### ✅ 1. 简单直观
```
优点：
- 概念清晰：云区域 + IP
- 易于理解和实现
- 学习成本低
- 符合运维人员的思维习惯
```

#### ✅ 2. 解决了基本问题
```
场景覆盖：
- ✓ 不同VPC的IP隔离
- ✓ 不同云厂商的IP隔离
- ✓ 物理机和云主机的混合管理
- ✓ 多租户场景下的IP隔离
```

#### ✅ 3. 性能良好
```
查询性能：
- 复合索引高效：(cloud_id, inner_ip)
- 避免全表扫描
- JOIN操作简单
```

#### ✅ 4. 兼容性强
```
适配场景：
- 传统物理机房
- 公有云环境
- 私有云环境
- 混合云架构
```

### 1.3 缺点与问题 ❌

#### ❌ 1. 云区域定义模糊

**问题**：云区域（Cloud Area）的边界不清晰

```
问题场景：
┌─────────────────────────────────────────┐
│ 云区域 = VPC？                            │
│  - AWS VPC: vpc-abc123                  │
│  - 但一个账号可能有多个VPC               │
│                                          │
│ 云区域 = Region？                         │
│  - us-east-1 下可能有多个VPC             │
│  - 多个VPC间IP可能冲突                   │
│                                          │
│ 云区域 = 账号？                           │
│  - 一个账号下有多个Region和VPC           │
│  - 粒度太粗                              │
└─────────────────────────────────────────┘

实际问题：
AWS账号A
├─ us-east-1
│  ├─ VPC-A: 10.0.0.0/16 → 云区域1
│  └─ VPC-B: 10.0.0.0/16 → 云区域2？还是合并？
└─ us-west-2
   └─ VPC-C: 10.0.0.0/16 → 云区域3

如何划分云区域？
- 按VPC？太多云区域，管理复杂
- 按Region？IP还是会冲突
- 按账号？粒度太粗
```

#### ❌ 2. 多网卡/多IP处理不优雅

**问题**：一台主机多个网卡、多个IP

```go
// BK-CMDB 的处理方式：把多个IP拼成字符串
type Host struct {
    InnerIP  string  // "10.0.1.10,10.0.1.11,10.0.1.12"  ❌ 不优雅
    OuterIP  string  // "1.2.3.4,5.6.7.8"
}

// 问题1：哪个IP是主IP？
// 问题2：如何按IP搜索主机？
// 问题3：IP的网卡归属信息丢失
// 问题4：无法表达IP的用途（管理IP、业务IP、存储IP）

实际场景：
主机A有3个网卡：
- eth0: 10.0.1.10 (管理网络)
- eth1: 172.16.1.10 (业务网络)
- eth2: 192.168.1.10 (存储网络)

BK-CMDB存储：
inner_ip = "10.0.1.10,172.16.1.10,192.168.1.10"  ❌
- 丢失了网卡信息
- 丢失了网络用途
- 字符串拼接不利于查询
```

#### ❌ 3. IP变更场景处理复杂

**问题**：主机IP变化时的唯一性约束冲突

```sql
-- 场景：主机A从IP1迁移到IP2
UPDATE hosts
SET inner_ip = '10.0.1.20'  -- 新IP
WHERE cloud_id = 1 AND inner_ip = '10.0.1.10';  -- 旧IP

-- 如果 (cloud_id=1, ip=10.0.1.20) 已被主机B占用，则失败！

-- 临时方案（不优雅）：
1. 先将主机A的IP改为临时值
2. 再改为目标IP
3. 处理复杂，容易出错
```

**真实场景**：
```
场景1：主机IP swap
- 主机A: 10.0.1.10 → 要改成 10.0.1.20
- 主机B: 10.0.1.20 → 要改成 10.0.1.10
- ❌ 简单UPDATE会违反唯一约束

场景2：云主机网络迁移
- 主机从VPC-A迁移到VPC-B
- IP从 10.0.1.10 变为 172.16.1.10
- cloud_id也要变化
- 但cloud_instance_id不变
- 需要复杂的事务处理
```

#### ❌ 4. 缺少网络拓扑关系

**问题**：无法表达完整的网络架构

```
缺失信息：
┌─────────────────────────────────────────┐
│ BK-CMDB 只有：                            │
│  - 云区域 (Cloud Area)                   │
│  - 主机 (Host)                           │
│                                          │
│ 缺少：                                   │
│  - VPC (Virtual Private Cloud)          │
│  - Subnet (子网)                         │
│  - Network Interface (网络接口)          │
│  - Security Group (安全组)               │
│  - Route Table (路由表)                  │
└─────────────────────────────────────────┘

实际网络拓扑：
Region: us-east-1
└─ VPC: 10.0.0.0/16
   ├─ Subnet-A: 10.0.1.0/24 (Public)
   │  ├─ Host-1: 10.0.1.10
   │  └─ Host-2: 10.0.1.11
   └─ Subnet-B: 10.0.2.0/24 (Private)
      ├─ Host-3: 10.0.2.10
      └─ Host-4: 10.0.2.11

BK-CMDB 只能表达：
cloud_id=1 → 包含所有主机
- 无法区分Public/Private子网
- 无法表达子网间的路由关系
- 无法表达网络隔离策略
```

#### ❌ 5. IP地址池管理缺失

**问题**：没有IP地址规划和分配机制

```
企业IP管理需求：
┌─────────────────────────────────────────┐
│ 1. IP地址池                               │
│    - 可用IP段: 10.0.1.0/24              │
│    - 已分配: 10.0.1.1-10.0.1.50         │
│    - 可分配: 10.0.1.51-10.0.1.254       │
│                                          │
│ 2. IP分配策略                             │
│    - 静态分配 vs DHCP                    │
│    - IP预留（网关、DNS等）               │
│    - IP回收机制                          │
│                                          │
│ 3. IP冲突检测                             │
│    - 主动扫描                            │
│    - 冲突告警                            │
│    - 自动修复                            │
└─────────────────────────────────────────┘

BK-CMDB 缺少：
- ❌ IP段管理
- ❌ IP分配记录
- ❌ IP回收机制
- ❌ IP使用率统计
```

---

## 二、改进方案建议

### 方案 A：渐进式优化（推荐用于现有系统）

保留 bk-cmdb 的核心设计，逐步增强

#### A1. 明确云区域层次结构

```sql
-- 引入网络层次：Region → VPC → Subnet → Host

-- 1. 云区域表（改进）
CREATE TABLE cloud_areas (
    id UUID PRIMARY KEY,
    name VARCHAR(256),
    type VARCHAR(32),  -- 'vpc', 'region', 'datacenter'

    -- VPC级别的云区域
    cloud_vendor VARCHAR(32),  -- aws/tencent/aliyun
    vpc_id VARCHAR(256),
    region VARCHAR(64),
    cidr VARCHAR(64),  -- 10.0.0.0/16

    -- 父子关系
    parent_id UUID REFERENCES cloud_areas(id),

    tenant_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 2. 子网表（新增）
CREATE TABLE subnets (
    id UUID PRIMARY KEY,
    name VARCHAR(256),
    cloud_area_id UUID REFERENCES cloud_areas(id),

    subnet_id VARCHAR(256),  -- 云平台子网ID
    cidr VARCHAR(64),  -- 10.0.1.0/24
    type VARCHAR(32),  -- 'public', 'private'

    tenant_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 3. 主机表（保持兼容）
CREATE TABLE hosts (
    id UUID PRIMARY KEY,

    -- 保留原有字段（向后兼容）
    cloud_area_id UUID REFERENCES cloud_areas(id),
    primary_inner_ip VARCHAR(256),

    -- 新增字段
    subnet_id UUID REFERENCES subnets(id),

    -- 云标识
    cloud_vendor VARCHAR(32),
    cloud_instance_id VARCHAR(256),

    -- 其他字段...
    host_name VARCHAR(256),

    -- 唯一性约束（保留）
    CONSTRAINT uk_cloud_ip UNIQUE (cloud_area_id, primary_inner_ip),
    CONSTRAINT uk_cloud_instance UNIQUE (cloud_vendor, cloud_instance_id)
);

-- 示例数据
-- VPC级云区域
INSERT INTO cloud_areas VALUES
('vpc-1', 'AWS-Production-VPC', 'vpc', 'aws', 'vpc-abc123', 'us-east-1', '10.0.0.0/16', NULL, ...);

-- 子网
INSERT INTO subnets VALUES
('subnet-1', 'Public-Subnet-A', 'vpc-1', 'subnet-abc', '10.0.1.0/24', 'public', ...),
('subnet-2', 'Private-Subnet-B', 'vpc-1', 'subnet-def', '10.0.2.0/24', 'private', ...);

-- 主机
INSERT INTO hosts VALUES
('host-1', 'vpc-1', '10.0.1.10', 'subnet-1', 'aws', 'i-abc123', 'web-01', ...);
```

**优点**：
- ✅ 保持向后兼容
- ✅ 增加网络拓扑能力
- ✅ 支持更细粒度的IP管理
- ✅ 渐进式迁移

#### A2. 网络接口抽象（解决多IP问题）

```sql
-- 网络接口表（新增）
CREATE TABLE network_interfaces (
    id UUID PRIMARY KEY,
    host_id UUID REFERENCES hosts(id) ON DELETE CASCADE,

    -- 网卡信息
    interface_name VARCHAR(64),  -- eth0, eth1
    mac_address VARCHAR(32),
    type VARCHAR(32),  -- 'primary', 'secondary', 'virtual'

    -- IP信息
    ip_address VARCHAR(256) NOT NULL,
    ip_type VARCHAR(32),  -- 'private', 'public', 'elastic'

    -- 网络归属
    subnet_id UUID REFERENCES subnets(id),
    cloud_area_id UUID REFERENCES cloud_areas(id),

    -- 用途标记
    purpose VARCHAR(64),  -- 'management', 'business', 'storage'

    -- 云平台信息
    cloud_interface_id VARCHAR(256),  -- eni-abc123

    is_primary BOOLEAN DEFAULT false,
    status VARCHAR(32),  -- 'active', 'inactive'

    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    -- 唯一性约束：云区域下IP唯一
    CONSTRAINT uk_area_ip UNIQUE (cloud_area_id, ip_address)
);

-- 索引
CREATE INDEX idx_host_interfaces ON network_interfaces(host_id);
CREATE INDEX idx_primary_ip ON network_interfaces(host_id, is_primary)
    WHERE is_primary = true;
```

**使用示例**：

```go
// 查询主机的所有IP
type Host struct {
    ID         uuid.UUID
    HostName   string
    Interfaces []NetworkInterface  // 关联查询
}

type NetworkInterface struct {
    ID           uuid.UUID
    InterfaceName string
    IPAddress    string
    Type         string
    Purpose      string
    IsPrimary    bool
}

// 创建多网卡主机
func CreateMultiNICHost(req *CreateHostRequest) error {
    // 1. 创建主机
    host := &Host{
        ID:       uuid.New(),
        HostName: "web-server-01",
    }
    db.Create(host)

    // 2. 创建网络接口
    for _, nic := range req.NetworkInterfaces {
        db.Create(&NetworkInterface{
            HostID:       host.ID,
            InterfaceName: nic.Name,  // "eth0"
            IPAddress:    nic.IP,      // "10.0.1.10"
            CloudAreaID:  nic.CloudAreaID,
            SubnetID:     nic.SubnetID,
            Purpose:      nic.Purpose, // "management"
            IsPrimary:    nic.IsPrimary,
        })
    }

    return nil
}

// 查询主机（含所有IP）
func GetHostWithIPs(hostID uuid.UUID) (*Host, error) {
    var host Host
    db.Preload("Interfaces").Find(&host, hostID)
    return &host, nil
}

// 按任意IP查询主机
func FindHostByIP(cloudAreaID uuid.UUID, ip string) (*Host, error) {
    var nic NetworkInterface
    err := db.Where("cloud_area_id = ? AND ip_address = ?",
                    cloudAreaID, ip).First(&nic)
    if err != nil {
        return nil, err
    }

    var host Host
    db.Find(&host, nic.HostID)
    return &host, nil
}
```

**API 响应示例**：

```json
{
    "id": "host-123",
    "host_name": "web-server-01",
    "cloud_vendor": "aws",
    "cloud_instance_id": "i-abc123",
    "network_interfaces": [
        {
            "id": "nic-1",
            "interface_name": "eth0",
            "ip_address": "10.0.1.10",
            "type": "private",
            "purpose": "management",
            "is_primary": true,
            "subnet": {
                "id": "subnet-1",
                "name": "Public-Subnet-A",
                "cidr": "10.0.1.0/24"
            }
        },
        {
            "id": "nic-2",
            "interface_name": "eth1",
            "ip_address": "172.16.1.10",
            "type": "private",
            "purpose": "business",
            "is_primary": false,
            "subnet": {
                "id": "subnet-2",
                "name": "Private-Subnet-B",
                "cidr": "172.16.1.0/24"
            }
        }
    ]
}
```

#### A3. IP变更的优雅处理

```go
// IP变更事务处理
func ChangeHostIP(hostID uuid.UUID, oldIP, newIP string) error {
    return db.Transaction(func(tx *gorm.DB) error {
        // 1. 查找对应的网络接口
        var nic NetworkInterface
        err := tx.Where("host_id = ? AND ip_address = ?",
                       hostID, oldIP).First(&nic)
        if err != nil {
            return err
        }

        // 2. 检查新IP是否已被占用
        var exists int64
        tx.Model(&NetworkInterface{}).
            Where("cloud_area_id = ? AND ip_address = ?",
                  nic.CloudAreaID, newIP).
            Count(&exists)

        if exists > 0 {
            return fmt.Errorf("IP %s already in use", newIP)
        }

        // 3. 更新IP
        nic.IPAddress = newIP
        return tx.Save(&nic).Error
    })
}

// IP交换（两台主机互换IP）
func SwapHostIPs(host1ID, host2ID uuid.UUID) error {
    return db.Transaction(func(tx *gorm.DB) error {
        // 1. 获取两台主机的主IP
        var nic1, nic2 NetworkInterface
        tx.Where("host_id = ? AND is_primary = true", host1ID).First(&nic1)
        tx.Where("host_id = ? AND is_primary = true", host2ID).First(&nic2)

        // 2. 使用临时IP避免唯一约束冲突
        tempIP := fmt.Sprintf("temp-%s", uuid.New().String())

        // 3. 三步交换
        nic1.IPAddress = tempIP
        tx.Save(&nic1)

        nic2.IPAddress = nic1.IPAddress
        tx.Save(&nic2)

        nic1.IPAddress = nic2.IPAddress
        tx.Save(&nic1)

        return nil
    })
}
```

---

### 方案 B：完全重构（推荐用于新系统）

采用更现代化的网络资源管理架构

#### B1. 核心架构设计

```
网络资源层次结构：
┌─────────────────────────────────────────┐
│         Region (区域)                     │
│  ┌─────────────────────────────────┐    │
│  │      VPC (虚拟私有云)             │    │
│  │  ┌─────────────────────────┐    │    │
│  │  │  Subnet (子网)           │    │    │
│  │  │  ┌──────────────────┐   │    │    │
│  │  │  │  IP Address      │   │    │    │
│  │  │  │  ┌────────────┐  │   │    │    │
│  │  │  │  │    Host    │  │   │    │    │
│  │  │  │  └────────────┘  │   │    │    │
│  │  │  └──────────────────┘   │    │    │
│  │  └─────────────────────────┘    │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘

主机和IP解耦：
Host ←─(1:N)─→ NetworkInterface ←─(1:1)─→ IPAddress
```

#### B2. 数据模型设计

```sql
-- 1. 区域
CREATE TABLE regions (
    id UUID PRIMARY KEY,
    name VARCHAR(256),
    cloud_vendor VARCHAR(32),  -- aws/tencent/aliyun
    region_code VARCHAR(64),   -- us-east-1
    status VARCHAR(32),

    tenant_id UUID,
    created_at TIMESTAMP
);

-- 2. VPC
CREATE TABLE vpcs (
    id UUID PRIMARY KEY,
    name VARCHAR(256),
    region_id UUID REFERENCES regions(id),

    cloud_vpc_id VARCHAR(256),  -- vpc-abc123
    cidr_block VARCHAR(64),     -- 10.0.0.0/16
    status VARCHAR(32),

    tenant_id UUID,
    created_at TIMESTAMP,

    CONSTRAINT uk_cloud_vpc UNIQUE (region_id, cloud_vpc_id)
);

-- 3. 子网
CREATE TABLE subnets (
    id UUID PRIMARY KEY,
    name VARCHAR(256),
    vpc_id UUID REFERENCES vpcs(id),

    cloud_subnet_id VARCHAR(256),
    cidr_block VARCHAR(64),  -- 10.0.1.0/24
    availability_zone VARCHAR(64),
    type VARCHAR(32),  -- 'public', 'private', 'isolated'

    tenant_id UUID,
    created_at TIMESTAMP,

    CONSTRAINT uk_cloud_subnet UNIQUE (vpc_id, cloud_subnet_id)
);

-- 4. IP地址池（新增）
CREATE TABLE ip_pools (
    id UUID PRIMARY KEY,
    name VARCHAR(256),
    subnet_id UUID REFERENCES subnets(id),

    ip_range_start VARCHAR(64),  -- 10.0.1.10
    ip_range_end VARCHAR(64),    -- 10.0.1.254
    gateway VARCHAR(64),         -- 10.0.1.1
    dns_servers TEXT[],          -- ['8.8.8.8', '8.8.4.4']

    allocation_type VARCHAR(32),  -- 'static', 'dhcp'
    total_count INT,
    allocated_count INT,

    tenant_id UUID,
    created_at TIMESTAMP
);

-- 5. IP地址（独立管理）
CREATE TABLE ip_addresses (
    id UUID PRIMARY KEY,
    ip_address VARCHAR(64) NOT NULL,

    subnet_id UUID REFERENCES subnets(id),
    ip_pool_id UUID REFERENCES ip_pools(id),

    type VARCHAR(32),  -- 'private', 'public', 'floating'
    status VARCHAR(32),  -- 'available', 'allocated', 'reserved'

    -- 分配信息
    allocated_to VARCHAR(32),  -- 'host', 'load_balancer', 'nat_gateway'
    allocated_resource_id UUID,  -- 被分配的资源ID

    allocated_at TIMESTAMP,
    released_at TIMESTAMP,

    tenant_id UUID,
    created_at TIMESTAMP,

    -- 唯一性：子网下IP唯一
    CONSTRAINT uk_subnet_ip UNIQUE (subnet_id, ip_address)
);

-- 6. 主机（不直接存储IP）
CREATE TABLE hosts (
    id UUID PRIMARY KEY,
    host_name VARCHAR(256),

    cloud_vendor VARCHAR(32),
    cloud_instance_id VARCHAR(256),

    cpu INT,
    memory INT,
    status VARCHAR(32),

    tenant_id UUID,
    created_at TIMESTAMP,

    CONSTRAINT uk_cloud_instance UNIQUE (cloud_vendor, cloud_instance_id)
);

-- 7. 网络接口（连接主机和IP）
CREATE TABLE network_interfaces (
    id UUID PRIMARY KEY,
    host_id UUID REFERENCES hosts(id) ON DELETE CASCADE,
    subnet_id UUID REFERENCES subnets(id),

    interface_name VARCHAR(64),  -- eth0
    mac_address VARCHAR(32),
    type VARCHAR(32),  -- 'primary', 'secondary'
    purpose VARCHAR(64),  -- 'management', 'business'

    cloud_interface_id VARCHAR(256),  -- eni-abc123

    is_primary BOOLEAN DEFAULT false,
    status VARCHAR(32),

    created_at TIMESTAMP,

    CONSTRAINT uk_cloud_eni UNIQUE (cloud_interface_id)
);

-- 8. 接口IP关联（支持一个接口多IP）
CREATE TABLE interface_ip_bindings (
    id UUID PRIMARY KEY,
    interface_id UUID REFERENCES network_interfaces(id) ON DELETE CASCADE,
    ip_address_id UUID REFERENCES ip_addresses(id),

    is_primary BOOLEAN DEFAULT false,
    bound_at TIMESTAMP,

    CONSTRAINT uk_interface_ip UNIQUE (interface_id, ip_address_id)
);
```

#### B3. IP分配流程

```go
// IP分配服务
type IPAllocationService struct {
    db *gorm.DB
}

// 为主机分配IP
func (s *IPAllocationService) AllocateIPForHost(
    hostID uuid.UUID,
    subnetID uuid.UUID,
    purpose string,
) (*IPAddress, error) {

    return s.db.Transaction(func(tx *gorm.DB) error {
        // 1. 从子网的IP池中找到可用IP
        var availableIP IPAddress
        err := tx.Where(
            "subnet_id = ? AND status = 'available'",
            subnetID,
        ).Order("ip_address ASC").
            First(&availableIP).Error

        if err != nil {
            return nil, fmt.Errorf("no available IP in subnet")
        }

        // 2. 标记IP为已分配
        availableIP.Status = "allocated"
        availableIP.AllocatedTo = "host"
        availableIP.AllocatedResourceID = hostID
        availableIP.AllocatedAt = time.Now()
        tx.Save(&availableIP)

        // 3. 创建网络接口
        nic := &NetworkInterface{
            ID:          uuid.New(),
            HostID:      hostID,
            SubnetID:    subnetID,
            Purpose:     purpose,
            IsPrimary:   true,  // 假设是主接口
            Status:      "active",
        }
        tx.Create(nic)

        // 4. 绑定IP到接口
        binding := &InterfaceIPBinding{
            InterfaceID: nic.ID,
            IPAddressID: availableIP.ID,
            IsPrimary:   true,
            BoundAt:     time.Now(),
        }
        tx.Create(binding)

        return &availableIP, nil
    })
}

// 释放IP
func (s *IPAllocationService) ReleaseIP(ipID uuid.UUID) error {
    return s.db.Transaction(func(tx *gorm.DB) error {
        // 1. 删除接口绑定
        tx.Where("ip_address_id = ?", ipID).
            Delete(&InterfaceIPBinding{})

        // 2. 更新IP状态为可用
        tx.Model(&IPAddress{}).Where("id = ?", ipID).Updates(map[string]interface{}{
            "status":                "available",
            "allocated_to":          nil,
            "allocated_resource_id": nil,
            "released_at":           time.Now(),
        })

        return nil
    })
}

// 查询主机的所有IP
func (s *IPAllocationService) GetHostIPs(hostID uuid.UUID) ([]IPAddress, error) {
    var ips []IPAddress

    err := s.db.Table("ip_addresses").
        Joins("JOIN interface_ip_bindings ON ip_addresses.id = interface_ip_bindings.ip_address_id").
        Joins("JOIN network_interfaces ON interface_ip_bindings.interface_id = network_interfaces.id").
        Where("network_interfaces.host_id = ?", hostID).
        Find(&ips).Error

    return ips, err
}
```

---

### 方案 C：云原生方案（最现代化）

采用 Kubernetes 的网络模型

#### C1. CNI (Container Network Interface) 思想

```yaml
# 网络配置声明式管理
apiVersion: v1
kind: NetworkAttachmentDefinition
metadata:
  name: management-network
spec:
  config: |
    {
      "cniVersion": "0.3.1",
      "type": "macvlan",
      "master": "eth0",
      "ipam": {
        "type": "host-local",
        "subnet": "10.0.1.0/24",
        "rangeStart": "10.0.1.10",
        "rangeEnd": "10.0.1.254",
        "gateway": "10.0.1.1"
      }
    }
```

#### C2. 数据模型

```go
// 网络命名空间
type NetworkNamespace struct {
    ID        uuid.UUID
    Name      string
    Type      string  // 'vpc', 'vxlan', 'overlay'
    Metadata  map[string]interface{}
}

// 网络
type Network struct {
    ID          uuid.UUID
    Name        string
    Namespace   uuid.UUID
    CIDR        string
    Type        string  // 'layer2', 'layer3', 'overlay'
    IPVersion   int     // 4 or 6
}

// IP地址分配记录（不可变）
type IPAllocation struct {
    ID              uuid.UUID
    IPAddress       string
    NetworkID       uuid.UUID
    AllocatedTo     uuid.UUID  // Resource ID
    AllocatedAt     time.Time
    ReleasedAt      *time.Time
    AllocationProof string     // 分配凭证，防篡改
}
```

---

## 三、方案对比与选择

| 方案 | 复杂度 | 兼容性 | 扩展性 | 适用场景 |
|------|--------|--------|--------|----------|
| BK-CMDB原方案 | ⭐ | ⭐⭐⭐ | ⭐⭐ | 小规模，简单网络 |
| 方案A（渐进式） | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | **推荐：中大规模** |
| 方案B（重构） | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | 新系统，复杂网络 |
| 方案C（云原生） | ⭐⭐⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | 容器/K8s环境 |

---

## 四、推荐方案

### 对于你的项目：**方案 A（渐进式优化）**

**理由**：
1. ✅ 保持与 bk-cmdb 的设计兼容性
2. ✅ 解决了多IP、网络拓扑等核心问题
3. ✅ 实现复杂度适中
4. ✅ 支持未来扩展

**实施步骤**：

```
Phase 1: 基础架构（1-2周）
├─ 实现云区域层次结构（Region → VPC → Subnet）
├─ 保留 (cloud_area_id, ip) 复合键兼容性
└─ 数据库迁移脚本

Phase 2: 网络接口抽象（2-3周）
├─ 实现 NetworkInterface 模型
├─ 支持多网卡/多IP
└─ IP变更事务处理

Phase 3: IP池管理（1-2周）
├─ IP地址池
├─ IP分配/回收
└─ IP使用统计

Phase 4: 网络拓扑（后续迭代）
├─ 安全组
├─ 路由表
└─ 网络可视化
```

---

## 五、总结

**BK-CMDB方案评分：7/10**

✅ **优点**：
- 简单实用
- 解决了基本问题
- 性能良好

❌ **缺点**：
- 云区域定义模糊
- 多IP处理不优雅
- 缺少网络拓扑
- IP池管理缺失

**改进建议**：
1. **短期**：明确云区域=VPC，添加子网概念
2. **中期**：引入网络接口抽象，支持多IP
3. **长期**：完整的网络资源管理体系

最终目标：构建一个**既能解决IP冲突，又能表达完整网络拓扑的现代化CMDB系统**！🎯
