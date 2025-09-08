# WEND CMDB Backend - 交付说明（Business 最小可用版）

本版本聚焦 Business 域最小可用交付，支持数据库或无数据库（mock）两种运行模式。

- Base URL: http://localhost:8080
- 端口可配：`config.yaml -> server.port`

## 可用接口

- GET `/health`
  - 健康检查；在非 mock 模式下附带数据库连通性结果

- POST `/api/v1/businesses`
  - 创建业务
  - Body: `{ name: string, description?: string, identifier?: string, sres?: string[], developers?: string[], testers?: string[], bizops?: string[] }`
  - 响应: 201 成功；409 标识符冲突；400 参数错误

- GET `/api/v1/businesses?limit&offset`
  - 分页列表（limit<=100）

- GET `/api/v1/businesses/:id`
  - 查询业务；`id` 需为UUID

- PUT `/api/v1/businesses/:id`
  - 更新业务；Body 字段均可选；支持标识符唯一性校验

- DELETE `/api/v1/businesses/:id`
  - 软删除

- POST `/api/v1/business-sets`
  - 创建业务集并自动关联一个业务
  - Body: `{ name: string, description?: string, identifier?: string, business_id: UUID }`
  - 响应: 201 成功；409 标识符冲突；400 关联业务不存在/参数错误

## 关键改动

- 修复字段类型：`businesses.maintainers` 与 DB schema 对齐（`uuid[]`）
- 业务集创建：使用事务保证 `business_sets` 与 `business_set_members` 同时成功/失败
- HTTP 层增强：
  - 路径参数 `id` 做 UUID 校验
  - CORS 头调整，避免 `* + credentials` 的无效组合
  - 使用配置端口启动

## 已知限制

- 租户ID暂为默认值，后续接入鉴权后从上下文获取
- 仅交付 Business 域接口；文档/CLI中提及的其他接口（模型/实例/拓扑/GraphQL等）尚未对外开放

## 运行

```bash
# 启动（本地配置读取 config.yaml）
make dev

# 构建二进制
make build-server

# 运行单独服务
make server
```

