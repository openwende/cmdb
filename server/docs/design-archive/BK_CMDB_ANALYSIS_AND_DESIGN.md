# BK-CMDB 功能分析与实现方案

基于对 bk-cmdb 开源项目的深入研究，针对以下两个功能进行分析和设计：
1. 主机和资源池功能
2. 云资源同步功能

---

## 一、主机和资源池功能分析

### 1.1 BK-CMDB 主机模型字段

根据源码分析，bk-cmdb 的主机模型包含以下核心字段：

#### 核心标识字段
- `bk_host_id` - 主机唯一标识符（自动生成）
- `bk_host_name` - 主机名
- `bk_asset_id` - 资产ID

#### 网络相关字段（特殊处理）
- `bk_host_innerip` - 内网IP（支持多IP，数组存储，显示为逗号分隔）
- `bk_host_outerip` - 外网IP（支持多IP）
- `bk_host_innerip_v6` - 内网IPv6地址
- `bk_host_outerip_v6` - 外网IPv6地址

#### 云平台相关
- `bk_cloud_id` - 云区域ID（资源池标识）
- `bk_cloud_vendor` - 云厂商（1=AWS, 2=腾讯云）
- `bk_cloud_inst_id` - 云实例ID
- `bk_cloud_host_status` - 云主机状态

#### 硬件信息
- `bk_cpu` - CPU核心数
- `bk_cpu_architecture` - CPU架构
- `bk_cpu_module` - CPU型号
- `bk_mem` - 内存容量(MB)
- `bk_disk` - 磁盘容量(GB)

#### 操作系统
- `bk_os_type` - 操作系统类型（Linux/Windows）
- `bk_os_name` - 操作系统名称
- `bk_os_version` - 操作系统版本
- `bk_os_bit` - 操作系统位数

#### 运维信息
- `bk_operator` - 主要运维人员（多人，逗号分隔）
- `bk_bak_operator` - 备份运维人员
- `bk_state` - 主机状态（测试中/上线/故障等）
- `bk_sn` - 设备序列号
- `bk_comment` - 备注
- `bk_province_name` - 省份
- `bk_isp_name` - 运营商

#### 业务关联
- `bk_biz_id` - 所属业务ID
- `bk_set_id` - 所属集群ID
- `bk_module_id` - 所属模块ID

#### 元数据
- `create_time` - 创建时间
- `last_time` - 最后更新时间
- `import_from` - 导入来源

### 1.2 资源池概念

**资源池 = 云区域 (Cloud Area)**

在 bk-cmdb 中：
- 资源池通过 `bk_cloud_id` 字段标识
- 主机可以属于不同的资源池（云区域）
- 支持从资源池分配主机到业务
- 未分配业务的主机存在于"待分配资源池"

### 1.3 我们当前架构的支持能力评估

#### ✅ 已支持的能力

1. **动态模型引擎** - 完美支持
   - 我们的动态模型系统可以创建 `host` 模型
   - 通过 `属性管理` 可以添加上述所有字段
   - `properties` JSONB字段可以存储任意主机属性

2. **业务关联** - 已支持
   - 通过 `business_id` 关联业务
   - 支持主机与业务的多对多关系

3. **租户隔离** - 已支持
   - `tenant_id` 字段天然支持多租户

#### ⚠️ 需要扩展的能力

1. **资源池/云区域管理**
   ```go
   // 需要新增 CloudArea 模型
   type CloudArea struct {
       ID          uuid.UUID
       Name        string
       CloudVendor string  // aws, tencent_cloud, aliyun, etc.
       VpcID       string
       Region      string
       Status      string
   }
   ```

2. **主机状态管理**
   - 需要定义主机生命周期状态（类似业务的 lifecycle）
   - 支持主机在资源池和业务间的转移

3. **IP地址特殊处理**
   - bk-cmdb 对IP字段做了特殊处理（数组存储，字符串展示）
   - 我们可以通过 JSONB 存储数组，前端做转换

#### ❌ 架构调整建议

**方案一：基于现有动态模型（推荐）**

```go
// 1. 创建 host 模型
POST /api/v1/models
{
  "name": "host",
  "display_name": "主机",
  "classification": "resource"
}

// 2. 添加标准主机属性
POST /api/v1/models/host/attributes
{
  "name": "bk_host_innerip",
  "field_type": "string",  // 或者用 json 类型存数组
  "is_required": true
}

// 3. 创建云区域模型
POST /api/v1/models
{
  "name": "cloud_area",
  "display_name": "云区域",
  "classification": "infrastructure"
}
```

**优势**：
- 利用现有架构，无需大改
- 字段灵活可扩展
- 快速上线

**方案二：专用主机表（适合大规模）**

```go
// 新增专用主机表
type Host struct {
    ID              uuid.UUID
    TenantID        uuid.UUID
    BusinessID      *uuid.UUID  // nullable，未分配时为null
    CloudAreaID     uuid.UUID
    HostName        string
    InnerIPs        []string    // JSONB存储
    OuterIPs        []string
    CloudVendor     string
    CloudInstanceID string
    OSType          string
    CPU             int
    Memory          int
    Status          string
    Properties      map[string]interface{} // 扩展属性
    CreatedAt       time.Time
    UpdatedAt       time.Time
}
```

**优势**：
- 性能更好（专用索引）
- 查询更简单
- 更易维护

---

## 二、云资源同步功能分析

### 2.1 BK-CMDB 的云同步架构

#### 核心设计模式：适配器模式（Adapter Pattern）

```go
// 统一的云厂商接口
type VendorClient interface {
    NewVendorClient(secretID, secretKey string) VendorClient
    GetRegions() ([]*metadata.Region, error)
    GetVpcs(region string, opt *VpcOpt) (*VpcsInfo, error)
    GetInstances(region string, opt *InstanceOpt) (*InstancesInfo, error)
    GetInstancesTotalCnt(region string, opt *InstanceOpt) (int64, error)
}

// 云厂商注册机制
var vendorClients = make(map[string]VendorClient)

func Register(vendorName string, client VendorClient) {
    vendorClients[vendorName] = client
}

func GetVendorClient(conf CloudAccountConf) (VendorClient, error) {
    client, exists := vendorClients[conf.VendorName]
    if !exists {
        return nil, fmt.Errorf("vendor not supported: %s", conf.VendorName)
    }
    return client.NewVendorClient(conf.SecretID, conf.SecretKey), nil
}
```

#### 各云厂商实现自己的适配器

**AWS 适配器示例**：
```go
type awsClient struct {
    secretID  string
    secretKey string
}

func (c *awsClient) GetInstances(region string, opt *InstanceOpt) (*InstancesInfo, error) {
    // 使用 AWS SDK
    sess := session.Must(session.NewSession(&aws.Config{
        Region:      aws.String(region),
        Credentials: credentials.NewStaticCredentials(c.secretID, c.secretKey, ""),
    }))

    ec2Svc := ec2.New(sess)
    result, err := ec2Svc.DescribeInstances(input)

    // 转换为统一的数据结构
    instances := &InstancesInfo{}
    for _, reservation := range result.Reservations {
        for _, instance := range reservation.Instances {
            instances.Info = append(instances.Info, &InstanceInfo{
                InstanceID: *instance.InstanceId,
                PrivateIP:  *instance.PrivateIpAddress,
                PublicIP:   aws.StringValue(instance.PublicIpAddress),
                VpcID:      *instance.VpcId,
                State:      convertState(*instance.State.Name),
            })
        }
    }
    return instances, nil
}
```

**腾讯云适配器示例**：
```go
type tencentCloudClient struct {
    secretID  string
    secretKey string
}

func (c *tencentCloudClient) GetInstances(region string, opt *InstanceOpt) (*InstancesInfo, error) {
    // 使用腾讯云 SDK
    credential := common.NewCredential(c.secretID, c.secretKey)
    client, _ := cvm.NewClient(credential, region, cpf)

    request := cvm.NewDescribeInstancesRequest()
    response, err := client.DescribeInstances(request)

    // 转换为统一的数据结构（与AWS相同）
    instances := &InstancesInfo{}
    for _, instance := range response.Response.InstanceSet {
        instances.Info = append(instances.Info, &InstanceInfo{
            InstanceID: *instance.InstanceId,
            PrivateIP:  *instance.PrivateIpAddress,
            // ... 映射字段
        })
    }
    return instances, nil
}
```

### 2.2 同步流程

```
1. 获取云账号配置（secretID/secretKey）
   ↓
2. 创建对应的云厂商客户端
   ↓
3. 获取云上资源（VPC、实例）
   ↓
4. 与本地CMDB数据对比 (Diff)
   ↓
5. 三路同步：
   - 新增：云上有，本地无
   - 更新：云上有变化
   - 删除：云上已删除，本地标记为 destroyed
   ↓
6. 事务提交 + 审计日志
```

### 2.3 关键的兼容性保证机制

#### 1. 统一的数据模型

```go
// 所有云厂商必须转换为这个统一结构
type InstanceInfo struct {
    InstanceID   string   // 云实例ID
    InstanceName string   // 实例名称
    PrivateIPs   []string // 内网IP列表
    PublicIPs    []string // 公网IP列表
    VpcID        string   // VPC ID
    State        string   // 统一的状态（running/stopped/terminated）
    CloudVendor  string   // 云厂商标识
    Region       string   // 区域
}

// 状态映射函数
func convertState(cloudState string, vendor string) string {
    // AWS: pending, running, stopping, stopped, terminated
    // Tencent: PENDING, RUNNING, STOPPED, REBOOTING, TERMINATING
    // 统一转换为: pending, running, stopped, terminated
}
```

#### 2. 云厂商注册机制

```go
func init() {
    // AWS注册
    Register("aws", &awsClient{})

    // 腾讯云注册
    Register("tencent_cloud", &tencentCloudClient{})

    // 未来扩展：阿里云、华为云等
    // Register("aliyun", &aliyunClient{})
    // Register("huaweicloud", &huaweiCloudClient{})
}
```

#### 3. 差异化处理（Option Pattern）

```go
// 每个云厂商可能有特殊参数
type InstanceOpt struct {
    Limit      int                    // 通用参数
    Offset     int                    // 通用参数
    Filters    map[string]string      // 通用过滤条件
    VendorOpts map[string]interface{} // 云厂商特有参数
}

// AWS特有：使用 NextToken 分页
// 腾讯云特有：使用 Offset/Limit 分页
// 通过 VendorOpts 传递
```

---

## 三、我们的实现方案

### 3.1 主机和资源池实现

#### 阶段一：基于动态模型（快速上线）

```bash
# 1. 创建云区域模型
curl -X POST http://localhost:8080/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cloud_area",
    "display_name": "云区域",
    "classification": "infrastructure",
    "description": "云区域/资源池管理"
  }'

# 2. 添加云区域属性
curl -X POST http://localhost:8080/api/v1/models/cloud_area/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cloud_vendor",
    "display_name": "云厂商",
    "field_type": "enum",
    "options": {"enum_values": ["aws", "tencent_cloud", "aliyun", "private"]}
  }'

# 3. 创建主机模型
curl -X POST http://localhost:8080/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "host",
    "display_name": "主机",
    "classification": "resource"
  }'

# 4. 添加主机标准属性（30+个字段）
# ... 批量添加 CPU、内存、IP等属性
```

#### 阶段二：专用表优化（性能提升）

新增文件结构：
```
internal/
  ├── core/
  │   ├── host/           # 新增：主机管理
  │   │   ├── service.go
  │   │   └── service_test.go
  │   └── cloudarea/      # 新增：云区域管理
  │       ├── service.go
  │       └── service_test.go
  ├── storage/
  │   ├── host_repository.go      # 主机数据访问
  │   └── cloudarea_repository.go # 云区域数据访问
  └── types/
      ├── host.go         # 主机数据结构
      └── cloudarea.go    # 云区域数据结构
```

### 3.2 云资源同步实现

#### 目录结构设计

```
internal/
  ├── cloudsync/           # 新模块：云同步
  │   ├── sync.go         # 同步引擎
  │   ├── scheduler.go    # 定时调度
  │   ├── diff.go         # 差异对比
  │   └── sync_test.go
  ├── cloudvendor/         # 云厂商适配器
  │   ├── interface.go    # 统一接口定义
  │   ├── registry.go     # 注册管理
  │   ├── aws/
  │   │   ├── client.go
  │   │   └── client_test.go
  │   ├── tencent/
  │   │   ├── client.go
  │   │   └── client_test.go
  │   └── aliyun/         # 预留：阿里云
  │       ├── client.go
  │       └── client_test.go
  └── types/
      ├── cloud.go        # 云相关数据结构
      └── sync.go         # 同步任务结构
```

#### 核心代码实现

**1. 云厂商接口定义** (`internal/cloudvendor/interface.go`)

```go
package cloudvendor

import "context"

// VendorClient 云厂商统一接口
type VendorClient interface {
    // 初始化客户端
    NewClient(config *VendorConfig) (VendorClient, error)

    // 获取区域列表
    GetRegions(ctx context.Context) ([]*Region, error)

    // 获取VPC列表
    GetVPCs(ctx context.Context, region string, opts *QueryOptions) ([]*VPC, error)

    // 获取实例列表
    GetInstances(ctx context.Context, region string, opts *QueryOptions) ([]*Instance, error)

    // 获取实例总数
    GetInstanceCount(ctx context.Context, region string, opts *QueryOptions) (int64, error)
}

// VendorConfig 云厂商配置
type VendorConfig struct {
    VendorName string
    SecretID   string
    SecretKey  string
    Region     string
}

// Instance 统一的实例结构
type Instance struct {
    ID           string   `json:"id"`
    Name         string   `json:"name"`
    PrivateIPs   []string `json:"private_ips"`
    PublicIPs    []string `json:"public_ips"`
    VpcID        string   `json:"vpc_id"`
    State        string   `json:"state"`        // pending/running/stopped/terminated
    CloudVendor  string   `json:"cloud_vendor"` // aws/tencent_cloud/aliyun
    Region       string   `json:"region"`
    CPU          int      `json:"cpu"`
    Memory       int      `json:"memory"`
    OSType       string   `json:"os_type"`
    CreatedTime  string   `json:"created_time"`
}

// Region 区域信息
type Region struct {
    RegionID   string `json:"region_id"`
    RegionName string `json:"region_name"`
    State      string `json:"state"`
}

// VPC 虚拟私有云
type VPC struct {
    VpcID   string `json:"vpc_id"`
    VpcName string `json:"vpc_name"`
    Region  string `json:"region"`
    CIDR    string `json:"cidr"`
}

// QueryOptions 查询选项
type QueryOptions struct {
    Limit   int
    Offset  int
    VpcIDs  []string
    Filters map[string]string
}
```

**2. 云厂商注册器** (`internal/cloudvendor/registry.go`)

```go
package cloudvendor

import (
    "fmt"
    "sync"
)

var (
    registry = make(map[string]VendorClient)
    mu       sync.RWMutex
)

// Register 注册云厂商客户端
func Register(vendorName string, client VendorClient) {
    mu.Lock()
    defer mu.Unlock()
    registry[vendorName] = client
}

// GetClient 获取云厂商客户端
func GetClient(config *VendorConfig) (VendorClient, error) {
    mu.RLock()
    client, exists := registry[config.VendorName]
    mu.RUnlock()

    if !exists {
        return nil, fmt.Errorf("unsupported cloud vendor: %s", config.VendorName)
    }

    return client.NewClient(config)
}

// ListVendors 列出已注册的云厂商
func ListVendors() []string {
    mu.RLock()
    defer mu.RUnlock()

    vendors := make([]string, 0, len(registry))
    for vendor := range registry {
        vendors = append(vendors, vendor)
    }
    return vendors
}
```

**3. AWS 适配器示例** (`internal/cloudvendor/aws/client.go`)

```go
package aws

import (
    "context"
    "github.com/aws/aws-sdk-go/aws"
    "github.com/aws/aws-sdk-go/aws/credentials"
    "github.com/aws/aws-sdk-go/aws/session"
    "github.com/aws/aws-sdk-go/service/ec2"
    "github.com/wend/cmdb-backend/internal/cloudvendor"
)

func init() {
    // 自动注册到全局注册表
    cloudvendor.Register("aws", &Client{})
}

type Client struct {
    config *cloudvendor.VendorConfig
    sess   *session.Session
}

func (c *Client) NewClient(config *cloudvendor.VendorConfig) (cloudvendor.VendorClient, error) {
    sess, err := session.NewSession(&aws.Config{
        Region: aws.String(config.Region),
        Credentials: credentials.NewStaticCredentials(
            config.SecretID,
            config.SecretKey,
            "",
        ),
    })
    if err != nil {
        return nil, err
    }

    return &Client{
        config: config,
        sess:   sess,
    }, nil
}

func (c *Client) GetInstances(ctx context.Context, region string, opts *cloudvendor.QueryOptions) ([]*cloudvendor.Instance, error) {
    ec2Svc := ec2.New(c.sess, &aws.Config{Region: aws.String(region)})

    input := &ec2.DescribeInstancesInput{
        MaxResults: aws.Int64(int64(opts.Limit)),
    }

    result, err := ec2Svc.DescribeInstancesWithContext(ctx, input)
    if err != nil {
        return nil, err
    }

    instances := make([]*cloudvendor.Instance, 0)
    for _, reservation := range result.Reservations {
        for _, instance := range reservation.Instances {
            instances = append(instances, &cloudvendor.Instance{
                ID:          aws.StringValue(instance.InstanceId),
                Name:        getInstanceName(instance.Tags),
                PrivateIPs:  []string{aws.StringValue(instance.PrivateIpAddress)},
                PublicIPs:   getPublicIPs(instance),
                VpcID:       aws.StringValue(instance.VpcId),
                State:       convertState(aws.StringValue(instance.State.Name)),
                CloudVendor: "aws",
                Region:      region,
                CPU:         getCPU(instance.InstanceType),
                Memory:      getMemory(instance.InstanceType),
                OSType:      getOSType(instance.Platform),
            })
        }
    }

    return instances, nil
}

// 状态转换：AWS -> 统一格式
func convertState(awsState string) string {
    mapping := map[string]string{
        "pending":       "pending",
        "running":       "running",
        "stopping":      "stopped",
        "stopped":       "stopped",
        "shutting-down": "terminated",
        "terminated":    "terminated",
    }
    if state, ok := mapping[awsState]; ok {
        return state
    }
    return awsState
}
```

**4. 同步引擎** (`internal/cloudsync/sync.go`)

```go
package cloudsync

import (
    "context"
    "fmt"
    "github.com/wend/cmdb-backend/internal/cloudvendor"
    "github.com/wend/cmdb-backend/internal/types"
)

type SyncEngine struct {
    hostRepo    HostRepository
    cloudConfig *types.CloudAccount
}

func NewSyncEngine(hostRepo HostRepository, config *types.CloudAccount) *SyncEngine {
    return &SyncEngine{
        hostRepo:    hostRepo,
        cloudConfig: config,
    }
}

// Sync 执行同步
func (e *SyncEngine) Sync(ctx context.Context) error {
    // 1. 获取云厂商客户端
    client, err := cloudvendor.GetClient(&cloudvendor.VendorConfig{
        VendorName: e.cloudConfig.CloudVendor,
        SecretID:   e.cloudConfig.SecretID,
        SecretKey:  e.cloudConfig.SecretKey,
    })
    if err != nil {
        return fmt.Errorf("failed to get vendor client: %w", err)
    }

    // 2. 获取云上实例
    cloudInstances, err := e.fetchCloudInstances(ctx, client)
    if err != nil {
        return fmt.Errorf("failed to fetch cloud instances: %w", err)
    }

    // 3. 获取本地实例
    localHosts, err := e.hostRepo.ListByCloudVendor(ctx, e.cloudConfig.CloudVendor)
    if err != nil {
        return fmt.Errorf("failed to get local hosts: %w", err)
    }

    // 4. 计算差异
    diff := e.calculateDiff(cloudInstances, localHosts)

    // 5. 执行同步（事务）
    return e.executeDiff(ctx, diff)
}

// 差异计算
type SyncDiff struct {
    ToAdd    []*cloudvendor.Instance
    ToUpdate []*cloudvendor.Instance
    ToDelete []string // host IDs
}

func (e *SyncEngine) calculateDiff(cloud []*cloudvendor.Instance, local []*types.Host) *SyncDiff {
    diff := &SyncDiff{}

    cloudMap := make(map[string]*cloudvendor.Instance)
    for _, inst := range cloud {
        cloudMap[inst.ID] = inst
    }

    localMap := make(map[string]*types.Host)
    for _, host := range local {
        localMap[host.CloudInstanceID] = host
    }

    // 找出新增
    for id, inst := range cloudMap {
        if _, exists := localMap[id]; !exists {
            diff.ToAdd = append(diff.ToAdd, inst)
        }
    }

    // 找出更新和删除
    for id, host := range localMap {
        if inst, exists := cloudMap[id]; exists {
            // 检查是否有变化
            if e.hasChanges(inst, host) {
                diff.ToUpdate = append(diff.ToUpdate, inst)
            }
        } else {
            // 云上已删除
            diff.ToDelete = append(diff.ToDelete, host.ID.String())
        }
    }

    return diff
}
```

### 3.3 API 设计

#### 云账号管理

```bash
# 1. 创建云账号
POST /api/v1/cloud/accounts
{
  "account_name": "AWS生产环境",
  "cloud_vendor": "aws",
  "secret_id": "AKIAIOSFODNN7EXAMPLE",
  "secret_key": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "description": "AWS生产环境账号",
  "regions": ["us-east-1", "ap-southeast-1"]
}

# 2. 创建同步任务
POST /api/v1/cloud/sync-tasks
{
  "task_name": "AWS主机每日同步",
  "account_id": "uuid",
  "resource_type": "instance",
  "sync_regions": ["us-east-1"],
  "sync_vpcs": ["vpc-xxxxx"],
  "schedule": "0 2 * * *",  # 每天凌晨2点
  "sync_all": false,
  "target_cloud_area_id": "uuid"
}

# 3. 手动触发同步
POST /api/v1/cloud/sync-tasks/:id/trigger

# 4. 查看同步历史
GET /api/v1/cloud/sync-tasks/:id/histories
```

---

## 四、实施路线图

### Phase 1: 基础模型搭建（1-2周）
- [ ] 基于动态模型创建 cloud_area 和 host 模型
- [ ] 定义标准主机属性（30+字段）
- [ ] 实现主机与业务的关联
- [ ] 完成基础 CRUD API

### Phase 2: 云同步框架（2-3周）
- [ ] 设计云厂商抽象接口
- [ ] 实现云厂商注册机制
- [ ] 开发 AWS 适配器
- [ ] 开发腾讯云适配器
- [ ] 实现同步引擎核心逻辑
- [ ] 完成差异对比算法

### Phase 3: 同步任务管理（1-2周）
- [ ] 云账号管理 API
- [ ] 同步任务配置 API
- [ ] 定时调度器
- [ ] 同步历史记录
- [ ] 审计日志

### Phase 4: 扩展与优化（持续）
- [ ] 添加阿里云支持
- [ ] 添加华为云支持
- [ ] 性能优化（批量处理、缓存）
- [ ] 监控告警
- [ ] 增量同步优化

---

## 五、关键技术点总结

### 1. 云兼容性保证的核心要点

✅ **统一抽象层**
- 定义标准的 `VendorClient` 接口
- 所有云厂商实现相同接口
- 返回统一的数据结构

✅ **注册机制**
- 使用 `init()` 自动注册
- 动态加载云厂商插件
- 便于扩展新云平台

✅ **状态映射**
- 将各云平台状态统一为标准状态
- 维护状态映射表

✅ **差异化处理**
- 通用参数 + 扩展参数
- Option Pattern 设计

### 2. 我们架构的优势

✅ **动态模型系统** - 天然支持字段扩展
✅ **JSONB 存储** - 灵活存储复杂数据
✅ **微服务架构** - 云同步可独立部署
✅ **事件机制** - 易于集成审计和通知

### 3. 需要注意的挑战

⚠️ **大规模同步性能**
- 批量处理
- 并发控制
- 增量同步

⚠️ **云API限流**
- 请求频率控制
- 重试机制
- 配额管理

⚠️ **数据一致性**
- 事务保证
- 冲突处理
- 回滚机制

---

## 六、总结和建议

### 问题1：主机字段支持评估

**答案：完全支持！**

我们的动态模型引擎可以完美支持 bk-cmdb 的所有主机字段：
- 通过模型属性管理添加 30+ 标准字段
- JSONB 存储支持复杂数据类型（数组、对象）
- 支持自定义扩展字段

**建议**：
- 优先使用动态模型快速上线
- 后期可针对主机创建专用表优化性能

### 问题2：云兼容性实现方案

**答案：采用适配器模式 + 注册机制！**

核心实现方式：
1. **统一接口抽象** - `VendorClient` 接口定义标准方法
2. **各云厂商适配器** - 实现统一接口，内部调用各自SDK
3. **注册管理机制** - 支持动态注册新云平台
4. **统一数据模型** - 所有云平台数据转换为标准结构

**扩展新云平台只需**：
```go
// 1. 实现 VendorClient 接口
type AliyunClient struct {}

func (c *AliyunClient) GetInstances(...) {...}

// 2. 注册到系统
func init() {
    cloudvendor.Register("aliyun", &AliyunClient{})
}
```

就这么简单！ 🎉

---

## 参考资料

- [BK-CMDB GitHub](https://github.com/TencentBlueKing/bk-cmdb)
- [AWS SDK for Go](https://github.com/aws/aws-sdk-go)
- [Tencent Cloud SDK](https://github.com/TencentCloud/tencentcloud-sdk-go)
