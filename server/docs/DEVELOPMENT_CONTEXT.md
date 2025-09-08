# WEND CMDB Backend 开发上下文文档

## 🎯 项目开发历程和决策过程

### 开发背景
这个项目是从零开始构建的企业级CMDB(配置管理数据库)系统，目的是为企业提供完整的IT资产管理和业务拓扑功能。

### 关键开发决策

#### 1. 架构演进决策过程

**初始阶段 - 快速验证**
- **目标**: 快速验证概念，为前端提供联调接口
- **选择**: 单体架构 + 内存数据
- **实现**: `cmd/simple-server/main.go`
- **优势**: 开发速度快，部署简单
- **局限**: 不适合生产环境，扩展性有限

**分析阶段 - 学习最佳实践**
- **参考项目**: bk-cmdb (蓝鲸配置平台)
- **发现**: 分表存储架构的优势
- **关键洞察**: 
  ```
  树形表 vs 分表存储:
  - 树形表: 开发快，但扩展性差
  - 分表存储: 复杂度高，但企业级扩展性好
  ```
- **决策**: 重构为分表架构

**重构阶段 - 企业级架构**
- **目标**: 构建可扩展的企业级架构
- **选择**: 分表存储 + 微服务设计
- **实现**: `cmd/business-server/main.go` + 分表Schema
- **优势**: 高扩展性，高性能，易维护

#### 2. 技术栈选择决策

**数据库选择: PostgreSQL vs MongoDB**
```
PostgreSQL优势:
✅ ACID事务支持
✅ 强类型约束
✅ 复杂查询能力
✅ 成熟的运维工具

MongoDB优势:
✅ 文档型存储
✅ 水平扩展
✅ 灵活的Schema

最终选择: PostgreSQL
理由: 企业级CMDB需要强一致性和复杂关系查询
```

**API框架选择: Gin vs Echo vs Fiber**
```
Gin优势:
✅ 性能优秀
✅ 生态完善
✅ 文档丰富
✅ 中间件丰富

最终选择: Gin
理由: 平衡了性能和生态完整性
```

#### 3. 架构设计决策

**业务拓扑层级设计**
```
参考bk-cmdb的层级:
Business -> Set -> Module

我们的层级设计:
Business -> BusinessSet -> Cluster -> Module

设计理由:
1. BusinessSet比Set更明确业务含义
2. Cluster层级适应云原生环境
3. 4层结构提供更好的组织灵活性
```

**数据模型设计原则**
1. **UUID主键**: 分布式友好，避免ID冲突
2. **JSONB元数据**: 灵活扩展，无需频繁变更Schema
3. **外键约束**: 保证数据完整性
4. **级联删除**: 自动清理孤儿数据
5. **时间戳**: 审计和排查需求

## 🏗️ 核心设计模式和理念

### 1. 领域驱动设计(DDD)
```go
// 业务领域清晰分离
/internal/core/business/     // 业务管理领域
/internal/core/topology/     // 拓扑管理领域
/internal/core/instance/     // 实例管理领域
/internal/core/auth/         // 认证授权领域
```

### 2. 分层架构
```
API层 (Gin Controllers)
  ↓
业务逻辑层 (Services)
  ↓
数据访问层 (Repositories)
  ↓
数据存储层 (PostgreSQL/Redis)
```

### 3. 仓储模式(Repository Pattern)
```go
type BusinessRepository interface {
    CreateBusiness(ctx context.Context, business *Business) error
    GetBusinessByID(ctx context.Context, id uuid.UUID) (*Business, error)
    ListBusinesses(ctx context.Context, options *QueryOptions) ([]*Business, error)
    UpdateBusiness(ctx context.Context, business *Business) error
    DeleteBusiness(ctx context.Context, id uuid.UUID) error
}
```

### 4. 依赖注入
```go
// 构造函数注入
func NewBusinessService(
    businessRepo BusinessRepository,
    businessSetRepo BusinessSetRepository,
    clusterRepo ClusterRepository,
    moduleRepo ModuleRepository,
) BusinessService
```

## 📊 数据库设计深度解析

### 1. 表关系设计

```sql
-- 主键关系链
businesses (1) -> (N) business_sets (1) -> (N) clusters (1) -> (N) modules (1) -> (N) module_instances

-- 实际的外键约束
business_sets.business_id -> businesses.id
clusters.business_set_id -> business_sets.id  
modules.cluster_id -> clusters.id
module_instances.module_id -> modules.id
```

### 2. 索引策略
```sql
-- 查询性能优化
CREATE INDEX idx_businesses_status ON businesses(status);
CREATE INDEX idx_businesses_tenant ON businesses(tenant_id);
CREATE INDEX idx_business_sets_business ON business_sets(business_id);
CREATE INDEX idx_clusters_business_set ON clusters(business_set_id);
CREATE INDEX idx_modules_cluster ON modules(cluster_id);
CREATE INDEX idx_module_instances_module ON module_instances(module_id);
```

### 3. 数据完整性保证
```sql
-- 约束检查
CONSTRAINT businesses_status_check CHECK (status IN (1, 2, 3))
CONSTRAINT modules_type_check CHECK (module_type IN (1, 2, 3, 4))
CONSTRAINT module_instances_unique UNIQUE (module_id, instance_id)
```

## 🔧 代码架构深度分析

### 1. 服务层设计模式

**业务服务接口设计**
```go
type BusinessService interface {
    // CRUD操作
    CreateBusiness(ctx context.Context, req *CreateBusinessRequest) (*Business, error)
    GetBusinessByID(ctx context.Context, id uuid.UUID) (*Business, error)
    UpdateBusiness(ctx context.Context, id uuid.UUID, req *UpdateBusinessRequest) (*Business, error)
    DeleteBusiness(ctx context.Context, id uuid.UUID) error
    
    // 查询操作
    ListBusinesses(ctx context.Context, options *QueryOptions) ([]*Business, *Pagination, error)
    
    // 业务逻辑操作
    ArchiveBusiness(ctx context.Context, id uuid.UUID) error
    GetBusinessTree(ctx context.Context, businessID uuid.UUID) (*BusinessTreeNode, error)
    GetBusinessTopologyStats(ctx context.Context) (*BusinessTopologyStats, error)
}
```

**设计原则**:
1. **接口隔离**: 每个方法职责单一
2. **上下文传递**: 使用context.Context支持取消和超时
3. **错误处理**: 返回具体的错误信息
4. **类型安全**: 使用强类型参数和返回值

### 2. HTTP API设计模式

**RESTful API设计**
```go
// 资源型API
businessAPI := r.Group("/api/v1/businesses")
{
    businessAPI.POST("", server.createBusiness)           // 创建
    businessAPI.GET("", server.listBusinesses)            // 列表
    businessAPI.GET("/:id", server.getBusiness)           // 详情
    businessAPI.PUT("/:id", server.updateBusiness)        // 更新
    businessAPI.DELETE("/:id", server.deleteBusiness)     // 删除
}

// 功能型API
topologyAPI := r.Group("/api/v1/topology")
{
    topologyAPI.GET("/businesses/:id/tree", server.getBusinessTree)
    topologyAPI.GET("/stats", server.getTopologyStats)
}
```

**HTTP状态码约定**
- `200 OK`: 成功操作
- `201 Created`: 创建成功
- `400 Bad Request`: 请求参数错误
- `401 Unauthorized`: 未认证
- `403 Forbidden`: 权限不足
- `404 Not Found`: 资源不存在
- `409 Conflict`: 资源冲突
- `500 Internal Server Error`: 服务器错误

### 3. 错误处理模式

**统一错误响应格式**
```go
type ErrorResponse struct {
    Success bool   `json:"success"`
    Error   *Error `json:"error"`
}

type Error struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    Details string `json:"details,omitempty"`
}
```

**错误处理中间件**
```go
func ErrorHandlerMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Next()
        
        if len(c.Errors) > 0 {
            err := c.Errors.Last()
            c.JSON(http.StatusInternalServerError, ErrorResponse{
                Success: false,
                Error: &Error{
                    Code:    "INTERNAL_ERROR",
                    Message: err.Error(),
                },
            })
        }
    }
}
```

## 🐳 容器化和部署策略

### 1. Docker镜像构建策略

**多阶段构建优化**
```dockerfile
# 构建阶段 - 编译Go应用
FROM golang:1.21-alpine AS builder
WORKDIR /app
RUN go mod init && go get dependencies
COPY main.go .
RUN CGO_ENABLED=0 GOOS=linux go build -o app main.go

# 运行阶段 - 最小化镜像
FROM alpine:3.18
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY --from=builder /app/app .
CMD ["./app"]
```

**镜像优化原则**:
1. **多阶段构建**: 减少最终镜像大小
2. **最小基础镜像**: alpine而非ubuntu
3. **非root用户**: 安全最佳实践
4. **健康检查**: 支持容器编排

### 2. Docker Compose编排

**服务依赖关系**
```yaml
services:
  postgres:
    # 数据库服务
    healthcheck: 
      test: ["CMD-SHELL", "pg_isready"]
  
  redis:
    # 缓存服务  
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
  
  business-server:
    # 应用服务
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_healthy }
```

**网络和存储设计**
- **网络隔离**: 自定义bridge网络
- **数据持久化**: 命名卷存储
- **配置管理**: 环境变量 + 配置文件

## 🧪 测试策略和质量保证

### 1. 测试分层策略

**测试金字塔**
```
E2E Tests (少量)
  ↑
Integration Tests (适量)  
  ↑
Unit Tests (大量)
```

### 2. API测试设计

**测试脚本结构** (`scripts/test-business-api.sh`)
```bash
# 1. 健康检查测试
test_endpoint "GET" "/health" "Health check"

# 2. 基础CRUD测试
test_endpoint "POST" "/api/v1/businesses" "Create business" "$create_data"
test_endpoint "GET" "/api/v1/businesses" "List businesses"

# 3. 业务逻辑测试
test_endpoint "GET" "/api/v1/topology/stats" "Topology statistics"

# 4. 兼容性测试
test_endpoint "GET" "/api/v1/business" "Legacy API compatibility"

# 5. 性能测试
run_performance_test "/health" "Health endpoint performance"

# 6. 并发测试
run_concurrent_test "/api/v1/businesses" 10 "Concurrent requests"
```

### 3. 质量检查清单

**代码质量**
- [ ] Go代码符合gofmt标准
- [ ] 错误处理完整
- [ ] 日志记录适当
- [ ] 注释清晰
- [ ] 无安全漏洞

**API质量**
- [ ] 统一的响应格式
- [ ] 适当的HTTP状态码
- [ ] 完整的错误处理
- [ ] 输入验证
- [ ] 文档完整

**数据库质量**
- [ ] 外键约束正确
- [ ] 索引优化
- [ ] 事务处理
- [ ] 数据完整性
- [ ] 性能优化

## 🔄 版本控制和发布策略

### 1. Git工作流

**分支策略**
```
main                 # 生产环境代码
  ↑
develop             # 开发环境代码
  ↑
feature/xxx         # 功能开发分支
hotfix/xxx          # 紧急修复分支
```

### 2. 版本号规范

**语义化版本控制**
```
MAJOR.MINOR.PATCH
2.0.0 - 分表架构重构 (破坏性变更)
1.1.0 - 新增业务拓扑功能 (向后兼容)
1.0.1 - 修复健康检查bug (补丁版本)
```

### 3. 发布检查清单

**发布前检查**
- [ ] 所有测试通过
- [ ] 文档更新完整
- [ ] 版本号正确
- [ ] Docker镜像构建成功
- [ ] 数据库迁移脚本准备
- [ ] 回滚方案准备

## 🔐 安全设计考虑

### 1. 认证授权设计

**JWT + RBAC架构**
```go
type User struct {
    ID       uuid.UUID `json:"id"`
    Username string    `json:"username"`
    Email    string    `json:"email"`
    Roles    []Role    `json:"roles"`
}

type Role struct {
    ID          uuid.UUID    `json:"id"`
    Name        string       `json:"name"`
    Permissions []Permission `json:"permissions"`
}

type Permission struct {
    Resource string `json:"resource"` // business, cluster, module
    Action   string `json:"action"`   // create, read, update, delete
}
```

### 2. 数据安全

**敏感数据处理**
- 密码: bcrypt哈希
- API密钥: 加密存储
- 日志: 脱敏处理
- 传输: HTTPS/TLS

**SQL注入防护**
```go
// 使用参数化查询
query := "SELECT * FROM businesses WHERE id = $1 AND tenant_id = $2"
err := db.QueryRowContext(ctx, query, businessID, tenantID).Scan(...)

// 避免字符串拼接
// 错误示例: query := fmt.Sprintf("SELECT * FROM businesses WHERE name = '%s'", name)
```

## 📈 性能优化策略

### 1. 数据库性能优化

**查询优化**
```sql
-- 使用索引
EXPLAIN ANALYZE SELECT * FROM businesses WHERE status = 1;

-- 分页查询
SELECT * FROM businesses 
WHERE tenant_id = $1 
ORDER BY created_at DESC 
LIMIT $2 OFFSET $3;

-- 避免N+1查询
SELECT b.*, bs.* 
FROM businesses b 
LEFT JOIN business_sets bs ON b.id = bs.business_id 
WHERE b.tenant_id = $1;
```

**连接池优化**
```go
db.SetMaxOpenConns(25)        // 最大连接数
db.SetMaxIdleConns(5)         // 最大空闲连接数
db.SetConnMaxLifetime(time.Hour) // 连接最大生命周期
```

### 2. 应用性能优化

**缓存策略**
```go
// Redis缓存热点数据
func (s *BusinessService) GetBusinessByID(ctx context.Context, id uuid.UUID) (*Business, error) {
    // 1. 先查缓存
    if cached := s.cache.Get(ctx, "business:"+id.String()); cached != nil {
        return cached.(*Business), nil
    }
    
    // 2. 查数据库
    business, err := s.repo.GetBusinessByID(ctx, id)
    if err != nil {
        return nil, err
    }
    
    // 3. 写缓存
    s.cache.Set(ctx, "business:"+id.String(), business, time.Hour)
    return business, nil
}
```

**并发处理**
```go
// 使用goroutine并发处理
func (s *BusinessService) GetBusinessesWithStats(ctx context.Context) (*BusinessesWithStats, error) {
    var businesses []*Business
    var stats *Stats
    var wg sync.WaitGroup
    var mu sync.Mutex
    var errs []error
    
    wg.Add(2)
    
    // 并发获取业务列表
    go func() {
        defer wg.Done()
        result, err := s.ListBusinesses(ctx, &QueryOptions{})
        mu.Lock()
        if err != nil {
            errs = append(errs, err)
        } else {
            businesses = result
        }
        mu.Unlock()
    }()
    
    // 并发获取统计信息
    go func() {
        defer wg.Done()
        result, err := s.GetBusinessTopologyStats(ctx)
        mu.Lock()
        if err != nil {
            errs = append(errs, err)
        } else {
            stats = result
        }
        mu.Unlock()
    }()
    
    wg.Wait()
    
    if len(errs) > 0 {
        return nil, errs[0]
    }
    
    return &BusinessesWithStats{
        Businesses: businesses,
        Stats:      stats,
    }, nil
}
```

## 🔮 未来扩展规划

### 1. 微服务拆分规划

**服务拆分边界**
```
business-service     # 业务管理服务
topology-service     # 拓扑管理服务  
instance-service     # 实例管理服务
auth-service        # 认证授权服务
notification-service # 通知服务
audit-service       # 审计服务
```

### 2. 技术栈演进

**当前技术栈**
- Go + Gin + SQLX + PostgreSQL + Redis

**未来技术栈考虑**
- 消息队列: Apache Kafka / RabbitMQ
- 服务网格: Istio
- 监控: Prometheus + Grafana + Jaeger
- 日志: ELK Stack
- 容器编排: Kubernetes

### 3. 功能扩展规划

**短期功能** (1-3个月)
- 实时数据库操作
- 完整的CRUD实现
- 基础认证授权
- 批量操作支持

**中期功能** (3-6个月)
- 插件系统
- 事件系统
- 工作流引擎
- 图形化界面

**长期功能** (6-12个月)
- AI智能运维
- 自动化部署
- 多云管理
- 成本优化

## 📝 开发注意事项

### 1. 代码开发规范

**命名约定**
```go
// 包名: 小写，简短
package business

// 接口名: 动词+er或名词+Interface
type BusinessManager interface{}
type BusinessRepository interface{}

// 结构体: 大驼峰
type BusinessService struct{}

// 方法名: 大驼峰，动词开头
func (s *BusinessService) CreateBusiness() {}

// 变量名: 小驼峰
var businessID uuid.UUID
```

**错误处理约定**
```go
// 返回具体错误
func (s *BusinessService) CreateBusiness(req *CreateBusinessRequest) (*Business, error) {
    if req.Name == "" {
        return nil, fmt.Errorf("business name is required")
    }
    
    if exists, err := s.repo.ExistsByName(req.Name); err != nil {
        return nil, fmt.Errorf("failed to check business existence: %w", err)
    } else if exists {
        return nil, fmt.Errorf("business with name '%s' already exists", req.Name)
    }
    
    // ...
}
```

### 2. 数据库操作规范

**事务处理**
```go
func (s *BusinessService) CreateBusinessWithSets(req *CreateBusinessWithSetsRequest) error {
    return s.db.Transaction(func(tx *sql.Tx) error {
        // 1. 创建业务
        business, err := s.createBusiness(ctx, tx, req.Business)
        if err != nil {
            return err
        }
        
        // 2. 创建业务集
        for _, setReq := range req.BusinessSets {
            if err := s.createBusinessSet(ctx, tx, business.ID, setReq); err != nil {
                return err
            }
        }
        
        return nil
    })
}
```

**查询优化**
```go
// 使用预编译语句
const getBusinessByIDQuery = `
    SELECT id, name, description, owner, contact, business_type, status, metadata, created_at, updated_at
    FROM businesses 
    WHERE id = $1 AND status != $2 AND tenant_id = $3
`

func (r *BusinessRepository) GetBusinessByID(ctx context.Context, id uuid.UUID, tenantID uuid.UUID) (*Business, error) {
    var business Business
    err := r.db.QueryRowContext(ctx, getBusinessByIDQuery, id, BusinessStatusDeleted, tenantID).Scan(
        &business.ID, &business.Name, &business.Description, &business.Owner,
        &business.Contact, &business.BusinessType, &business.Status, 
        &business.Metadata, &business.CreatedAt, &business.UpdatedAt,
    )
    if err != nil {
        if err == sql.ErrNoRows {
            return nil, ErrBusinessNotFound
        }
        return nil, fmt.Errorf("failed to get business: %w", err)
    }
    return &business, nil
}
```

### 3. API开发规范

**请求验证**
```go
type CreateBusinessRequest struct {
    Name         string                 `json:"name" validate:"required,min=1,max=255"`
    Description  string                 `json:"description" validate:"max=1000"`
    Owner        string                 `json:"owner" validate:"required,min=1,max=100"`
    Contact      string                 `json:"contact" validate:"email"`
    BusinessType string                 `json:"business_type" validate:"oneof=e-commerce internal-tools external-service"`
    Metadata     map[string]interface{} `json:"metadata"`
}

func (s *BusinessServer) createBusiness(c *gin.Context) {
    var req CreateBusinessRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, ErrorResponse{
            Success: false,
            Error: &Error{
                Code:    "VALIDATION_FAILED",
                Message: "请求参数验证失败",
                Details: err.Error(),
            },
        })
        return
    }
    
    // 业务逻辑处理...
}
```

## 🎯 总结

这份文档详细记录了WEND CMDB Backend项目的完整开发过程、技术决策、架构设计和实现细节。对于新加入的开发者或AI助手，这份文档提供了：

1. **完整的项目背景**和发展历程
2. **详细的技术决策**过程和理由
3. **深入的架构设计**和代码结构
4. **实用的开发指南**和最佳实践
5. **清晰的未来规划**和扩展方向

通过这份文档，任何人都可以快速理解项目的核心概念、技术选型、设计原则和实现方法，从而有效地参与项目开发和维护工作。

---

**文档版本**: v1.0  
**最后更新**: 2025-08-27  
**维护者**: WEND CMDB Team