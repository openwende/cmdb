# 云平台网络概念对比与CMDB数据模型设计

## 一、不同云平台的网络概念差异

### 1.1 概念对比表

| 层级 | AWS | 腾讯云 | 阿里云 | Azure | 华为云 |
|------|-----|--------|--------|-------|--------|
| **逻辑网络** | VPC | VPC (私有网络) | VPC (专有网络) | VNet | VPC |
| **子网** | Subnet | 子网 (Subnet) | 交换机 (vSwitch) | Subnet | 子网 |
| **可用区** | AZ (Availability Zone) | 可用区 | 可用区 | Availability Zone | 可用区 |
| **区域** | Region | 地域 (Region) | 地域 | Region | 区域 |
| **CIDR** | ✅ | ✅ | ✅ | ✅ | ✅ |

### 1.2 关键差异点

#### 差异1：子网概念不同

**AWS/腾讯云/Azure**：
```
VPC (10.0.0.0/16)
├─ Subnet-A (10.0.1.0/24) - us-east-1a
└─ Subnet-B (10.0.2.0/24) - us-east-1b
```

**阿里云**：
```
VPC (10.0.0.0/16)
├─ vSwitch-A (10.0.1.0/24) - 可用区A
└─ vSwitch-B (10.0.2.0/24) - 可用区B
```
⚠️ 阿里云叫"交换机"而不是"子网"

**华为云**：
```
VPC (10.0.0.0/16)
├─ 子网-A (10.0.1.0/24)
└─ 子网-B (10.0.2.0/24)
```

#### 差异2：网络层次结构

**AWS**：
```
Region
└─ VPC
   ├─ Subnet (强绑定AZ)
   │  └─ ENI (Elastic Network Interface)
   │     └─ IP
   └─ Internet Gateway / NAT Gateway
```

**腾讯云**：
```
地域
└─ VPC
   ├─ 子网
   │  └─ 实例
   │     └─ 弹性网卡
   │        └─ IP
   └─ NAT网关 / 公网网关
```

**阿里云**：
```
地域
└─ VPC
   ├─ vSwitch (交换机)
   │  └─ ECS实例
   │     └─ 弹性网卡
   │        └─ IP
   └─ NAT网关
```

#### 差异3：IP管理方式

| 云平台 | 主IP管理 | 辅助IP | 弹性IP |
|--------|----------|--------|--------|
| AWS | 自动分配/指定 | ✅ 支持多IP | EIP (Elastic IP) |
| 腾讯云 | 自动分配/指定 | ✅ 支持多IP | EIP (弹性公网IP) |
| 阿里云 | 自动分配/指定 | ✅ 支持多IP | EIP (弹性公网IP) |
| Azure | 动态/静态 | ✅ 支持多IP | Public IP |
| 华为云 | 自动分配/指定 | ✅ 支持多IP | EIP |

### 1.3 API差异示例

#### AWS SDK
```go
// 查询VPC
result, err := ec2Client.DescribeVpcs(&ec2.DescribeVpcsInput{})

// 查询Subnet
result, err := ec2Client.DescribeSubnets(&ec2.DescribeSubnetsInput{
    Filters: []*ec2.Filter{
        {Name: aws.String("vpc-id"), Values: []*string{aws.String(vpcID)}},
    },
})
```

#### 腾讯云SDK
```go
// 查询VPC
request := vpc.NewDescribeVpcsRequest()
response, err := client.DescribeVpcs(request)

// 查询子网
request := vpc.NewDescribeSubnetsRequest()
response, err := client.DescribeSubnets(request)
```

#### 阿里云SDK
```go
// 查询VPC
request := vpc.CreateDescribeVpcsRequest()
response, err := client.DescribeVpcs(request)

// 查询交换机（vSwitch）
request := vpc.CreateDescribeVSwitchesRequest()
response, err := client.DescribeVSwitches(request)  // 注意：不是Subnet！
```

---

## 二、你的方案完全正确！

### 2.1 问题：直接存VPC/Subnet表不好

**原因分析**：

```
❌ 问题1：概念映射困难
- 阿里云的vSwitch ≈ 其他云的Subnet？
- 但名字不同，属性可能有差异
- 数据库表该叫什么？subnet还是vswitch？

❌ 问题2：强耦合云平台
- 新增云平台需要改表结构
- 不同云平台的特有字段难以统一
- 维护成本高

❌ 问题3：过度设计
- CMDB的核心是管理主机和IP
- 不是要替代云平台的VPC管理
- 用户在云平台控制台管理VPC就够了

❌ 问题4：同步复杂度高
- 要同步VPC、Subnet、RouteTable、SecurityGroup...
- 数据量大，同步慢
- 很多信息用户根本不关心
```

### 2.2 更好的方案：抽象化存储

**核心思想**：不直接映射云平台概念，而是抽象为CMDB需要的逻辑概念

```sql
-- ❌ 不推荐：直接映射云平台
CREATE TABLE vpcs (
    vpc_id VARCHAR,
    cidr_block VARCHAR,
    -- AWS特有字段
    internet_gateway_id VARCHAR,
    -- 阿里云特有字段
    router_table_id VARCHAR,
    ...
);

-- ✅ 推荐：抽象为"网络空间"
CREATE TABLE network_spaces (
    id UUID PRIMARY KEY,
    name VARCHAR(256),
    type VARCHAR(32),  -- 'vpc', 'vnet', 'datacenter'

    -- 抽象属性
    cidr_block VARCHAR(64),
    region VARCHAR(64),

    -- 云平台映射信息（存JSONB）
    cloud_metadata JSONB,  -- 存储云平台特有信息
    /*
    AWS: {
        "vpc_id": "vpc-abc123",
        "internet_gateway": "igw-xyz",
        "cloud_vendor": "aws"
    }

    阿里云: {
        "vpc_id": "vpc-alibaba-123",
        "router_table": "rtb-xxx",
        "cloud_vendor": "aliyun"
    }
    */

    tenant_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- ✅ 推荐：IP段（而不是Subnet）
CREATE TABLE ip_ranges (
    id UUID PRIMARY KEY,
    name VARCHAR(256),
    network_space_id UUID REFERENCES network_spaces(id),

    -- 核心属性
    cidr_block VARCHAR(64),  -- 10.0.1.0/24
    type VARCHAR(32),        -- 'public', 'private'

    -- 云平台映射
    cloud_metadata JSONB,
    /*
    AWS: {"subnet_id": "subnet-abc"}
    阿里云: {"vswitch_id": "vsw-xyz"}
    */

    tenant_id UUID,
    created_at TIMESTAMP
);
```

**优势**：
- ✅ 统一的数据模型，不管什么云平台
- ✅ 云平台特有信息存JSONB，灵活扩展
- ✅ 新增云平台无需改表结构
- ✅ 降低复杂度，聚焦核心功能

---

## 三、同步维度：Region 优于 VPC（你的观点正确！）

### 3.1 为什么Region维度更好？

#### 场景对比

**按VPC同步（❌ 不推荐）**：
```
用户配置：
1. 配置AWS账号A - us-east-1 - VPC-A → 同步任务1
2. 配置AWS账号A - us-east-1 - VPC-B → 同步任务2
3. 配置AWS账号A - us-east-1 - VPC-C → 同步任务3
4. 配置AWS账号A - us-west-2 - VPC-D → 同步任务4
...

问题：
- ❌ 配置繁琐，一个账号10个VPC就要配10次
- ❌ VPC变化（新增/删除）需要手动维护
- ❌ 用户体验差
```

**按Region同步（✅ 推荐）**：
```
用户配置：
1. 配置AWS账号A - us-east-1 → 自动发现所有VPC和主机
2. 配置AWS账号A - us-west-2 → 自动发现所有VPC和主机

优势：
- ✅ 配置简单，一个Region配一次
- ✅ 自动发现VPC变化
- ✅ 用户体验好
```

### 3.2 推荐的同步配置设计

```sql
-- 云账号表
CREATE TABLE cloud_accounts (
    id UUID PRIMARY KEY,
    name VARCHAR(256),           -- "AWS生产环境"
    cloud_vendor VARCHAR(32),    -- aws/tencent/aliyun

    -- 认证信息
    access_key_id VARCHAR(256),
    access_key_secret TEXT,      -- 加密存储

    description TEXT,
    status VARCHAR(32),          -- active/inactive

    tenant_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 同步任务表
CREATE TABLE cloud_sync_tasks (
    id UUID PRIMARY KEY,
    name VARCHAR(256),           -- "AWS-生产环境-美东同步"

    account_id UUID REFERENCES cloud_accounts(id),

    -- 同步范围：按Region
    sync_regions TEXT[],         -- ['us-east-1', 'us-west-2']

    -- 同步资源类型
    resource_types TEXT[],       -- ['instance', 'network_interface', 'ip_address']

    -- 可选：VPC过滤（而不是必选）
    vpc_filters JSONB,           -- {"include": ["vpc-abc"], "exclude": ["vpc-xyz"]}

    -- 调度
    schedule VARCHAR(64),        -- "0 */6 * * *" (每6小时)
    enabled BOOLEAN DEFAULT true,

    -- 同步目标
    target_network_space_id UUID,  -- 同步到哪个网络空间

    -- 同步状态
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(32),  -- success/failed/running
    next_sync_at TIMESTAMP,

    tenant_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 同步历史记录
CREATE TABLE cloud_sync_histories (
    id UUID PRIMARY KEY,
    task_id UUID REFERENCES cloud_sync_tasks(id),

    sync_started_at TIMESTAMP,
    sync_finished_at TIMESTAMP,
    status VARCHAR(32),          -- success/failed/partial

    -- 同步统计
    resources_discovered INT,
    resources_created INT,
    resources_updated INT,
    resources_destroyed INT,

    error_message TEXT,
    details JSONB,               -- 详细信息

    created_at TIMESTAMP
);
```

### 3.3 用户配置流程（简化版）

```bash
# 步骤1：添加云账号
POST /api/v1/cloud/accounts
{
    "name": "AWS生产环境",
    "cloud_vendor": "aws",
    "access_key_id": "AKIAIOSFODNN7EXAMPLE",
    "access_key_secret": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
}

# 步骤2：创建同步任务（按Region）
POST /api/v1/cloud/sync-tasks
{
    "name": "AWS美东区域同步",
    "account_id": "account-uuid",
    "sync_regions": ["us-east-1"],           # 只需指定Region
    "resource_types": ["instance"],
    "schedule": "0 */6 * * *",               # 每6小时同步一次

    # 可选：VPC过滤
    "vpc_filters": {
        "include": ["vpc-production-*"],     # 只同步生产环境VPC
        "exclude": ["vpc-test-*"]            # 排除测试VPC
    }
}

# 步骤3：手动触发同步（可选）
POST /api/v1/cloud/sync-tasks/{task_id}/sync

# 步骤4：查看同步结果
GET /api/v1/cloud/sync-tasks/{task_id}/histories
```

### 3.4 同步流程设计

```go
// 云同步服务
type CloudSyncService struct {
    accountRepo      AccountRepository
    hostRepo         HostRepository
    networkSpaceRepo NetworkSpaceRepository
}

// 执行同步（按Region）
func (s *CloudSyncService) SyncRegion(
    accountID uuid.UUID,
    region string,
    vpcFilters *VPCFilters,
) error {

    // 1. 获取云账号
    account, err := s.accountRepo.GetByID(accountID)
    if err != nil {
        return err
    }

    // 2. 创建云厂商客户端
    client, err := cloudvendor.GetClient(&cloudvendor.Config{
        Vendor:    account.CloudVendor,
        AccessKey: account.AccessKeyID,
        SecretKey: account.AccessKeySecret,
        Region:    region,
    })

    // 3. 获取Region下所有VPC
    vpcs, err := client.GetVPCs(context.Background(), &cloudvendor.QueryOptions{})
    if err != nil {
        return err
    }

    // 4. 应用VPC过滤器（可选）
    vpcs = s.applyVPCFilters(vpcs, vpcFilters)

    // 5. 遍历每个VPC，同步主机
    for _, vpc := range vpcs {
        // 5.1 确保网络空间存在（自动创建）
        networkSpace, err := s.ensureNetworkSpace(vpc, region)
        if err != nil {
            log.Errorf("Failed to create network space: %v", err)
            continue
        }

        // 5.2 获取VPC下所有主机
        instances, err := client.GetInstances(context.Background(), &cloudvendor.QueryOptions{
            VPCIDs: []string{vpc.VpcID},
        })
        if err != nil {
            log.Errorf("Failed to get instances for VPC %s: %v", vpc.VpcID, err)
            continue
        }

        // 5.3 同步主机
        for _, inst := range instances {
            s.syncInstance(inst, networkSpace)
        }
    }

    return nil
}

// 应用VPC过滤器
func (s *CloudSyncService) applyVPCFilters(
    vpcs []*cloudvendor.VPC,
    filters *VPCFilters,
) []*cloudvendor.VPC {
    if filters == nil {
        return vpcs  // 无过滤，返回所有
    }

    result := []*cloudvendor.VPC{}
    for _, vpc := range vpcs {
        // 检查是否在排除列表
        if s.matchPattern(vpc.VpcID, filters.Exclude) {
            continue
        }

        // 检查是否在包含列表（如果有的话）
        if len(filters.Include) > 0 {
            if s.matchPattern(vpc.VpcID, filters.Include) {
                result = append(result, vpc)
            }
        } else {
            result = append(result, vpc)
        }
    }
    return result
}

// 确保网络空间存在（自动创建）
func (s *CloudSyncService) ensureNetworkSpace(
    vpc *cloudvendor.VPC,
    region string,
) (*NetworkSpace, error) {

    // 1. 尝试查找已存在的网络空间
    ns, err := s.networkSpaceRepo.FindByCloudMetadata(
        "vpc_id", vpc.VpcID,
    )
    if err == nil {
        return ns, nil  // 已存在
    }

    // 2. 不存在，自动创建
    ns = &NetworkSpace{
        ID:        uuid.New(),
        Name:      fmt.Sprintf("%s-%s", vpc.VpcName, region),
        Type:      "vpc",
        CIDRBlock: vpc.CIDRBlock,
        Region:    region,
        CloudMetadata: map[string]interface{}{
            "vpc_id":       vpc.VpcID,
            "vpc_name":     vpc.VpcName,
            "cloud_vendor": vpc.CloudVendor,
            "region":       region,
        },
    }

    return ns, s.networkSpaceRepo.Create(ns)
}
```

### 3.5 API响应示例

```json
// GET /api/v1/cloud/sync-tasks/{id}/histories/latest

{
    "sync_started_at": "2026-01-26T10:00:00Z",
    "sync_finished_at": "2026-01-26T10:15:23Z",
    "status": "success",
    "duration_seconds": 923,

    "summary": {
        "regions_synced": ["us-east-1"],
        "vpcs_discovered": 5,
        "vpcs_synced": 3,           // 应用过滤后实际同步的
        "vpcs_filtered_out": 2,      // 被过滤掉的

        "instances_discovered": 156,
        "instances_created": 12,     // 新增
        "instances_updated": 134,    // 更新
        "instances_destroyed": 10    // 云上已删除，标记为destroyed
    },

    "vpc_details": [
        {
            "vpc_id": "vpc-prod-001",
            "vpc_name": "Production-VPC",
            "cidr": "10.0.0.0/16",
            "instances_count": 89,
            "network_space_id": "ns-uuid-1",
            "status": "synced"
        },
        {
            "vpc_id": "vpc-prod-002",
            "vpc_name": "Production-VPC-DR",
            "cidr": "10.1.0.0/16",
            "instances_count": 45,
            "network_space_id": "ns-uuid-2",
            "status": "synced"
        },
        {
            "vpc_id": "vpc-test-001",
            "vpc_name": "Test-VPC",
            "status": "filtered_out",
            "reason": "Excluded by vpc_filters"
        }
    ],

    "errors": []
}
```

---

## 四、推荐的最终方案

### 4.1 数据模型（简化设计）

```sql
-- 1. 云账号
CREATE TABLE cloud_accounts (
    id UUID PRIMARY KEY,
    name VARCHAR(256),
    cloud_vendor VARCHAR(32),
    access_key_id VARCHAR(256),
    access_key_secret TEXT,
    tenant_id UUID,
    created_at TIMESTAMP
);

-- 2. 网络空间（抽象的VPC）
CREATE TABLE network_spaces (
    id UUID PRIMARY KEY,
    name VARCHAR(256),
    cidr_block VARCHAR(64),
    region VARCHAR(64),
    type VARCHAR(32),  -- 'vpc', 'datacenter'

    -- 云平台映射信息（灵活）
    cloud_metadata JSONB,

    tenant_id UUID,
    created_at TIMESTAMP
);

-- 3. 主机
CREATE TABLE hosts (
    id UUID PRIMARY KEY,
    host_name VARCHAR(256),
    network_space_id UUID REFERENCES network_spaces(id),

    -- 云标识
    cloud_vendor VARCHAR(32),
    cloud_instance_id VARCHAR(256),
    cloud_region VARCHAR(64),

    -- 主IP（用于唯一性约束）
    primary_ip VARCHAR(64),

    -- 所有IP（JSONB数组）
    all_ips JSONB,
    /*
    [
        {
            "ip": "10.0.1.10",
            "type": "private",
            "interface": "eth0",
            "is_primary": true
        },
        {
            "ip": "1.2.3.4",
            "type": "public",
            "interface": "eth0"
        }
    ]
    */

    -- 云平台元数据
    cloud_metadata JSONB,

    -- 状态
    status VARCHAR(32),
    is_destroyed BOOLEAN DEFAULT false,
    destroyed_at TIMESTAMP,

    tenant_id UUID,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,

    -- 唯一性约束
    CONSTRAINT uk_network_ip UNIQUE (network_space_id, primary_ip),
    CONSTRAINT uk_cloud_instance UNIQUE (cloud_vendor, cloud_instance_id)
);

-- 4. 同步任务
CREATE TABLE cloud_sync_tasks (
    id UUID PRIMARY KEY,
    name VARCHAR(256),
    account_id UUID REFERENCES cloud_accounts(id),

    -- 同步范围：Region级别
    sync_regions TEXT[],

    -- 可选VPC过滤
    vpc_filters JSONB,

    schedule VARCHAR(64),
    enabled BOOLEAN,

    tenant_id UUID,
    created_at TIMESTAMP
);
```

### 4.2 核心设计原则

✅ **DO（推荐）**：
1. 按Region同步，自动发现VPC
2. 抽象存储，用`cloud_metadata` JSONB存云平台特有信息
3. 聚焦主机和IP管理，不过度设计
4. 网络空间自动创建，用户无需手动维护

❌ **DON'T（不推荐）**：
1. 不要为每个云平台创建专用表
2. 不要强制用户按VPC配置
3. 不要试图完整复制云平台的网络拓扑
4. 不要过早优化不需要的功能

---

## 五、总结

### 你的观点完全正确！

1. ✅ **VPC/Subnet概念在不同云中确实不一样**
   - 不应该直接映射为数据库表
   - 应该抽象为"网络空间"和"IP段"
   - 云平台特有信息存JSONB

2. ✅ **Region维度同步比VPC更好**
   - 配置简单（一个Region配一次）
   - 自动发现VPC变化
   - 用户体验好
   - 支持可选的VPC过滤

### 推荐的实现方式

```
用户配置：
1. 添加云账号（AWS/腾讯云/阿里云）
2. 创建同步任务，指定Region
3. 可选：配置VPC过滤规则
4. 自动同步，自动创建网络空间

数据存储：
1. 网络空间（抽象的VPC）
2. 主机（包含所有IP的JSONB）
3. 云元数据（JSONB存储云平台特有信息）

同步逻辑：
1. 按Region获取所有VPC
2. 应用VPC过滤（如果有）
3. 遍历VPC获取主机
4. 自动创建/更新网络空间和主机
```

这样设计既简单又灵活，避免了过度设计！🎯
