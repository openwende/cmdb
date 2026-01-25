# 业务删除功能 - 归档状态限制

## 功能概述

实现了业务删除的安全限制：**只有归档状态（lifecycle = "offline"）的业务才能被删除**。

这个限制确保了：
- 防止误删除正在使用的业务
- 强制执行业务下线流程
- 提供更安全的数据管理

## 技术实现

### 1. Service 层（业务逻辑）

**文件**: `internal/core/business/service.go`

```go
func (s *service) DeleteBusiness(ctx context.Context, tenantID, id string) error {
    // 首先获取业务信息以检查其生命周期状态
    business, err := s.businessRepo.GetBusinessByID(ctx, tenantID, id)
    if err != nil {
        return err
    }

    // 只允许删除归档（offline）状态的业务
    if business.Lifecycle != types.BusinessLifecycleOffline {
        return fmt.Errorf("只能删除归档（offline）状态的业务，当前业务状态为: %s", business.Lifecycle)
    }

    return s.businessRepo.DeleteBusiness(ctx, tenantID, id)
}
```

### 2. Handler 层（HTTP 接口）

**文件**: `internal/api/handlers/business_handler.go`

添加了状态检查错误的处理：
- 返回 `400 Bad Request` 当业务不是归档状态时
- 提供清晰的错误信息

### 3. API 响应

#### 成功删除（业务为 offline 状态）
```json
{
  "success": true,
  "message": "Business deleted successfully"
}
```

#### 失败 - 业务状态不符合要求
```json
{
  "error": "Cannot delete business",
  "details": "只能删除归档（offline）状态的业务，当前业务状态为: online"
}
```

## 使用指南

### 正确的删除流程

```bash
# 1. 首先查看业务当前状态
curl http://localhost:8080/api/v1/businesses/{business_id}

# 2. 将业务更新为 offline（归档）状态
curl -X PUT http://localhost:8080/api/v1/businesses/{business_id} \
  -H "Content-Type: application/json" \
  -d '{"lifecycle": "offline"}'

# 3. 然后删除业务
curl -X DELETE http://localhost:8080/api/v1/businesses/{business_id}
```

### 业务生命周期状态

系统支持三种生命周期状态：

| 状态 | 值 | 说明 | 可删除 |
|------|-----|------|--------|
| 测试中 | `testing` | 业务正在测试阶段 | ❌ 否 |
| 上线 | `online` | 业务正在运行中 | ❌ 否 |
| 归档/下线 | `offline` | 业务已下线归档 | ✅ 是 |

## 测试覆盖

### 单元测试

1. **Service 层测试** (`internal/core/business/service_test.go`)
   - ✅ 成功删除 offline 状态的业务
   - ✅ 拒绝删除 online 状态的业务
   - ✅ 拒绝删除 testing 状态的业务
   - ✅ 正确处理不存在的业务

2. **Handler 层测试** (`internal/api/handlers/business_handler_test.go`)
   - ✅ 验证 HTTP 200 响应（成功）
   - ✅ 验证 HTTP 400 响应（状态不符）
   - ✅ 验证 HTTP 404 响应（业务不存在）
   - ✅ 验证无效 UUID 处理

### 运行测试

```bash
# 运行所有测试
make test

# 只运行业务相关测试
go test ./internal/core/business/... -v
go test ./internal/api/handlers/... -v
```

### 端到端测试

提供了完整的端到端测试脚本：

```bash
# 运行端到端测试（需要服务器运行）
./test-delete-business.sh
```

测试脚本会自动：
1. 创建一个 online 状态的业务
2. 尝试删除（应该失败）
3. 将业务更新为 offline 状态
4. 再次删除（应该成功）
5. 验证删除结果

## API 文档更新

API 文档 (`docs/API.md`) 已更新，包含：
- ⚠️ 删除限制的明确说明
- 完整的使用示例
- 错误响应格式
- 推荐的操作流程

## 错误码参考

| HTTP 状态码 | 场景 | 错误信息 |
|------------|------|---------|
| 200 OK | 成功删除 offline 业务 | - |
| 400 Bad Request | 尝试删除非 offline 业务 | "只能删除归档（offline）状态的业务，当前业务状态为: {state}" |
| 400 Bad Request | UUID 格式无效 | "Invalid business ID format" |
| 404 Not Found | 业务不存在 | "Business not found" |

## 代码变更摘要

### 修改的文件
1. `internal/core/business/service.go` - 添加删除前的状态验证
2. `internal/api/handlers/business_handler.go` - 添加错误处理
3. `docs/API.md` - 更新 API 文档

### 新增的文件
1. `test-delete-business.sh` - 端到端测试脚本
2. `docs/DELETE_BUSINESS_FEATURE.md` - 本文档

### 新增的测试
1. `internal/core/business/service_test.go::TestDeleteBusiness` - 4个测试用例
2. `internal/api/handlers/business_handler_test.go::TestDeleteBusiness` - 4个测试用例

## 最佳实践

1. **删除前确认**: 总是先查看业务状态
2. **逐步下线**: 按照 `testing` → `online` → `offline` 的流程管理业务
3. **备份数据**: 在归档前确保重要数据已备份
4. **审计日志**: 建议记录所有删除操作（未来改进）

## 未来改进建议

1. 添加软删除支持（已有 deleted_at 字段）
2. 添加删除前的依赖检查（如关联的业务集）
3. 添加删除操作的审计日志
4. 支持批量删除归档业务
5. 添加恢复已删除业务的功能

## 总结

✅ **功能完整性**
- 实现了归档状态验证
- 提供清晰的错误信息
- 完整的测试覆盖

✅ **代码质量**
- 遵循现有代码风格
- 所有测试通过
- 文档齐全

✅ **用户体验**
- 防止误删除
- 错误信息清晰易懂
- 操作流程明确
