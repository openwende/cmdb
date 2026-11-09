# 测试指南

本文档介绍 Wende CMDB Server 的测试框架、测试覆盖率以及如何编写和运行测试。

## 📊 测试覆盖率概览

当前测试覆盖率（最后更新：2026-02）：

| 模块 | 覆盖率 | 测试文件 |
|------|--------|----------|
| `internal/core/business` | 23.5% | `service_test.go` |
| `internal/core/host` | 16.8% | `service_test.go` |
| `internal/storage` | 14.0% | `business_repository_test.go`, `host_repository_test.go` |

**总计**: 50+ 个单元测试用例

## 🧪 测试框架

项目使用以下测试工具：

### testify/assert
用于断言和验证测试结果：
```go
import "github.com/stretchr/testify/assert"

assert.NoError(t, err)
assert.Equal(t, expected, actual)
assert.NotNil(t, result)
```

### testify/mock
用于创建 mock 对象，隔离依赖：
```go
import "github.com/stretchr/testify/mock"

type MockRepository struct {
    mock.Mock
}

func (m *MockRepository) Create(ctx context.Context, biz *types.Business) error {
    args := m.Called(ctx, biz)
    return args.Error(0)
}
```

## 🚀 运行测试

### 运行所有测试
```bash
go test ./...
```

### 运行特定包的测试
```bash
# 测试业务服务
go test ./internal/core/business/...

# 测试主机服务
go test ./internal/core/host/...

# 测试存储层
go test ./internal/storage/...
```

### 查看测试覆盖率
```bash
# 简单覆盖率统计
go test ./... -cover

# 生成详细覆盖率报告
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out

# 按包查看覆盖率
go test ./internal/core/business -coverprofile=coverage.out
go tool cover -func=coverage.out
```

### 运行单个测试
```bash
# 运行特定测试函数
go test ./internal/core/business -run TestBusinessService_Create

# 使用 verbose 模式
go test ./internal/core/business -v -run TestBusinessService_Create
```

## 📂 测试文件结构

测试文件遵循以下命名规范：
- 测试文件名：`<source_file>_test.go`
- 测试函数名：`Test<FunctionName>` 或 `Test<Type>_<Method>`

示例结构：
```
internal/
├── core/
│   ├── business/
│   │   ├── service.go           # 业务逻辑
│   │   └── service_test.go      # 对应的测试文件
│   └── host/
│       ├── service.go
│       └── service_test.go
└── storage/
    ├── business_repository.go
    ├── business_repository_test.go
    ├── host_repository.go
    └── host_repository_test.go
```

## ✍️ 编写测试

### 基本测试模板

```go
package business

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
)

func TestBusinessService_Create(t *testing.T) {
    // Arrange - 准备测试数据和 mock
    mockRepo := new(MockBusinessRepository)
    service := NewBusinessService(mockRepo)

    ctx := context.Background()
    business := &types.Business{
        Name: "Test Business",
    }

    // 设置 mock 期望
    mockRepo.On("Create", ctx, mock.AnythingOfType("*types.Business")).
        Return(nil)

    // Act - 执行被测试的方法
    err := service.Create(ctx, business)

    // Assert - 验证结果
    assert.NoError(t, err)
    assert.NotNil(t, business.ID)
    mockRepo.AssertExpectations(t)
}
```

### 表驱动测试

对于需要测试多个场景的函数，使用表驱动测试：

```go
func TestBusinessService_Validate(t *testing.T) {
    tests := []struct {
        name    string
        input   *types.Business
        wantErr bool
        errMsg  string
    }{
        {
            name:    "valid business",
            input:   &types.Business{Name: "Valid Name"},
            wantErr: false,
        },
        {
            name:    "empty name",
            input:   &types.Business{Name: ""},
            wantErr: true,
            errMsg:  "business name is required",
        },
        {
            name:    "name too long",
            input:   &types.Business{Name: strings.Repeat("a", 256)},
            wantErr: true,
            errMsg:  "business name too long",
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := validateBusiness(tt.input)
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

## 🎭 使用 Mock 对象

### 创建 Mock Repository

```go
// MockBusinessRepository 用于测试的 mock 对象
type MockBusinessRepository struct {
    mock.Mock
}

func (m *MockBusinessRepository) Create(ctx context.Context, biz *types.Business) error {
    args := m.Called(ctx, biz)
    return args.Error(0)
}

func (m *MockBusinessRepository) FindByID(ctx context.Context, id int64) (*types.Business, error) {
    args := m.Called(ctx, id)
    if args.Get(0) == nil {
        return nil, args.Error(1)
    }
    return args.Get(0).(*types.Business), args.Error(1)
}
```

### 设置 Mock 期望

```go
// 成功场景
mockRepo.On("Create", ctx, mock.AnythingOfType("*types.Business")).
    Return(nil)

// 返回特定对象
mockRepo.On("FindByID", ctx, int64(1)).
    Return(&types.Business{ID: 1, Name: "Test"}, nil)

// 返回错误
mockRepo.On("Create", ctx, mock.Anything).
    Return(errors.New("database error"))

// 验证调用
mockRepo.AssertExpectations(t)
mockRepo.AssertCalled(t, "Create", ctx, mock.Anything)
mockRepo.AssertNumberOfCalls(t, "Create", 1)
```

## 📋 测试清单

编写新功能时，确保：

- [ ] 为新增的 service 方法编写单元测试
- [ ] 为新增的 repository 方法编写单元测试
- [ ] 测试正常流程（happy path）
- [ ] 测试错误处理（error cases）
- [ ] 测试边界条件（edge cases）
- [ ] 测试输入验证（input validation）
- [ ] 使用 mock 隔离外部依赖
- [ ] 测试覆盖率 > 70%（目标）

## 🎯 测试最佳实践

### 1. 测试命名
使用清晰的测试名称，描述测试场景：
```go
// Good
func TestBusinessService_Create_WithValidInput_ShouldSucceed(t *testing.T)
func TestBusinessService_Create_WithEmptyName_ShouldReturnError(t *testing.T)

// Bad
func TestCreate1(t *testing.T)
func TestCreateFails(t *testing.T)
```

### 2. AAA 模式
遵循 Arrange-Act-Assert 模式：
```go
func TestExample(t *testing.T) {
    // Arrange - 准备测试数据
    input := prepareTestData()

    // Act - 执行操作
    result, err := functionUnderTest(input)

    // Assert - 验证结果
    assert.NoError(t, err)
    assert.Equal(t, expected, result)
}
```

### 3. 隔离测试
每个测试应该独立运行，不依赖其他测试：
```go
// Good - 每个测试创建自己的数据
func TestA(t *testing.T) {
    data := createTestData()
    // ...
}

func TestB(t *testing.T) {
    data := createTestData()
    // ...
}

// Bad - 测试之间共享状态
var sharedData *Data

func TestA(t *testing.T) {
    sharedData = createTestData()
}

func TestB(t *testing.T) {
    // 依赖 TestA
    useData(sharedData)
}
```

### 4. 测试数据工厂
使用工厂函数创建测试数据：
```go
// testdata.go
func NewTestBusiness(overrides ...func(*types.Business)) *types.Business {
    biz := &types.Business{
        Name:      "Test Business",
        Lifecycle: types.Testing,
        // ... 默认值
    }

    for _, override := range overrides {
        override(biz)
    }

    return biz
}

// 使用
func TestExample(t *testing.T) {
    biz := NewTestBusiness(func(b *types.Business) {
        b.Name = "Custom Name"
    })
}
```

## 🔍 性能测试改进

项目最近修复了 N+1 查询问题，性能测试示例：

```go
func BenchmarkListBusinesses(b *testing.B) {
    // 准备测试数据
    db := setupTestDB()
    repo := storage.NewBusinessRepository(db)

    // 创建 100 个业务
    for i := 0; i < 100; i++ {
        createTestBusiness(repo, i)
    }

    b.ResetTimer()
    for i := 0; i < b.N; i++ {
        _, err := repo.List(context.Background(), &storage.ListOptions{
            Limit: 10,
        })
        if err != nil {
            b.Fatal(err)
        }
    }
}
```

## 📈 提高覆盖率

### 当前优先级
1. **核心业务逻辑** - business service, host service
2. **数据访问层** - repositories
3. **API handlers** - 输入验证和错误处理
4. **工具函数** - 辅助函数

### 下一步目标
- [ ] business service 覆盖率 > 70%
- [ ] host service 覆盖率 > 70%
- [ ] storage layer 覆盖率 > 50%
- [ ] 总体覆盖率 > 40%

## 🐛 测试调试

### 查看详细输出
```bash
go test -v ./internal/core/business
```

### 只运行失败的测试
```bash
go test -v ./... -run TestThatFailed
```

### 使用 debugger
在 VS Code 中，在测试函数上方点击 "debug test" 即可调试单个测试。

## 📚 参考资源

- [Go Testing Package](https://pkg.go.dev/testing)
- [testify Documentation](https://github.com/stretchr/testify)
- [Go Test Best Practices](https://go.dev/doc/tutorial/add-a-test)

## 💡 常见问题

**Q: 为什么需要 mock？**
A: Mock 对象可以隔离外部依赖（数据库、API等），使测试更快、更稳定、更易维护。

**Q: 测试覆盖率目标是多少？**
A: 核心业务逻辑目标 70%+，总体目标 40%+。不要盲目追求 100%，重点是测试关键路径。

**Q: 如何测试数据库操作？**
A: 在单元测试中使用 mock repository。集成测试可以使用测试数据库或内存数据库。

**Q: 测试失败了怎么办？**
A: 使用 `go test -v` 查看详细输出，使用 debugger 单步调试，检查 mock 期望是否正确设置。
