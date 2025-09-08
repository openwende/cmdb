# WEND CMDB Backend - 当前API接口文档

这份文档描述了当前运行中的WEND CMDB Backend API接口，基于简化验证服务器的实际实现。

## 🌐 基础信息

- **Base URL**: `http://localhost:8080`
- **内容类型**: `application/json`
- **当前状态**: ✅ 运行中 (Docker容器)
- **验证方式**: 可直接访问（验证版本）

## 📋 API概览

### 核心端点列表

| 端点 | 方法 | 描述 | 状态 |
|------|------|------|------|
| `/` | GET | 服务概览和欢迎信息 | ✅ |
| `/health` | GET | 健康检查和系统状态 | ✅ |
| `/api/info` | GET | API信息和功能列表 | ✅ |
| `/api/v1/status` | GET | 系统组件状态 | ✅ |
| `/api/v1/models` | GET | 配置项模型列表 | ✅ |
| `/api/v1/instances` | GET | 配置项实例列表 | ✅ |
| `/api/v1/plugins` | GET | 插件系统信息 | ✅ |

## 🔍 详细API文档

### 1. 根端点 - 服务概览

获取服务基本信息和可用端点。

```http
GET /
```

**响应示例:**
```json
{
  "message": "Welcome to WEND CMDB Backend",
  "version": "1.0.0",
  "docs": "/swagger/index.html",
  "health": "/health"
}
```

**测试命令:**
```bash
curl http://localhost:8080/
```

---

### 2. 健康检查

检查服务运行状态和基本信息。

```http
GET /health
```

**响应示例:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-26T10:31:03.278671137Z",
  "version": "1.0.0",
  "message": "WEND CMDB Backend is running successfully!"
}
```

**字段说明:**
- `status`: 服务状态 (healthy/unhealthy)
- `timestamp`: 检查时间戳
- `version`: 服务版本号
- `message`: 状态描述信息

**测试命令:**
```bash
curl http://localhost:8080/health
```

---

### 3. API信息

获取API服务信息、功能列表和端点映射。

```http
GET /api/info
```

**响应示例:**
```json
{
  "service": "WEND CMDB Backend",
  "version": "1.0.0",
  "features": [
    "REST API",
    "GraphQL",
    "Plugin System",
    "Event System",
    "Authentication",
    "Audit Logging"
  ],
  "endpoints": {
    "health": "/health",
    "api": "/api/v1",
    "graphql": "/graphql",
    "swagger": "/swagger/index.html",
    "metrics": "/metrics"
  }
}
```

**功能特性说明:**
- **REST API**: RESTful接口支持
- **GraphQL**: 灵活查询接口
- **Plugin System**: 可扩展插件架构
- **Event System**: 实时事件处理
- **Authentication**: 认证授权系统
- **Audit Logging**: 操作审计日志

**测试命令:**
```bash
curl http://localhost:8080/api/info | jq .
```

---

### 4. 系统状态

获取系统各组件的连接状态和功能启用情况。

```http
GET /api/v1/status
```

**响应示例:**
```json
{
  "database": "connected (simulated)",
  "redis": "connected (simulated)",
  "plugins": "system ready",
  "events": "system ready",
  "features": {
    "authentication": true,
    "authorization": true,
    "audit_logging": true,
    "plugin_system": true,
    "event_system": true,
    "graphql": true,
    "rest_api": true
  }
}
```

**组件状态说明:**
- `database`: PostgreSQL数据库连接状态
- `redis`: Redis缓存连接状态
- `plugins`: 插件系统状态
- `events`: 事件系统状态
- `features`: 各功能模块启用状态

**测试命令:**
```bash
curl http://localhost:8080/api/v1/status | jq .
```

---

### 5. 配置项模型管理

获取系统中定义的配置项模型列表。

```http
GET /api/v1/models
```

**响应示例:**
```json
{
  "models": [
    {
      "id": "model-1",
      "name": "Server",
      "description": "Physical and virtual servers",
      "fields": [
        {
          "name": "hostname",
          "type": "string",
          "required": "true"
        },
        {
          "name": "ip_address", 
          "type": "string",
          "required": "true"
        },
        {
          "name": "os",
          "type": "string",
          "required": "false"
        },
        {
          "name": "cpu_cores",
          "type": "integer",
          "required": "false"
        },
        {
          "name": "memory_gb",
          "type": "integer", 
          "required": "false"
        }
      ],
      "created_at": "2025-08-25T12:02:59.797548+08:00",
      "updated_at": "2025-08-26T12:02:59.797548+08:00"
    },
    {
      "id": "model-2",
      "name": "Application",
      "description": "Software applications and services",
      "fields": [
        {
          "name": "name",
          "type": "string",
          "required": "true"
        },
        {
          "name": "version",
          "type": "string", 
          "required": "true"
        },
        {
          "name": "port",
          "type": "integer",
          "required": "false"
        },
        {
          "name": "protocol",
          "type": "string",
          "required": "false"
        }
      ],
      "created_at": "2025-08-26T00:02:59.797549+08:00",
      "updated_at": "2025-08-26T12:02:59.797549+08:00"
    }
  ],
  "total": 2
}
```

**模型字段说明:**
- `id`: 模型唯一标识符
- `name`: 模型名称
- `description`: 模型描述
- `fields`: 字段定义列表
  - `name`: 字段名称
  - `type`: 字段类型 (string/integer/boolean等)
  - `required`: 是否必填
- `created_at/updated_at`: 创建/更新时间

**支持的字段类型:**
- `string`: 字符串类型
- `integer`: 整数类型
- `boolean`: 布尔类型
- `date`: 日期类型
- `datetime`: 日期时间类型

**测试命令:**
```bash
curl http://localhost:8080/api/v1/models | jq .
```

---

### 6. 配置项实例管理

获取系统中的配置项实例数据。

```http
GET /api/v1/instances
```

**响应示例:**
```json
{
  "instances": [
    {
      "id": "inst-1",
      "model_id": "model-1",
      "name": "web-server-01",
      "data": {
        "hostname": "web01.example.com",
        "ip_address": "192.168.1.100",
        "os": "Ubuntu 22.04",
        "cpu_cores": 4,
        "memory_gb": 16
      },
      "created_at": "2025-08-26T06:03:07.421044+08:00",
      "updated_at": "2025-08-26T11:03:07.421044+08:00"
    },
    {
      "id": "inst-2", 
      "model_id": "model-2",
      "name": "nginx-service",
      "data": {
        "name": "nginx",
        "version": "1.22.1",
        "port": 80,
        "protocol": "HTTP"
      },
      "created_at": "2025-08-26T09:03:07.421044+08:00",
      "updated_at": "2025-08-26T11:33:07.421045+08:00"
    }
  ],
  "total": 2
}
```

**实例字段说明:**
- `id`: 实例唯一标识符
- `model_id`: 关联的模型ID
- `name`: 实例名称
- `data`: 实例数据（根据模型字段定义的具体值）
- `created_at/updated_at`: 创建/更新时间

**数据示例:**
- **服务器实例**: 包含主机名、IP地址、操作系统、CPU核数、内存大小
- **应用实例**: 包含应用名称、版本、端口、协议等信息

**测试命令:**
```bash
curl http://localhost:8080/api/v1/instances | jq .
```

---

### 7. 插件系统管理

获取插件系统信息和已安装的插件列表。

```http
GET /api/v1/plugins
```

**响应示例:**
```json
{
  "plugins": [
    {
      "id": "email-validator",
      "name": "Email Validator",
      "type": "field",
      "version": "1.0.0",
      "status": "active",
      "author": "WEND Team"
    },
    {
      "id": "csv-exporter",
      "name": "CSV Exporter", 
      "type": "exporter",
      "version": "1.0.0",
      "status": "active",
      "author": "WEND Team"
    }
  ],
  "total": 2,
  "types": [
    "field",
    "exporter", 
    "importer",
    "validator",
    "notifier",
    "transformer",
    "collector",
    "action"
  ]
}
```

**插件信息说明:**
- `id`: 插件唯一标识符
- `name`: 插件名称
- `type`: 插件类型
- `version`: 插件版本
- `status`: 插件状态 (active/inactive)
- `author`: 插件作者

**支持的插件类型:**
- `field`: 字段验证和转换插件
- `exporter`: 数据导出插件
- `importer`: 数据导入插件
- `validator`: 业务规则验证插件
- `notifier`: 通知推送插件
- `transformer`: 数据格式转换插件
- `collector`: 数据采集插件
- `action`: 自定义操作插件

**测试命令:**
```bash
curl http://localhost:8080/api/v1/plugins | jq .
```

## 🧪 API测试套件

### 快速验证脚本

```bash
#!/bin/bash

BASE_URL="http://localhost:8080"

echo "🚀 WEND CMDB Backend API 测试"
echo "================================"

echo "1. 测试根端点..."
curl -s $BASE_URL/ | jq .message

echo -e "\n2. 测试健康检查..."
curl -s $BASE_URL/health | jq .status

echo -e "\n3. 测试API信息..."
curl -s $BASE_URL/api/info | jq .service

echo -e "\n4. 测试系统状态..."
curl -s $BASE_URL/api/v1/status | jq .features

echo -e "\n5. 测试模型列表..."
curl -s $BASE_URL/api/v1/models | jq '.total'

echo -e "\n6. 测试实例列表..."
curl -s $BASE_URL/api/v1/instances | jq '.total'

echo -e "\n7. 测试插件列表..."
curl -s $BASE_URL/api/v1/plugins | jq '.total'

echo -e "\n✅ 所有API端点测试完成!"
```

### 性能测试

```bash
# 并发测试健康检查端点
ab -n 1000 -c 10 http://localhost:8080/health

# 测试模型API响应时间
time curl -s http://localhost:8080/api/v1/models > /dev/null
```

## 🔧 Docker环境管理

### 服务管理命令

```bash
# 启动服务
docker-compose -f docker-compose.simple.yml up -d

# 查看服务状态
docker-compose -f docker-compose.simple.yml ps

# 查看服务日志
docker-compose -f docker-compose.simple.yml logs -f cmdb-backend

# 停止服务
docker-compose -f docker-compose.simple.yml down

# 重启服务
docker-compose -f docker-compose.simple.yml restart cmdb-backend
```

### 容器信息

```bash
# 查看容器详情
docker inspect cmdb-backend

# 进入容器
docker exec -it cmdb-backend sh

# 查看容器资源使用
docker stats cmdb-backend
```

## 📈 监控和日志

### 访问日志

所有API请求都会在容器日志中记录:

```
[GIN] 2025/08/26 - 12:02:45 | 200 | 394.458µs | ::1 | GET "/health"
[GIN] 2025/08/26 - 12:02:50 | 200 | 59.708µs  | ::1 | GET "/api/info"
```

### 性能指标

- **平均响应时间**: < 1ms (本地测试)
- **并发支持**: 支持高并发请求
- **内存使用**: 轻量级，适合容器部署
- **启动时间**: < 30秒 (包含依赖服务)

## 🛠️ 开发和调试

### 本地开发

```bash
# 直接运行Go服务器 (无Docker)
go run cmd/simple-server/main.go

# 使用Docker开发环境
docker-compose -f docker-compose.simple.yml up --build
```

### API调试

```bash
# 使用HTTPie进行测试
http GET localhost:8080/api/v1/models

# 使用Postman或Insomnia
# 导入API集合进行测试
```

## 🔗 相关文档

- [完整API文档](./api/) - 详细的REST API文档
- [GraphQL文档](./api/graphql-schema.md) - GraphQL接口文档
- [部署指南](../deploy/README.md) - 部署和运维文档
- [插件开发](./plugins/plugin-development-guide.md) - 插件开发指南

## ⚠️ 注意事项

1. **当前版本**: 这是验证版本，用于概念验证和功能演示
2. **数据持久化**: 当前数据存储在内存中，重启会丢失
3. **认证**: 验证版本暂未启用认证，生产版本将包含完整的JWT认证
4. **功能范围**: 展示了核心API设计，完整版本包含更多功能

## 🎯 下一步计划

1. **数据库集成**: 连接PostgreSQL进行数据持久化
2. **认证系统**: 集成JWT认证和RBAC权限控制
3. **GraphQL接口**: 实现灵活的GraphQL查询
4. **实时功能**: 添加WebSocket实时推送
5. **插件系统**: 实现完整的插件加载和执行机制

---

*文档更新时间: 2025-08-26*  
*API版本: 1.0.0*  
*服务状态: ✅ 运行中*