# WEND CMDB 实施计划

基于我们的讨论，制定完整的云主机管理和同步功能实施路线图。

---

## 📋 已完成的工作

### ✅ Phase 0: 基础功能（已完成）

- [x] 业务管理 API
- [x] 业务集管理 API
- [x] 动态模型引擎
- [x] 实例管理 API
- [x] **业务删除归档状态限制**（最新完成）
  - Service层状态验证
  - Handler层错误处理
  - 完整测试覆盖（8/8通过）
  - API文档更新

**成果**：
- 基础架构完善
- 动态模型系统可用
- 为云主机功能打下基础

---

## 🎯 核心设计决策（基于讨论）

### 1. 主机数据模型

**决策：核心字段 + JSONB扩展**

```sql
-- 15个核心字段 + 2个JSONB扩展
CREATE TABLE hosts (
    -- 核心字段（固定）
    id, host_name, cloud_vendor, cloud_instance_id, cloud_region,
    network_space_id, primary_ip, ip_addresses, cpu, memory, os_type,
    status, is_destroyed, tenant_id, created_at,

    -- JSONB扩展
    cloud_metadata JSONB,   -- 云平台特有信息（云同步填充）
    custom_fields JSONB     -- 业务自定义字段（业务维护）
);
```

**理由**：
- ✅ 比BK-CMDB的30+字段简洁
- ✅ 核心字段满足云同步需求
- ✅ JSONB扩展支持业务自定义
- ✅ 职责分离（云同步 vs 业务自定义）

### 2. 网络模型

**决策：抽象化存储（network_spaces）**

```sql
-- 不直接映射VPC/Subnet，而是抽象为"网络空间"
CREATE TABLE network_spaces (
    id, name, cidr_block, region, type,
    cloud_metadata JSONB  -- 灵活存储云平台信息
);
```

**理由**：
- ✅ 不同云平台的VPC/Subnet概念不同
- ✅ 抽象化避免强耦合
- ✅ JSONB存储云平台特有信息
- ✅ 易于扩展新云平台

### 3. 同步维度

**决策：Region级别同步（自动发现VPC）**

**理由**：
- ✅ 用户只需配置一次Region
- ✅ 自动发现该Region下所有VPC
- ✅ VPC变化自动感知
- ✅ 用户体验好（vs 每个VPC配一次）

### 4. 云主机生命周期

**决策：标记删除（is_destroyed）**

**理由**：
- ✅ 审计追溯需求
- ✅ 配置历史保留
- ✅ 成本分析
- ✅ 参考BK-CMDB最佳实践

### 5. 主机唯一标识

**决策：三层标识体系**

```
1. 数据库主键: id (UUID)
2. 业务唯一: (network_space_id, primary_ip)
3. 云平台标识: (cloud_vendor, cloud_instance_id)
```

**理由**：
- ✅ 解决IP冲突问题
- ✅ 支持多云环境
- ✅ 云同步优先用云实例ID

### 6. 云厂商抽象

**决策：适配器模式 + 注册机制**

```go
// 统一接口
type VendorClient interface {
    GetRegions() ([]*Region, error)
    GetInstances(region string) ([]*Instance, error)
}

// 自动注册
func init() {
    cloudvendor.Register("aws", &AWSClient{})
    cloudvendor.Register("tencent_cloud", &TencentClient{})
}
```

**理由**：
- ✅ 统一接口屏蔽差异
- ✅ 插件化扩展新云平台
- ✅ 云平台特有信息存JSONB

---

## 🚀 实施路线图

### Phase 1: 基础数据模型（1-2周）

**目标**：建立核心数据模型和数据库表

#### 1.1 数据库设计

**优先级：P0（最高）**

```bash
任务清单：
□ 创建 cloud_accounts 表（云账号）
□ 创建 network_spaces 表（网络空间/抽象的VPC）
□ 创建 hosts 表（主机，15个核心字段）
□ 创建 cloud_sync_tasks 表（同步任务）
□ 创建 cloud_sync_histories 表（同步历史）
□ 创建迁移脚本
□ 添加必要的索引和约束
```

**交付物**：
- `migrations/xxx_create_cloud_tables.up.sql`
- `migrations/xxx_create_cloud_tables.down.sql`
- 数据库设计文档

**验收标准**：
- ✓ 所有表创建成功
- ✓ 唯一性约束正确
- ✓ JSONB字段有GIN索引
- ✓ 外键关系正确

#### 1.2 Go数据结构定义

**优先级：P0**

```bash
任务清单：
□ internal/types/cloud.go（云账号、同步任务）
□ internal/types/network.go（网络空间）
□ internal/types/host.go（主机模型）
□ 定义JSONB结构体（CloudMetadata, CustomFields）
□ 添加字段验证标签
□ 编写单元测试
```

**交付物**：
- Go类型定义
- 结构体序列化/反序列化测试

**估时**：3-5天

---

### Phase 2: 云厂商抽象层（2-3周）

**目标**：实现云厂商统一接口和适配器

#### 2.1 抽象接口定义

**优先级：P0**

```bash
任务清单：
□ internal/cloudvendor/interface.go（统一接口）
□ internal/cloudvendor/registry.go（注册机制）
□ internal/cloudvendor/types.go（统一数据结构）
□ 定义Instance、VPC、Region等结构
□ 编写接口文档
```

**交付物**：
- `VendorClient` 接口
- 注册器实现
- 完整的接口文档

**估时**：2-3天

#### 2.2 AWS 适配器

**优先级：P0**

```bash
任务清单：
□ internal/cloudvendor/aws/client.go
□ 实现 GetRegions()
□ 实现 GetVPCs()
□ 实现 GetInstances()
□ 实现 GetInstanceCount()
□ 状态映射（AWS → 统一状态）
□ 错误处理和重试逻辑
□ 单元测试 + 集成测试
```

**依赖**：
- AWS SDK for Go: `github.com/aws/aws-sdk-go`

**交付物**：
- AWS适配器完整实现
- 测试覆盖率 > 80%

**估时**：3-5天

#### 2.3 腾讯云适配器

**优先级：P0**

```bash
任务清单：
□ internal/cloudvendor/tencent/client.go
□ 实现所有接口方法
□ 状态映射（腾讯云 → 统一状态）
□ 分页处理（Offset/Limit）
□ 单元测试 + 集成测试
```

**依赖**：
- Tencent Cloud SDK: `github.com/tencentcloud/tencentcloud-sdk-go`

**交付物**：
- 腾讯云适配器完整实现
- 测试覆盖率 > 80%

**估时**：3-5天

#### 2.4 阿里云适配器（可选，后续）

**优先级：P1**

```bash
任务清单：
□ internal/cloudvendor/aliyun/client.go
□ 处理vSwitch vs Subnet差异
□ 实现所有接口方法
□ 测试
```

**估时**：3-5天（可并行）

---

### Phase 3: 云同步引擎（2-3周）

**目标**：实现云资源同步核心逻辑

#### 3.1 网络空间管理

**优先级：P0**

```bash
任务清单：
□ internal/core/network/service.go
□ internal/storage/network_repository.go
□ 创建/更新/删除网络空间
□ 自动创建网络空间（云同步时）
□ 按云平台元数据查询
□ 单元测试
```

**交付物**：
- 网络空间CRUD
- Repository接口和实现
- 测试覆盖率 > 80%

**估时**：2-3天

#### 3.2 主机管理服务

**优先级：P0**

```bash
任务清单：
□ internal/core/host/service.go
□ internal/storage/host_repository.go
□ 主机CRUD操作
□ 按多种方式查询主机：
  - 按ID
  - 按(network_space, IP)
  - 按云实例ID
  - 按自定义字段（JSONB查询）
□ 主机状态管理
□ 标记删除逻辑
□ 单元测试
```

**交付物**：
- 主机管理完整实现
- 智能查询功能
- 测试覆盖率 > 80%

**估时**：3-5天

#### 3.3 同步引擎核心

**优先级：P0**

```bash
任务清单：
□ internal/cloudsync/engine.go
□ 按Region同步逻辑
□ VPC自动发现
□ VPC过滤器实现
□ 差异对比算法（Diff）
  - 新增主机
  - 更新主机
  - 标记删除（destroyed）
□ 事务处理
□ 错误处理和重试
□ 同步历史记录
□ 单元测试
```

**关键逻辑**：
```go
func (e *Engine) SyncRegion(accountID, region string) error {
    // 1. 获取云厂商客户端
    // 2. 获取Region下所有VPC
    // 3. 应用VPC过滤
    // 4. 遍历VPC获取主机
    // 5. 执行差异对比
    // 6. 创建/更新/标记删除
    // 7. 记录同步历史
}
```

**交付物**：
- 同步引擎完整实现
- 差异对比算法
- 事务处理
- 测试覆盖率 > 80%

**估时**：5-7天

#### 3.4 定时调度器

**优先级：P1**

```bash
任务清单：
□ internal/cloudsync/scheduler.go
□ Cron表达式解析
□ 定时任务调度
□ 并发控制（同一任务不重复执行）
□ 任务队列管理
□ 测试
```

**依赖**：
- Cron库: `github.com/robfig/cron/v3`

**交付物**：
- 调度器实现
- 并发控制

**估时**：2-3天

---

### Phase 4: API 接口（1-2周）

**目标**：提供完整的HTTP API

#### 4.1 云账号管理 API

**优先级：P0**

```bash
任务清单：
□ internal/api/handlers/cloud_account_handler.go
□ POST   /api/v1/cloud/accounts（创建）
□ GET    /api/v1/cloud/accounts（列表）
□ GET    /api/v1/cloud/accounts/:id（详情）
□ PUT    /api/v1/cloud/accounts/:id（更新）
□ DELETE /api/v1/cloud/accounts/:id（删除）
□ POST   /api/v1/cloud/accounts/:id/test（测试连接）
□ Handler测试
```

**交付物**：
- 云账号管理API
- 敏感信息加密存储
- 测试覆盖率 > 80%

**估时**：2-3天

#### 4.2 同步任务管理 API

**优先级：P0**

```bash
任务清单：
□ internal/api/handlers/cloud_sync_handler.go
□ POST   /api/v1/cloud/sync-tasks（创建任务）
□ GET    /api/v1/cloud/sync-tasks（任务列表）
□ GET    /api/v1/cloud/sync-tasks/:id（任务详情）
□ PUT    /api/v1/cloud/sync-tasks/:id（更新任务）
□ DELETE /api/v1/cloud/sync-tasks/:id（删除任务）
□ POST   /api/v1/cloud/sync-tasks/:id/trigger（手动触发）
□ GET    /api/v1/cloud/sync-tasks/:id/histories（同步历史）
□ Handler测试
```

**交付物**：
- 同步任务管理API
- 手动触发功能
- 测试覆盖率 > 80%

**估时**：3-4天

#### 4.3 主机管理 API

**优先级：P0**

```bash
任务清单：
□ internal/api/handlers/host_handler.go
□ GET    /api/v1/hosts（主机列表，支持过滤）
□ GET    /api/v1/hosts/:id（主机详情）
□ PUT    /api/v1/hosts/:id（更新主机）
□ DELETE /api/v1/hosts/:id（删除主机）
□ PUT    /api/v1/hosts/:id/custom-fields（更新自定义字段）
□ 支持按自定义字段查询
□ 支持按云平台标识查询
□ Handler测试
```

**查询示例**：
```bash
# 按网络空间查询
GET /api/v1/hosts?network_space_id=xxx

# 按云实例ID查询
GET /api/v1/hosts?cloud_instance_id=i-abc123

# 按自定义字段查询
GET /api/v1/hosts?custom_fields.department=技术部

# 排除已销毁主机
GET /api/v1/hosts?include_destroyed=false
```

**交付物**：
- 主机管理API
- 灵活的查询功能
- 测试覆盖率 > 80%

**估时**：3-4天

#### 4.4 网络空间管理 API

**优先级：P1**

```bash
任务清单：
□ internal/api/handlers/network_space_handler.go
□ GET    /api/v1/network-spaces（列表）
□ GET    /api/v1/network-spaces/:id（详情）
□ GET    /api/v1/network-spaces/:id/hosts（该空间下的主机）
□ Handler测试
```

**交付物**：
- 网络空间查询API
- 测试覆盖率 > 80%

**估时**：1-2天

---

### Phase 5: 前端集成（可选，2-3周）

**目标**：提供Web界面管理云资源

#### 5.1 云账号管理页面

```bash
任务清单：
□ 云账号列表
□ 添加云账号表单（支持AWS/腾讯云/阿里云）
□ 测试连接功能
□ 编辑/删除云账号
```

**估时**：3-5天

#### 5.2 同步任务管理页面

```bash
任务清单：
□ 同步任务列表
□ 创建同步任务向导
  - 选择云账号
  - 选择Region
  - 配置VPC过滤（可选）
  - 设置调度时间
□ 手动触发同步按钮
□ 查看同步历史
□ 同步进度实时显示
```

**估时**：5-7天

#### 5.3 主机列表和详情页

```bash
任务清单：
□ 主机列表页（支持过滤、搜索）
□ 主机详情页
  - 基本信息
  - 网络信息
  - 硬件配置
  - 云平台元数据
  - 自定义字段编辑
□ 批量操作
```

**估时**：5-7天

---

### Phase 6: 监控和优化（持续）

**目标**：保证系统稳定性和性能

#### 6.1 监控告警

```bash
任务清单：
□ 同步任务失败告警
□ 云账号连接失败告警
□ 同步耗时监控
□ API性能监控
□ 错误日志聚合
```

**估时**：3-5天

#### 6.2 性能优化

```bash
任务清单：
□ JSONB查询优化（GIN索引）
□ 大规模同步性能优化（批量处理）
□ 数据库连接池优化
□ 缓存策略（Redis）
□ API响应时间优化
```

**估时**：5-7天

#### 6.3 安全加固

```bash
任务清单：
□ 云账号密钥加密存储
□ API认证和授权
□ 操作审计日志
□ 敏感信息脱敏
□ HTTPS强制
```

**估时**：3-5天

---

## 📅 时间线（总计约 8-12周）

```
Week 1-2:   Phase 1 - 基础数据模型
Week 3-5:   Phase 2 - 云厂商抽象层（AWS + 腾讯云）
Week 6-8:   Phase 3 - 云同步引擎
Week 9-10:  Phase 4 - API 接口
Week 11-13: Phase 5 - 前端集成（可选）
持续:       Phase 6 - 监控和优化
```

**关键里程碑**：

- **M1 (Week 2)**: 数据模型完成，可以手动创建主机
- **M2 (Week 5)**: AWS/腾讯云适配器完成，可以调用云API
- **M3 (Week 8)**: 云同步引擎完成，可以同步AWS主机
- **M4 (Week 10)**: API接口完成，可以通过API管理
- **M5 (Week 13)**: 前端完成，完整的产品交付

---

## 🎯 优先级说明

| 优先级 | 说明 | 示例 |
|--------|------|------|
| **P0** | 核心功能，必须实现 | 数据模型、AWS适配器、同步引擎 |
| **P1** | 重要功能，尽快实现 | 阿里云适配器、定时调度、网络空间API |
| **P2** | 增强功能，有时间再做 | 监控告警、性能优化 |
| **P3** | 可选功能，未来考虑 | 前端页面、高级分析 |

---

## 🔧 技术栈确认

### 后端

```
语言: Go 1.21+
框架: Gin
ORM: GORM
数据库: PostgreSQL 15+ (JSONB支持)
定时任务: robfig/cron
云SDK:
  - AWS: github.com/aws/aws-sdk-go
  - 腾讯云: github.com/tencentcloud/tencentcloud-sdk-go
  - 阿里云: github.com/aliyun/alibaba-cloud-sdk-go
测试: testify/assert, testify/mock
```

### 前端（可选）

```
框架: Vue 3 / React
UI库: Element Plus / Ant Design
状态管理: Pinia / Redux
HTTP: Axios
```

### DevOps

```
容器化: Docker
编排: Kubernetes (可选)
CI/CD: GitHub Actions
监控: Prometheus + Grafana
日志: ELK / Loki
```

---

## 📊 风险评估

### 高风险项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 云API限流导致同步失败 | 高 | 实现退避重试、限流控制 |
| 大规模同步性能问题 | 高 | 批量处理、并发控制、分页 |
| 云平台差异导致适配复杂 | 中 | 充分的抽象层设计、完善测试 |
| JSONB查询性能 | 中 | GIN索引、查询优化 |

### 技术难点

1. **云平台差异处理**
   - 不同云的API差异
   - 网络概念差异（VPC vs vSwitch）
   - 状态映射

2. **大规模同步**
   - 数千台主机的同步性能
   - 事务处理
   - 并发控制

3. **数据一致性**
   - 云上数据变化与本地同步
   - 并发修改冲突
   - IP变更处理

---

## 🚦 下一步行动（立即开始）

### Week 1: Phase 1 启动

**Day 1-2: 数据库设计**
```bash
□ 创建迁移文件
□ 编写建表SQL
□ 添加索引和约束
□ Code Review
```

**Day 3-4: Go类型定义**
```bash
□ 定义所有数据结构
□ 添加GORM标签
□ 编写序列化测试
□ Code Review
```

**Day 5: 集成测试**
```bash
□ 数据库迁移测试
□ CRUD基础测试
□ 文档更新
```

**输出**：
- ✅ 数据库表创建完成
- ✅ Go类型定义完成
- ✅ 基础测试通过
- ✅ 可以进入Phase 2

---

## 📝 文档清单

### 技术文档（已完成）

- [x] `docs/BK_CMDB_ANALYSIS_AND_DESIGN.md` - BK-CMDB功能分析
- [x] `docs/CLOUD_HOST_LIFECYCLE.md` - 云主机生命周期
- [x] `docs/HOST_IDENTIFIER_STRATEGY.md` - 主机标识策略
- [x] `docs/IP_CONFLICT_SOLUTION_EVALUATION.md` - IP冲突解决方案
- [x] `docs/CLOUD_NETWORK_ABSTRACTION.md` - 云网络抽象
- [x] `docs/HOST_FIELDS_DESIGN.md` - 主机字段设计
- [x] `docs/DELETE_BUSINESS_FEATURE.md` - 业务删除功能

### 待创建文档

- [ ] `docs/CLOUD_SYNC_DESIGN.md` - 云同步详细设计
- [ ] `docs/API_SPECIFICATION.md` - API规范文档
- [ ] `docs/DEPLOYMENT_GUIDE.md` - 部署指南
- [ ] `docs/DEVELOPMENT_GUIDE.md` - 开发指南

---

## 💡 建议

1. **先做MVP**
   - 只支持AWS + 腾讯云
   - 手动触发同步（不做定时调度）
   - 简化前端（或暂不做前端）
   - 快速验证核心流程

2. **并行开发**
   - 数据模型 + 云适配器可以并行
   - AWS适配器 + 腾讯云适配器可以并行
   - 后端API + 前端页面可以并行

3. **持续集成**
   - 每个Phase完成后集成测试
   - 不要等到全部完成才测试
   - 及早发现问题

4. **用户反馈**
   - M1完成后给用户Demo
   - 收集反馈，调整优先级
   - 迭代优化

---

## ❓ 需要确认的问题

1. **云平台优先级**
   - AWS + 腾讯云 是否足够？
   - 阿里云是否必须？
   - 华为云/Azure是否需要？

2. **前端需求**
   - 是否需要Web界面？
   - 还是纯API就可以？

3. **部署方式**
   - 单机部署还是集群？
   - Docker还是直接运行？
   - 是否需要K8s？

4. **性能要求**
   - 预计管理多少台主机？
   - 同步频率要求？
   - 响应时间要求？

5. **人力配置**
   - 几个人开发？
   - 技术栈是否熟悉？
   - 是否需要培训？

---

## 📌 总结

**核心目标**：
- 实现云主机自动同步和管理
- 支持AWS、腾讯云（可扩展阿里云）
- 简洁的主机模型（15个核心字段 + JSONB扩展）
- 抽象化网络模型（不直接映射VPC）
- Region级别同步（自动发现VPC）

**技术亮点**：
- 适配器模式实现多云支持
- JSONB灵活扩展
- 标记删除保留审计
- 智能查询和过滤

**预期时间**：
- MVP: 6-8周
- 完整版: 10-13周

**下一步**：
- 确认优先级和需求
- 启动Phase 1：数据模型设计
- 开始编码！🚀
