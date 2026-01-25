# WEND CMDB Backend API 文档

## 目录
- [基础信息](#基础信息)
- [健康检查](#健康检查)
- [业务管理 API](#业务管理-api)
- [业务集管理 API](#业务集管理-api)
- [动态模型引擎 API](#动态模型引擎-api)
  - [模型管理](#模型管理)
  - [实例管理](#实例管理)

---

## 基础信息

**Base URL**: `http://localhost:8080`

**通用响应格式**:
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

**错误响应格式**:
```json
{
  "error": "错误描述",
  "details": "详细错误信息"
}
```

**公共请求头**:
- `Content-Type: application/json`
- `X-Tenant-ID: <tenant-uuid>` (动态模型引擎接口需要，可选，默认测试租户)

---

## 健康检查

### 获取服务健康状态

**请求**:
```http
GET /health
```

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T10:30:00Z",
  "version": "2.2.0-Refactored",
  "database": "PostgreSQL (Connected)"
}
```

**状态码**:
- `200 OK` - 服务正常

---

## 业务管理 API

### 1. 创建业务

**请求**:
```http
POST /api/v1/businesses
Content-Type: application/json
```

**请求体**:
```json
{
  "name": "电商平台",
  "identifier": "ecommerce-platform",
  "description": "公司主要的电商业务平台",
  "lifecycle": "online",
  "sres": ["alice@example.com", "bob@example.com"],
  "developers": ["charlie@example.com", "david@example.com"],
  "testers": ["eve@example.com"],
  "bizops": ["frank@example.com"]
}
```

**字段说明**:
- `name` (必填): 业务名称，最大100字符
- `identifier` (可选): 业务标识符，不填写则自动生成
- `description` (可选): 业务描述，最大500字符
- `lifecycle` (可选): 生命周期状态，可选值: `testing`, `online`, `offline`，默认 `online`
- `sres` (可选): SRE人员列表
- `developers` (可选): 开发人员列表
- `testers` (可选): 测试人员列表
- `bizops` (可选): 运维人员列表

**成功响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-01-15T10:30:00Z",
    "updated_at": "2026-01-15T10:30:00Z",
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "name": "电商平台",
    "identifier": "ecommerce-platform",
    "description": "公司主要的电商业务平台",
    "lifecycle": "online",
    "timezone": "UTC",
    "language": "en",
    "maintainers": [],
    "is_built_in": false,
    "sres": ["alice@example.com", "bob@example.com"],
    "developers": ["charlie@example.com", "david@example.com"],
    "testers": ["eve@example.com"],
    "bizops": ["frank@example.com"]
  },
  "message": "Business created successfully"
}
```

**错误响应**:
- `400 Bad Request` - 请求参数错误
- `409 Conflict` - 业务标识符已存在

**cURL 示例**:
```bash
curl -X POST http://localhost:8080/api/v1/businesses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "电商平台",
    "identifier": "ecommerce-platform",
    "description": "公司主要的电商业务平台",
    "lifecycle": "online"
  }'
```

---

### 2. 列出业务

**请求**:
```http
GET /api/v1/businesses?limit=20&offset=0
```

**查询参数**:
- `limit` (可选): 每页数量，默认20，最大100
- `offset` (可选): 偏移量，默认0

**成功响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "created_at": "2026-01-15T10:30:00Z",
        "updated_at": "2026-01-15T10:30:00Z",
        "tenant_id": "00000000-0000-0000-0000-000000000001",
        "name": "电商平台",
        "identifier": "ecommerce-platform",
        "description": "公司主要的电商业务平台",
        "lifecycle": "online",
        "timezone": "UTC",
        "language": "en",
        "maintainers": [],
        "is_built_in": false
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

**cURL 示例**:
```bash
curl http://localhost:8080/api/v1/businesses?limit=10&offset=0
```

---

### 3. 获取单个业务

**请求**:
```http
GET /api/v1/businesses/:id
```

**路径参数**:
- `id`: 业务UUID

**成功响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "created_at": "2026-01-15T10:30:00Z",
    "updated_at": "2026-01-15T10:30:00Z",
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "name": "电商平台",
    "identifier": "ecommerce-platform",
    "description": "公司主要的电商业务平台",
    "lifecycle": "online",
    "timezone": "UTC",
    "language": "en",
    "maintainers": [],
    "is_built_in": false,
    "sres": ["alice@example.com"],
    "developers": ["charlie@example.com"]
  }
}
```

**错误响应**:
- `400 Bad Request` - 无效的UUID格式
- `404 Not Found` - 业务不存在

**cURL 示例**:
```bash
curl http://localhost:8080/api/v1/businesses/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

### 4. 更新业务

**请求**:
```http
PUT /api/v1/businesses/:id
Content-Type: application/json
```

**请求体** (所有字段可选):
```json
{
  "name": "电商平台V2",
  "description": "更新后的描述",
  "lifecycle": "testing",
  "timezone": "Asia/Shanghai",
  "language": "zh-CN"
}
```

**成功响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "updated_at": "2026-01-15T11:00:00Z",
    "name": "电商平台V2",
    "description": "更新后的描述",
    "lifecycle": "testing",
    "timezone": "Asia/Shanghai",
    "language": "zh-CN"
  },
  "message": "Business updated successfully"
}
```

**错误响应**:
- `400 Bad Request` - 请求参数错误
- `404 Not Found` - 业务不存在
- `409 Conflict` - 标识符冲突

**cURL 示例**:
```bash
curl -X PUT http://localhost:8080/api/v1/businesses/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "电商平台V2",
    "lifecycle": "testing"
  }'
```

---

### 5. 删除业务

**请求**:
```http
DELETE /api/v1/businesses/:id
```

**重要说明**:
- ⚠️ **只能删除归档状态（lifecycle = "offline"）的业务**
- 如果业务处于 `testing` 或 `online` 状态，删除请求将被拒绝
- 建议在删除前先将业务更新为 `offline` 状态

**成功响应** (200 OK):
```json
{
  "success": true,
  "message": "Business deleted successfully"
}
```

**错误响应**:
- `400 Bad Request` - 无效的UUID格式，或业务不是归档状态
- `404 Not Found` - 业务不存在

**错误示例** (业务状态不是offline):
```json
{
  "error": "Cannot delete business",
  "details": "只能删除归档（offline）状态的业务，当前业务状态为: online"
}
```

**cURL 示例**:
```bash
# 1. 首先将业务更新为offline状态
curl -X PUT http://localhost:8080/api/v1/businesses/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Content-Type: application/json" \
  -d '{"lifecycle": "offline"}'

# 2. 然后删除业务
curl -X DELETE http://localhost:8080/api/v1/businesses/a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

## 业务集管理 API

### 1. 创建业务集

**请求**:
```http
POST /api/v1/business-sets
Content-Type: application/json
```

**请求体**:
```json
{
  "name": "核心业务集",
  "identifier": "core-business-set",
  "description": "包含所有核心业务的集合",
  "business_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**字段说明**:
- `name` (必填): 业务集名称
- `identifier` (可选): 业务集标识符
- `description` (可选): 业务集描述
- `business_id` (必填): 初始关联的业务UUID

**成功响应** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "created_at": "2026-01-15T10:35:00Z",
    "updated_at": "2026-01-15T10:35:00Z",
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "name": "核心业务集",
    "identifier": "core-business-set",
    "description": "包含所有核心业务的集合",
    "scope": null,
    "maintainers": []
  },
  "message": "Business set created successfully"
}
```

**cURL 示例**:
```bash
curl -X POST http://localhost:8080/api/v1/business-sets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "核心业务集",
    "identifier": "core-business-set",
    "description": "包含所有核心业务的集合",
    "business_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

---

### 2. 列出业务集

**请求**:
```http
GET /api/v1/business-sets?limit=20&offset=0
```

**成功响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
        "created_at": "2026-01-15T10:35:00Z",
        "updated_at": "2026-01-15T10:35:00Z",
        "tenant_id": "00000000-0000-0000-0000-000000000001",
        "name": "核心业务集",
        "identifier": "core-business-set",
        "description": "包含所有核心业务的集合",
        "scope": null,
        "maintainers": []
      }
    ],
    "total": 1,
    "limit": 20,
    "offset": 0
  }
}
```

**cURL 示例**:
```bash
curl http://localhost:8080/api/v1/business-sets
```

---

### 3. 获取单个业务集

**请求**:
```http
GET /api/v1/business-sets/:id
```

**成功响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "created_at": "2026-01-15T10:35:00Z",
    "updated_at": "2026-01-15T10:35:00Z",
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "name": "核心业务集",
    "identifier": "core-business-set",
    "description": "包含所有核心业务的集合",
    "scope": null,
    "maintainers": []
  }
}
```

**cURL 示例**:
```bash
curl http://localhost:8080/api/v1/business-sets/b2c3d4e5-f6a7-8901-bcde-f12345678901
```

---

### 4. 更新业务集

**请求**:
```http
PUT /api/v1/business-sets/:id
Content-Type: application/json
```

**请求体** (所有字段可选):
```json
{
  "name": "核心业务集V2",
  "description": "更新后的描述"
}
```

**成功响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "updated_at": "2026-01-15T11:05:00Z",
    "name": "核心业务集V2",
    "description": "更新后的描述"
  },
  "message": "Business set updated successfully"
}
```

**cURL 示例**:
```bash
curl -X PUT http://localhost:8080/api/v1/business-sets/b2c3d4e5-f6a7-8901-bcde-f12345678901 \
  -H "Content-Type: application/json" \
  -d '{"name": "核心业务集V2"}'
```

---

### 5. 删除业务集

**请求**:
```http
DELETE /api/v1/business-sets/:id
```

**成功响应** (200 OK):
```json
{
  "success": true,
  "message": "Business set deleted successfully"
}
```

**cURL 示例**:
```bash
curl -X DELETE http://localhost:8080/api/v1/business-sets/b2c3d4e5-f6a7-8901-bcde-f12345678901
```

---

### 6. 添加业务到业务集

**请求**:
```http
POST /api/v1/business-sets/:id/members
Content-Type: application/json
```

**请求体**:
```json
{
  "business_id": "c3d4e5f6-a7b8-9012-cdef-123456789012"
}
```

**成功响应** (200 OK):
```json
{
  "success": true,
  "message": "Business added to set successfully"
}
```

**错误响应**:
- `400 Bad Request` - 参数错误
- `404 Not Found` - 业务或业务集不存在
- `409 Conflict` - 业务已经在该业务集中

**cURL 示例**:
```bash
curl -X POST http://localhost:8080/api/v1/business-sets/b2c3d4e5-f6a7-8901-bcde-f12345678901/members \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "c3d4e5f6-a7b8-9012-cdef-123456789012"
  }'
```

---

### 7. 列出业务集成员

**请求**:
```http
GET /api/v1/business-sets/:id/members
```

**成功响应** (200 OK):
```json
{
  "success": true,
  "data": {
    "business_ids": [
      "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "c3d4e5f6-a7b8-9012-cdef-123456789012"
    ],
    "count": 2
  }
}
```

**cURL 示例**:
```bash
curl http://localhost:8080/api/v1/business-sets/b2c3d4e5-f6a7-8901-bcde-f12345678901/members
```

---

### 8. 从业务集移除业务

**请求**:
```http
DELETE /api/v1/business-sets/:id/members/:business_id
```

**路径参数**:
- `id`: 业务集UUID
- `business_id`: 业务UUID

**成功响应** (200 OK):
```json
{
  "success": true,
  "message": "Business removed from set successfully"
}
```

**错误响应**:
- `400 Bad Request` - 参数错误
- `404 Not Found` - 业务不在该业务集中

**cURL 示例**:
```bash
curl -X DELETE http://localhost:8080/api/v1/business-sets/b2c3d4e5-f6a7-8901-bcde-f12345678901/members/c3d4e5f6-a7b8-9012-cdef-123456789012
```

---

## 动态模型引擎 API

动态模型引擎允许您定义自定义资源类型(模型)及其属性，然后创建这些类型的实例。这是一个类似于Kubernetes CRD的系统。

### 模型管理

#### 1. 创建模型

**请求**:
```http
POST /api/v1/models
Content-Type: application/json
```

**请求体**:
```json
{
  "name": "host",
  "display_name": "主机",
  "classification": "resource",
  "icon": "server",
  "description": "物理服务器或虚拟机"
}
```

**字段说明**:
- `name` (必填): 模型机器名称(英文，小写，用于API路径)
- `display_name` (必填): 模型显示名称(人类可读)
- `classification` (必填): 模型分类，如 `resource`, `business`, `network` 等
- `icon` (可选): 图标标识
- `description` (可选): 模型描述

**成功响应** (201 Created):
```json
{
  "id": "d4e5f6a7-b8c9-0123-def0-123456789abc",
  "name": "host",
  "display_name": "主机",
  "classification": "resource",
  "icon": "server",
  "is_builtin": false,
  "description": "物理服务器或虚拟机",
  "created_at": "2026-01-15T10:40:00Z",
  "updated_at": "2026-01-15T10:40:00Z"
}
```

**cURL 示例**:
```bash
curl -X POST http://localhost:8080/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "host",
    "display_name": "主机",
    "classification": "resource",
    "icon": "server",
    "description": "物理服务器或虚拟机"
  }'
```

---

#### 2. 列出所有模型

**请求**:
```http
GET /api/v1/models
```

**成功响应** (200 OK):
```json
[
  {
    "id": "d4e5f6a7-b8c9-0123-def0-123456789abc",
    "name": "host",
    "display_name": "主机",
    "classification": "resource",
    "icon": "server",
    "is_builtin": false,
    "description": "物理服务器或虚拟机",
    "created_at": "2026-01-15T10:40:00Z",
    "updated_at": "2026-01-15T10:40:00Z"
  },
  {
    "id": "e5f6a7b8-c9d0-1234-ef01-23456789abcd",
    "name": "module",
    "display_name": "模块",
    "classification": "business",
    "icon": "cube",
    "is_builtin": false,
    "description": "业务模块",
    "created_at": "2026-01-15T10:41:00Z",
    "updated_at": "2026-01-15T10:41:00Z"
  }
]
```

**cURL 示例**:
```bash
curl http://localhost:8080/api/v1/models
```

---

#### 3. 获取模型详情(含属性)

**请求**:
```http
GET /api/v1/models/:name
```

**路径参数**:
- `name`: 模型名称(如 `host`)

**成功响应** (200 OK):
```json
{
  "model": {
    "id": "d4e5f6a7-b8c9-0123-def0-123456789abc",
    "name": "host",
    "display_name": "主机",
    "classification": "resource",
    "icon": "server",
    "is_builtin": false,
    "description": "物理服务器或虚拟机",
    "created_at": "2026-01-15T10:40:00Z",
    "updated_at": "2026-01-15T10:40:00Z"
  },
  "attributes": [
    {
      "id": "f6a7b8c9-d0e1-2345-f012-3456789abcde",
      "model_id": "d4e5f6a7-b8c9-0123-def0-123456789abc",
      "name": "hostname",
      "display_name": "主机名",
      "field_type": "string",
      "is_required": true,
      "is_unique": true,
      "is_editable": true,
      "is_system": false,
      "sort_order": 1,
      "options": {},
      "created_at": "2026-01-15T10:42:00Z",
      "updated_at": "2026-01-15T10:42:00Z"
    },
    {
      "id": "a7b8c9d0-e1f2-3456-0123-456789abcdef",
      "model_id": "d4e5f6a7-b8c9-0123-def0-123456789abc",
      "name": "ip_address",
      "display_name": "IP地址",
      "field_type": "string",
      "is_required": true,
      "is_unique": false,
      "is_editable": true,
      "is_system": false,
      "sort_order": 2,
      "options": {
        "pattern": "^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"
      },
      "created_at": "2026-01-15T10:43:00Z",
      "updated_at": "2026-01-15T10:43:00Z"
    }
  ]
}
```

**cURL 示例**:
```bash
curl http://localhost:8080/api/v1/models/host
```

---

#### 4. 为模型添加属性

**请求**:
```http
POST /api/v1/models/:name/attributes
Content-Type: application/json
```

**请求体**:
```json
{
  "name": "cpu_cores",
  "display_name": "CPU核心数",
  "field_type": "int",
  "is_required": false,
  "is_unique": false,
  "sort_order": 3,
  "options": {
    "min": 1,
    "max": 256,
    "default": 4
  }
}
```

**支持的字段类型**:
- `string`: 字符串
- `int`: 整数
- `float`: 浮点数
- `bool`: 布尔值
- `datetime`: 日期时间
- `enum`: 枚举
- `json`: JSON对象
- `user`: 用户引用
- `obj_ref`: 对象引用

**字段说明**:
- `name` (必填): 属性机器名称
- `display_name` (必填): 属性显示名称
- `field_type` (必填): 字段类型
- `is_required` (可选): 是否必填，默认false
- `is_unique` (可选): 是否唯一，默认false
- `sort_order` (可选): 排序顺序
- `options` (可选): 额外配置
  - `min`, `max`: 数值范围
  - `default`: 默认值
  - `pattern`: 正则表达式(string类型)
  - `enum_values`: 枚举值列表(enum类型)

**成功响应** (201 Created):
```json
{
  "id": "b8c9d0e1-f2a3-4567-1234-56789abcdef0",
  "model_id": "d4e5f6a7-b8c9-0123-def0-123456789abc",
  "name": "cpu_cores",
  "display_name": "CPU核心数",
  "field_type": "int",
  "is_required": false,
  "is_unique": false,
  "is_editable": true,
  "is_system": false,
  "sort_order": 3,
  "options": {
    "min": 1,
    "max": 256,
    "default": 4
  },
  "created_at": "2026-01-15T10:45:00Z",
  "updated_at": "2026-01-15T10:45:00Z"
}
```

**cURL 示例**:
```bash
curl -X POST http://localhost:8080/api/v1/models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cpu_cores",
    "display_name": "CPU核心数",
    "field_type": "int",
    "is_required": false,
    "options": {
      "min": 1,
      "max": 256,
      "default": 4
    }
  }'
```

---

### 实例管理

#### 1. 创建实例

**请求**:
```http
POST /api/v1/models/:name/instances
Content-Type: application/json
X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3
```

**请求体**:
```json
{
  "properties": {
    "hostname": "web-server-01",
    "ip_address": "192.168.1.100",
    "cpu_cores": 8,
    "memory_gb": 16,
    "os": "Ubuntu 22.04",
    "status": "running"
  },
  "business_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**字段说明**:
- `properties` (必填): 实例属性，根据模型定义的属性填写
- `business_id` (可选): 关联的业务UUID

**成功响应** (201 Created):
```json
{
  "id": "c9d0e1f2-a3b4-5678-2345-6789abcdef01",
  "model_id": "d4e5f6a7-b8c9-0123-def0-123456789abc",
  "tenant_id": "ce307a3d-a1a7-4838-ab0b-23182f9851c3",
  "business_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "properties": {
    "hostname": "web-server-01",
    "ip_address": "192.168.1.100",
    "cpu_cores": 8,
    "memory_gb": 16,
    "os": "Ubuntu 22.04",
    "status": "running"
  },
  "created_at": "2026-01-15T10:50:00Z",
  "updated_at": "2026-01-15T10:50:00Z"
}
```

**cURL 示例**:
```bash
curl -X POST http://localhost:8080/api/v1/models/host/instances \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3" \
  -d '{
    "properties": {
      "hostname": "web-server-01",
      "ip_address": "192.168.1.100",
      "cpu_cores": 8,
      "memory_gb": 16
    }
  }'
```

---

#### 2. 批量创建实例

**请求**:
```http
POST /api/v1/models/:name/instances/batch
Content-Type: application/json
X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3
```

**请求体**:
```json
{
  "instances": [
    {
      "properties": {
        "hostname": "web-server-01",
        "ip_address": "192.168.1.100",
        "cpu_cores": 8
      }
    },
    {
      "properties": {
        "hostname": "web-server-02",
        "ip_address": "192.168.1.101",
        "cpu_cores": 8
      }
    },
    {
      "properties": {
        "hostname": "db-server-01",
        "ip_address": "192.168.1.200",
        "cpu_cores": 16
      }
    }
  ]
}
```

**限制**:
- 最少1个实例，最多1000个实例

**成功响应** (201 Created):
```json
{
  "count": 3,
  "ids": [
    "c9d0e1f2-a3b4-5678-2345-6789abcdef01",
    "d0e1f2a3-b4c5-6789-3456-789abcdef012",
    "e1f2a3b4-c5d6-789a-4567-89abcdef0123"
  ]
}
```

**cURL 示例**:
```bash
curl -X POST http://localhost:8080/api/v1/models/host/instances/batch \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3" \
  -d '{
    "instances": [
      {
        "properties": {
          "hostname": "web-server-01",
          "ip_address": "192.168.1.100"
        }
      },
      {
        "properties": {
          "hostname": "web-server-02",
          "ip_address": "192.168.1.101"
        }
      }
    ]
  }'
```

---

#### 3. 列出实例

**请求**:
```http
GET /api/v1/models/:name/instances?page=1&page_size=20&q={"status":"running"}
X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3
```

**查询参数**:
- `page` (可选): 页码，默认1
- `page_size` (可选): 每页数量，默认20
- `q` (可选): JSON格式的过滤条件，用于查询properties字段

**成功响应** (200 OK):
```json
{
  "data": [
    {
      "id": "c9d0e1f2-a3b4-5678-2345-6789abcdef01",
      "model_id": "d4e5f6a7-b8c9-0123-def0-123456789abc",
      "tenant_id": "ce307a3d-a1a7-4838-ab0b-23182f9851c3",
      "business_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "properties": {
        "hostname": "web-server-01",
        "ip_address": "192.168.1.100",
        "cpu_cores": 8,
        "status": "running"
      },
      "created_at": "2026-01-15T10:50:00Z",
      "updated_at": "2026-01-15T10:50:00Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "page_size": 20
  }
}
```

**cURL 示例**:
```bash
# 列出所有实例
curl http://localhost:8080/api/v1/models/host/instances \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3"

# 带过滤条件
curl "http://localhost:8080/api/v1/models/host/instances?q=%7B%22status%22%3A%22running%22%7D" \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3"

# 分页查询
curl "http://localhost:8080/api/v1/models/host/instances?page=2&page_size=10" \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3"
```

---

## 完整使用流程示例

### 场景：创建主机资源模型并管理实例

**步骤1：创建业务**
```bash
curl -X POST http://localhost:8080/api/v1/businesses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "云计算平台",
    "identifier": "cloud-platform"
  }'
# 记录返回的 business_id
```

**步骤2：创建主机模型**
```bash
curl -X POST http://localhost:8080/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "host",
    "display_name": "主机",
    "classification": "resource",
    "description": "物理服务器或虚拟机"
  }'
```

**步骤3：为模型添加属性**
```bash
# 添加hostname属性
curl -X POST http://localhost:8080/api/v1/models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hostname",
    "display_name": "主机名",
    "field_type": "string",
    "is_required": true,
    "is_unique": true
  }'

# 添加ip_address属性
curl -X POST http://localhost:8080/api/v1/models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ip_address",
    "display_name": "IP地址",
    "field_type": "string",
    "is_required": true
  }'

# 添加cpu_cores属性
curl -X POST http://localhost:8080/api/v1/models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cpu_cores",
    "display_name": "CPU核心数",
    "field_type": "int",
    "options": {"min": 1, "max": 256}
  }'
```

**步骤4：创建主机实例**
```bash
curl -X POST http://localhost:8080/api/v1/models/host/instances \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3" \
  -d '{
    "properties": {
      "hostname": "prod-web-01",
      "ip_address": "10.0.1.100",
      "cpu_cores": 16
    },
    "business_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

**步骤5：查询所有主机实例**
```bash
curl http://localhost:8080/api/v1/models/host/instances \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3"
```

---

## 错误码参考

| HTTP状态码 | 含义 | 常见原因 |
|-----------|------|---------|
| 200 OK | 成功 | - |
| 201 Created | 创建成功 | - |
| 400 Bad Request | 请求参数错误 | JSON格式错误、必填字段缺失、参数验证失败 |
| 404 Not Found | 资源不存在 | UUID错误、资源已删除 |
| 409 Conflict | 资源冲突 | 唯一标识符重复、资源已存在 |
| 500 Internal Server Error | 服务器内部错误 | 数据库连接失败、代码异常 |

---

## 注意事项

1. **UUID格式**: 所有ID字段必须是有效的UUID v4格式
2. **租户隔离**: 动态模型引擎API需要 `X-Tenant-ID` 请求头，如不提供则使用默认测试租户
3. **分页**: 列表接口默认返回20条数据，最大100条
4. **软删除**: 删除操作为软删除，数据不会真正从数据库删除
5. **CORS**: API已启用CORS支持，允许跨域请求
6. **时区**: 所有时间戳使用UTC时区

---

## 技术栈

- **框架**: Gin (Go)
- **数据库**: PostgreSQL 18
- **ORM**: GORM
- **验证**: go-playground/validator
- **UUID**: google/uuid

---

## 联系方式

如有问题请联系开发团队。

**文档版本**: v2.2.0
**更新时间**: 2026-01-15
