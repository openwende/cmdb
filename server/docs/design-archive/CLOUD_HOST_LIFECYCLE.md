# 云主机生命周期管理方案

## BK-CMDB 的实现策略

### 一、云资源删除时的处理逻辑

根据 bk-cmdb 源码分析（`hostsyncor.go`），当云平台资源被删除时，采用以下策略：

#### 1. VPC/云区域删除处理

```go
// 来自 bk-cmdb/src/scene_server/cloud_server/cloudsync/hostsyncor.go
func (h *HostSyncor) syncDestroyedVpcs(destroyedVpcIDs []int64) error {
    // 1. 清空被销毁VPC下所有主机的IP地址
    // 2. 标记 VPC 为 destroyed（已销毁）状态
    // 3. 不删除主机记录本身

    for _, vpcID := range destroyedVpcIDs {
        // 清空该VPC下主机的内网IP和外网IP
        clearIPCondition := map[string]interface{}{
            "bk_cloud_id": vpcID,
        }
        updateData := map[string]interface{}{
            "bk_host_innerip": "",
            "bk_host_outerip": "",
        }

        // 更新主机，而不是删除
        h.updateHosts(clearIPCondition, updateData)
    }
}
```

**关键点**：
- ✅ **不删除主机记录**
- ✅ **清空IP地址**（因为VPC已销毁，IP无意义）
- ✅ **保留主机其他信息**（历史记录、配置等）

#### 2. 云主机删除的三种状态

```go
// VpcSyncInfo 结构体包含 Destroyed 字段
type VpcSyncInfo struct {
    VpcID        string `json:"vpc_id"`
    VpcName      string `json:"vpc_name"`
    Region       string `json:"region"`
    VpcHostCount int    `json:"vpc_host_count"`
    CloudID      int64  `json:"cloud_id"`
    SyncDir      int    `json:"sync_dir"`
    Destroyed    *bool  `json:"destroyed"`  // 标记是否已在云上销毁
}
```

**主机状态流转**：
```
1. 正常运行（Running）
   ↓
2. 云上停止（Stopped）
   ↓
3. 云上终止（Terminated）
   ↓
4. CMDB标记为 Destroyed
   - 保留记录
   - 清空IP
   - 标记销毁时间
   - 关联关系保留（方便审计追溯）
```

### 二、差异对比（Diff）算法

```go
// getDiffHosts 函数对比云上和本地主机
func (h *HostSyncor) getDiffHosts(cloudHosts, localHosts []*Host) *DiffResult {
    diff := &DiffResult{
        ToAdd:    []*Host{},
        ToUpdate: []*Host{},
        ToDelete: []*Host{},  // 注意：这里是"标记删除"，不是真删除
    }

    cloudMap := make(map[string]*Host)
    for _, host := range cloudHosts {
        cloudMap[host.CloudInstanceID] = host
    }

    localMap := make(map[string]*Host)
    for _, host := range localHosts {
        localMap[host.CloudInstanceID] = host
    }

    // 1. 云上新增的主机 -> 添加到CMDB
    for instanceID, cloudHost := range cloudMap {
        if _, exists := localMap[instanceID]; !exists {
            diff.ToAdd = append(diff.ToAdd, cloudHost)
        }
    }

    // 2. 云上和本地都存在 -> 检查是否有变化
    for instanceID, localHost := range localMap {
        if cloudHost, exists := cloudMap[instanceID]; exists {
            if hasChanges(cloudHost, localHost) {
                diff.ToUpdate = append(diff.ToUpdate, cloudHost)
            }
        } else {
            // 3. 本地有，云上没有 -> 标记为已销毁
            // 注意：不是物理删除
            localHost.Destroyed = true
            localHost.DestroyedTime = time.Now()
            diff.ToDelete = append(diff.ToDelete, localHost)
        }
    }

    return diff
}
```

### 三、为什么不物理删除？

#### 原因分析：

1. **审计追溯需求** 📋
   ```
   - 需要知道历史上有哪些主机
   - 主机何时创建、何时销毁
   - 谁操作的销毁动作
   ```

2. **配置历史保留** 📚
   ```
   - 主机上的应用配置
   - 安全组规则
   - 监控告警历史
   ```

3. **成本分析** 💰
   ```
   - 计算资源使用时长
   - 费用统计和报表
   - 容量规划参考
   ```

4. **误操作恢复** 🔄
   ```
   - 云上误删除后可能恢复
   - CMDB保留记录便于重新关联
   ```

5. **关联关系保留** 🔗
   ```
   - 主机与业务的关联历史
   - 主机与应用的部署关系
   - 方便事后分析
   ```

### 四、实际数据库设计

```sql
-- 主机表结构（简化版）
CREATE TABLE cc_HostBase (
    bk_host_id BIGINT PRIMARY KEY,
    bk_host_name VARCHAR(256),
    bk_host_innerip VARCHAR(256),
    bk_host_outerip VARCHAR(256),
    bk_cloud_id BIGINT,
    bk_cloud_inst_id VARCHAR(256),  -- 云实例ID

    -- 状态相关
    bk_state VARCHAR(32),  -- testing/online/offline
    bk_cloud_host_status VARCHAR(32),  -- running/stopped/terminated

    -- 销毁标记（关键）
    is_destroyed BOOLEAN DEFAULT FALSE,
    destroyed_time TIMESTAMP NULL,

    -- 元数据
    create_time TIMESTAMP,
    last_time TIMESTAMP,

    -- 软删除（数据库层面）
    deleted_at TIMESTAMP NULL
);

-- 索引
CREATE INDEX idx_cloud_inst ON cc_HostBase(bk_cloud_inst_id, is_destroyed);
CREATE INDEX idx_destroyed ON cc_HostBase(is_destroyed, destroyed_time);
```

### 五、同步流程详细说明

```
┌─────────────────────────────────────────────────────────┐
│  第1步：获取云上主机列表                                    │
│  - EC2/CVM API 查询所有实例                                │
│  - 状态：running, stopped, terminated                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  第2步：获取CMDB本地主机列表                                │
│  - 查询 is_destroyed = false 的主机                       │
│  - 按 cloud_instance_id 建立映射                          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  第3步：差异对比 (Diff)                                    │
│                                                           │
│  情况A：云上有，本地无 → 新增主机                           │
│    INSERT INTO cc_HostBase (...)                         │
│                                                           │
│  情况B：云上和本地都有 → 对比属性                           │
│    - IP变化 → UPDATE                                      │
│    - 状态变化（running→stopped）→ UPDATE                  │
│    - 规格变化（CPU/内存）→ UPDATE                          │
│                                                           │
│  情况C：本地有，云上无 → 标记销毁 ⚠️                        │
│    UPDATE cc_HostBase SET                                │
│      is_destroyed = true,                                │
│      destroyed_time = NOW(),                             │
│      bk_host_innerip = '',   -- 清空IP                    │
│      bk_host_outerip = '',                               │
│      bk_cloud_host_status = 'destroyed'                  │
│    WHERE bk_cloud_inst_id = 'i-xxxxx'                    │
│                                                           │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  第4步：事务提交 + 审计日志                                 │
│  - 所有变更在一个事务内                                     │
│  - 记录审计日志：谁、何时、做了什么                          │
│  - 失败自动回滚                                            │
└─────────────────────────────────────────────────────────┘
```

### 六、查询过滤策略

```go
// 默认查询：只显示未销毁的主机
func ListActiveHosts() ([]*Host, error) {
    return db.Query(`
        SELECT * FROM cc_HostBase
        WHERE is_destroyed = false
        AND deleted_at IS NULL
    `)
}

// 查询所有主机（包括已销毁）
func ListAllHosts(includeDestroyed bool) ([]*Host, error) {
    query := "SELECT * FROM cc_HostBase WHERE deleted_at IS NULL"

    if !includeDestroyed {
        query += " AND is_destroyed = false"
    }

    return db.Query(query)
}

// 查询已销毁主机（用于审计）
func ListDestroyedHosts(startTime, endTime time.Time) ([]*Host, error) {
    return db.Query(`
        SELECT * FROM cc_HostBase
        WHERE is_destroyed = true
        AND destroyed_time BETWEEN $1 AND $2
    `, startTime, endTime)
}
```

### 七、完整的状态转换图

```
┌──────────────────────────────────────────────────────────┐
│                     云主机生命周期                          │
└──────────────────────────────────────────────────────────┘

  云平台创建实例
      ↓
  ┌─────────────┐
  │  pending    │  云上创建中
  └─────────────┘
      ↓
  ┌─────────────┐
  │  running    │  正常运行 → CMDB同步后：is_destroyed=false
  └─────────────┘
      ↓ ↑
  ┌─────────────┐
  │  stopped    │  已停止 → CMDB更新状态
  └─────────────┘
      ↓
  ┌─────────────┐
  │  terminating│  终止中
  └─────────────┘
      ↓
  ┌─────────────┐
  │  terminated │  已终止 → CMDB下次同步时标记 is_destroyed=true
  └─────────────┘
      ↓
  ┌─────────────┐
  │  CMDB标记   │  is_destroyed=true, destroyed_time=NOW()
  │  destroyed  │  保留记录，清空IP，用于审计
  └─────────────┘
      ↓
  （可选）一段时间后物理删除
  │
  ┌─────────────┐
  │  deleted_at │  软删除标记（可选，通常不做）
  │   设置时间   │
  └─────────────┘
```

### 八、清理策略（可选）

```go
// 定期清理策略（可选实现）
type CleanupPolicy struct {
    // 已销毁主机保留时长（例如：180天）
    RetentionDays int

    // 是否开启自动清理
    EnableAutoClean bool
}

// 清理已销毁超过保留期的主机
func CleanupDestroyedHosts(policy *CleanupPolicy) error {
    if !policy.EnableAutoClean {
        return nil
    }

    cutoffTime := time.Now().AddDate(0, 0, -policy.RetentionDays)

    // 软删除：设置 deleted_at
    _, err := db.Exec(`
        UPDATE cc_HostBase
        SET deleted_at = NOW()
        WHERE is_destroyed = true
        AND destroyed_time < $1
        AND deleted_at IS NULL
    `, cutoffTime)

    return err
}
```

## 我们的实现建议

### 推荐方案：三层删除策略

```go
// Host 数据结构
type Host struct {
    ID              uuid.UUID  `json:"id"`
    CloudInstanceID string     `json:"cloud_instance_id"`

    // 第一层：云状态
    CloudStatus     string     `json:"cloud_status"`  // running/stopped/terminated

    // 第二层：销毁标记
    IsDestroyed     bool       `json:"is_destroyed"`
    DestroyedTime   *time.Time `json:"destroyed_time"`

    // 第三层：软删除（可选）
    DeletedAt       *time.Time `json:"deleted_at" gorm:"index"`

    // 基础字段
    HostName        string     `json:"host_name"`
    InnerIPs        []string   `json:"inner_ips" gorm:"type:jsonb"`
    OuterIPs        []string   `json:"outer_ips" gorm:"type:jsonb"`

    CreatedAt       time.Time  `json:"created_at"`
    UpdatedAt       time.Time  `json:"updated_at"`
}

// 同步时的处理逻辑
func (s *CloudSyncService) handleDeletedInstances(deletedInstances []*Host) error {
    for _, host := range deletedInstances {
        // 1. 标记为已销毁
        host.IsDestroyed = true
        now := time.Now()
        host.DestroyedTime = &now

        // 2. 清空IP（因为VPC可能已销毁）
        host.InnerIPs = []string{}
        host.OuterIPs = []string{}

        // 3. 更新云状态
        host.CloudStatus = "destroyed"

        // 4. 保存更新（不删除记录）
        if err := s.hostRepo.Update(context.Background(), host); err != nil {
            return err
        }

        // 5. 记录审计日志
        s.auditLog.Record("host_destroyed", host.ID,
            fmt.Sprintf("Cloud instance %s terminated", host.CloudInstanceID))
    }

    return nil
}
```

### 查询接口设计

```go
// API: 列出主机（默认不显示已销毁）
GET /api/v1/hosts?include_destroyed=false

// API: 查询已销毁主机（审计用）
GET /api/v1/hosts/destroyed?start_time=2026-01-01&end_time=2026-01-31

// API: 主机详情（即使已销毁也能查看）
GET /api/v1/hosts/:id
```

## 总结

**BK-CMDB 的核心策略**：
1. ✅ **标记删除，不物理删除** - `is_destroyed = true`
2. ✅ **清空IP地址** - 因为VPC销毁后IP无意义
3. ✅ **保留所有其他信息** - 用于审计和追溯
4. ✅ **可配置清理策略** - 超过保留期后可选软删除
5. ✅ **完整的审计日志** - 记录所有变更

**我们应该采用的方案**：
- 完全参考 bk-cmdb 的设计
- 三层删除：云状态 → 销毁标记 → 软删除
- 默认查询过滤已销毁主机
- 提供审计接口查看历史

这样既保证了数据完整性，又满足了审计合规要求！🎯
