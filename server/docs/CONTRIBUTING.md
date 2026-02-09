# 贡献指南

欢迎为 WEND CMDB Backend 项目做出贡献！本指南将帮助你了解如何参与项目开发。

## 📋 目录

- [行为准则](#行为准则)
- [开始之前](#开始之前)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [测试要求](#测试要求)
- [Pull Request流程](#pull-request流程)

## 🤝 行为准则

我们致力于为所有贡献者提供友好、安全和开放的环境。参与本项目即表示你同意：

- 使用友好和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表现出同理心

## 🚀 开始之前

### 环境要求

- **Go**: 1.24 或更高版本
- **PostgreSQL**: 14 或更高版本
- **Git**: 版本控制
- **IDE**: 推荐使用 VS Code 或 GoLand

### 本地开发环境设置

```bash
# 1. Fork 并克隆仓库
git clone https://github.com/YOUR_USERNAME/wend-cmdb-backend.git
cd wend-cmdb-backend

# 2. 安装依赖
go mod download

# 3. 设置数据库
createdb cmdb_dev
psql cmdb_dev < migrations/schema.sql

# 4. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入数据库连接信息

# 5. 运行测试确保环境正常
go test ./...

# 6. 启动开发服务器
go run cmd/server/main.go
```

### 了解项目结构

在开始贡献之前，建议阅读以下文档：

- [系统架构](docs/ARCHITECTURE.md) - 理解系统设计
- [API文档](docs/API.md) - 了解API接口
- [测试指南](docs/TESTING.md) - 学习测试框架

## 💻 开发流程

### 1. 创建分支

```bash
# 从 main 分支创建新分支
git checkout main
git pull origin main
git checkout -b feature/your-feature-name

# 或修复bug
git checkout -b fix/bug-description
```

**分支命名规范**：
- `feature/xxx` - 新功能
- `fix/xxx` - Bug修复
- `refactor/xxx` - 代码重构
- `docs/xxx` - 文档更新
- `test/xxx` - 测试相关

### 2. 编写代码

遵循 [代码规范](#代码规范) 编写代码，确保：
- 代码清晰易懂
- 添加必要的注释
- 遵循项目的架构模式
- 不引入不必要的依赖

### 3. 运行测试

```bash
# 运行所有测试
go test ./...

# 运行特定包的测试
go test ./internal/core/business/...

# 查看覆盖率
go test ./... -cover

# 生成覆盖率报告
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out
```

### 4. 提交代码

遵循 [提交规范](#提交规范) 提交代码：

```bash
git add .
git commit -m "feat: add host batch import API"
```

### 5. 推送并创建 Pull Request

```bash
git push origin feature/your-feature-name
```

然后在 GitHub 上创建 Pull Request。

## 📝 代码规范

### Go 代码风格

遵循官方 Go 代码规范：

```bash
# 格式化代码
go fmt ./...

# 静态检查
go vet ./...

# 使用 golangci-lint（推荐）
golangci-lint run
```

### 命名规范

#### 文件命名
- 使用小写字母和下划线：`business_service.go`
- 测试文件：`business_service_test.go`

#### 变量命名
```go
// ✅ 好的命名
var userCount int
var maxRetries = 3
var dbConnection *gorm.DB

// ❌ 避免的命名
var n int
var x = 3
var db1 *gorm.DB
```

#### 函数命名
```go
// ✅ 导出函数：大写开头，清晰描述功能
func CreateBusiness(ctx context.Context, req *CreateBusinessRequest) error

// ✅ 私有函数：小写开头
func validateBusinessName(name string) error

// ❌ 避免：命名不清晰
func doStuff() error
func process() error
```

#### 接口命名
```go
// ✅ 单方法接口：动词 + er
type Reader interface {
    Read(p []byte) (n int, err error)
}

type BusinessRepository interface {
    Create(ctx context.Context, biz *types.Business) error
    FindByID(ctx context.Context, id uuid.UUID) (*types.Business, error)
}
```

### 代码组织

#### 分层架构
严格遵循三层架构：

```
Handler (API层)
  ↓ 调用
Service (业务层)
  ↓ 调用
Repository (数据层)
```

**示例**：
```go
// Handler层：只处理HTTP相关逻辑
func (h *BusinessHandler) Create(c *gin.Context) {
    var req CreateBusinessRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }

    // 调用Service层
    biz, err := h.service.Create(c.Request.Context(), &req)
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }

    c.JSON(201, biz)
}

// Service层：业务逻辑
func (s *BusinessService) Create(ctx context.Context, req *CreateBusinessRequest) (*types.Business, error) {
    // 验证
    if err := validateBusinessName(req.Name); err != nil {
        return nil, err
    }

    // 创建业务对象
    biz := &types.Business{
        ID:   uuid.New(),
        Name: req.Name,
        // ...
    }

    // 调用Repository层
    if err := s.repo.Create(ctx, biz); err != nil {
        return nil, err
    }

    return biz, nil
}

// Repository层：数据访问
func (r *BusinessRepository) Create(ctx context.Context, biz *types.Business) error {
    return r.db.WithContext(ctx).Create(biz).Error
}
```

### 错误处理

```go
// ✅ 返回有意义的错误信息
if err := validate(req); err != nil {
    return nil, fmt.Errorf("validation failed: %w", err)
}

// ✅ 使用自定义错误类型
type BusinessNotFoundError struct {
    ID uuid.UUID
}

func (e *BusinessNotFoundError) Error() string {
    return fmt.Sprintf("business not found: %s", e.ID)
}

// ❌ 避免：忽略错误
result, _ := someFunction()  // 不要这样做！
```

### 注释规范

```go
// ✅ 导出函数必须有文档注释
// CreateBusiness 创建新的业务
// 参数:
//   - ctx: 上下文
//   - req: 创建请求
// 返回:
//   - *types.Business: 创建的业务对象
//   - error: 错误信息
func CreateBusiness(ctx context.Context, req *CreateBusinessRequest) (*types.Business, error) {
    // 实现...
}

// ✅ 复杂逻辑添加说明注释
// 批量查询优化：避免N+1查询问题
// 1. 先查询所有业务
// 2. 批量查询关联的资源目录
// 3. 在内存中关联数据
businessIDs := extractIDs(businesses)
resourceDirs, err := repo.ListByBusinessIDs(ctx, businessIDs)

// ❌ 避免：无意义的注释
// 创建变量
var count int  // 不需要这样的注释
```

## 📋 提交规范

### Commit Message 格式

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type 类型

- `feat`: 新功能
- `fix`: Bug修复
- `docs`: 文档更新
- `style`: 代码格式（不影响代码运行）
- `refactor`: 重构（既不是新功能也不是Bug修复）
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

### 示例

```bash
# 新功能
git commit -m "feat(host): add batch import API"

# Bug修复
git commit -m "fix(business): resolve N+1 query issue in list API"

# 文档
git commit -m "docs: update architecture documentation"

# 性能优化
git commit -m "perf(storage): add index for host queries"

# 测试
git commit -m "test(business): add unit tests for service layer"
```

### 详细说明示例

```
feat(host): add batch import API

Add new batch import endpoint to support importing multiple hosts
at once. This improves efficiency when migrating from legacy systems.

- Add POST /api/v1/hosts/batch endpoint
- Implement transaction-based import
- Add validation for duplicate IP addresses
- Add unit tests with 80% coverage

Closes #123
```

## 🧪 测试要求

### 测试覆盖率要求

所有新增代码必须包含测试：

- **Service层**: 最低 **70%** 覆盖率
- **Repository层**: 最低 **50%** 覆盖率
- **Handler层**: 最低 **60%** 覆盖率

### 测试文件组织

```go
// business_service_test.go
package business

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

// 测试正常流程
func TestBusinessService_Create_Success(t *testing.T) {
    // Arrange
    mockRepo := new(MockBusinessRepository)
    service := NewBusinessService(mockRepo)

    ctx := context.Background()
    req := &CreateBusinessRequest{Name: "Test Business"}

    mockRepo.On("Create", ctx, mock.AnythingOfType("*types.Business")).
        Return(nil)

    // Act
    result, err := service.Create(ctx, req)

    // Assert
    assert.NoError(t, err)
    assert.NotNil(t, result)
    assert.Equal(t, "Test Business", result.Name)
    mockRepo.AssertExpectations(t)
}

// 测试错误场景
func TestBusinessService_Create_InvalidName(t *testing.T) {
    service := NewBusinessService(nil)
    ctx := context.Background()
    req := &CreateBusinessRequest{Name: ""} // 空名称

    _, err := service.Create(ctx, req)

    assert.Error(t, err)
    assert.Contains(t, err.Error(), "name is required")
}
```

### 表驱动测试（推荐）

```go
func TestValidateBusinessName(t *testing.T) {
    tests := []struct {
        name    string
        input   string
        wantErr bool
        errMsg  string
    }{
        {
            name:    "valid name",
            input:   "My Business",
            wantErr: false,
        },
        {
            name:    "empty name",
            input:   "",
            wantErr: true,
            errMsg:  "name is required",
        },
        {
            name:    "name too long",
            input:   strings.Repeat("a", 257),
            wantErr: true,
            errMsg:  "name too long",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := validateBusinessName(tt.input)
            if tt.wantErr {
                assert.Error(t, err)
                assert.Contains(t, err.Error(), tt.errMsg)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

详细测试指南参见 [TESTING.md](docs/TESTING.md)

## 🔄 Pull Request 流程

### PR 创建前检查清单

- [ ] 代码遵循项目规范
- [ ] 通过所有测试：`go test ./...`
- [ ] 代码格式化：`go fmt ./...`
- [ ] 静态检查通过：`go vet ./...`
- [ ] 新功能有对应的测试
- [ ] 测试覆盖率达标
- [ ] 更新相关文档
- [ ] Commit message 符合规范

### PR 标题格式

遵循 Commit Message 规范：

```
feat(host): add batch import API
fix(business): resolve N+1 query issue
docs: update contribution guide
```

### PR 描述模板

```markdown
## 变更类型
- [ ] 新功能
- [ ] Bug修复
- [ ] 重构
- [ ] 文档更新
- [ ] 性能优化

## 变更说明
简要描述本次PR的变更内容。

## 相关Issue
Closes #123

## 测试情况
- [ ] 添加了单元测试
- [ ] 所有测试通过
- [ ] 测试覆盖率: XX%

## 测试步骤
1. 启动服务器
2. 调用 API：`curl -X POST ...`
3. 验证结果

## 截图（如适用）
贴上相关截图

## 检查清单
- [ ] 代码遵循项目规范
- [ ] 通过所有测试
- [ ] 更新了文档
- [ ] Commit message 规范
```

### Code Review

所有PR需要至少1位维护者的审核批准。

**审核重点**：
- 代码质量和可读性
- 是否遵循架构设计
- 测试覆盖是否充分
- 性能影响
- 安全性考虑

### 合并要求

- ✅ 通过所有CI检查
- ✅ 至少1个审核批准
- ✅ 无未解决的评论
- ✅ 没有合并冲突

## 🐛 报告Bug

### Bug报告模板

在 GitHub Issues 中使用以下模板：

```markdown
## Bug描述
清晰简洁地描述Bug。

## 复现步骤
1. 执行 '...'
2. 点击 '....'
3. 滚动到 '....'
4. 看到错误

## 期望行为
描述你期望发生什么。

## 实际行为
描述实际发生了什么。

## 环境信息
- OS: [e.g. macOS 13.0]
- Go版本: [e.g. 1.24]
- PostgreSQL版本: [e.g. 14.5]
- 项目版本/commit: [e.g. v1.0.0 或 commit hash]

## 日志和错误信息
```
粘贴相关日志
```

## 截图
如适用，添加截图帮助解释问题。
```

## 💡 功能请求

### 功能请求模板

```markdown
## 功能描述
清晰简洁地描述你想要的功能。

## 使用场景
描述为什么需要这个功能，它解决什么问题。

## 建议的解决方案
描述你想要的实现方式。

## 替代方案
描述你考虑过的其他替代方案。

## 其他信息
添加任何其他相关信息或截图。
```

## 📚 学习资源

### Go语言
- [Effective Go](https://go.dev/doc/effective_go)
- [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)

### 架构设计
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Domain-Driven Design](https://martinfowler.com/tags/domain%20driven%20design.html)

### 测试
- [testify Documentation](https://github.com/stretchr/testify)
- [Table Driven Tests](https://dave.cheney.net/2019/05/07/prefer-table-driven-tests)

### 项目文档
- [系统架构](docs/ARCHITECTURE.md)
- [测试指南](docs/TESTING.md)
- [API文档](docs/API.md)

## 🙏 感谢

感谢所有为项目做出贡献的开发者！

## 📧 联系方式

如有疑问，可以通过以下方式联系：

- GitHub Issues: [项目Issues](https://github.com/wend/cmdb-backend/issues)
- Email: [项目邮箱]

---

**期待你的贡献！** 🚀
