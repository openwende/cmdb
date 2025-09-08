# 模型管理API

模型管理API提供配置项模型的创建、查询、更新和删除功能。

## 基础信息

- **Base URL**: `/api/v1/models`
- **认证方式**: JWT Bearer Token
- **内容类型**: `application/json`

## 数据模型

### Model (模型)

```json
{
  "id": "uuid",
  "name": "string",
  "identifier": "string",
  "description": "string",
  "group_id": "uuid",
  "icon": "string",
  "status": "active|inactive|archived",
  "is_built_in": "boolean",
  "fields": [Field],
  "field_groups": [FieldGroup],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Field (字段)

```json
{
  "id": "uuid",
  "name": "string",
  "identifier": "string",
  "model_id": "uuid",
  "group_id": "uuid",
  "type": "string|longtext|int|float|bool|date|datetime|enum|multi_enum|user|timezone|list|table",
  "description": "string",
  "is_required": "boolean",
  "is_unique": "boolean",
  "is_editable": "boolean",
  "is_built_in": "boolean",
  "default_value": "string",
  "options": "FieldOptions",
  "display_order": "int",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### FieldOptions (字段选项)

```json
{
  "min_length": "int",
  "max_length": "int",
  "pattern": "string",
  "min": "float",
  "max": "float",
  "enum_values": [
    {
      "key": "string",
      "value": "string",
      "description": "string",
      "is_default": "boolean"
    }
  ],
  "list_item_type": "FieldType",
  "list_min_items": "int",
  "list_max_items": "int",
  "table_columns": [
    {
      "name": "string",
      "type": "FieldType",
      "is_required": "boolean",
      "description": "string"
    }
  ],
  "placeholder": "string",
  "help_text": "string"
}
```

## API端点

### 1. 创建模型

创建新的配置项模型。

**请求**
```http
POST /api/v1/models
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "服务器",
  "identifier": "server",
  "description": "物理服务器或虚拟机",
  "group_id": "550e8400-e29b-41d4-a716-446655440000",
  "icon": "server"
}
```

**响应**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "服务器",
    "identifier": "server",
    "description": "物理服务器或虚拟机",
    "group_id": "550e8400-e29b-41d4-a716-446655440000",
    "icon": "server",
    "status": "active",
    "is_built_in": false,
    "fields": [],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2. 获取模型列表

获取模型列表，支持分页和过滤。

**请求**
```http
GET /api/v1/models?page=1&page_size=20&search=服务器&group_id=550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <token>
```

**参数**
- `page` (可选): 页码，默认1
- `page_size` (可选): 每页大小，默认20，最大100
- `search` (可选): 搜索关键词
- `group_id` (可选): 模型组ID
- `status` (可选): 状态过滤

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "服务器",
        "identifier": "server",
        "description": "物理服务器或虚拟机",
        "group_id": "550e8400-e29b-41d4-a716-446655440000",
        "icon": "server",
        "status": "active",
        "is_built_in": false,
        "field_count": 5,
        "instance_count": 150,
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1,
      "total_pages": 1
    }
  }
}
```

### 3. 获取模型详情

获取指定模型的详细信息，包括字段和字段组。

**请求**
```http
GET /api/v1/models/{model_id}
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "服务器",
    "identifier": "server",
    "description": "物理服务器或虚拟机",
    "group_id": "550e8400-e29b-41d4-a716-446655440000",
    "icon": "server",
    "status": "active",
    "is_built_in": false,
    "fields": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "name": "主机名",
        "identifier": "hostname",
        "type": "string",
        "is_required": true,
        "is_unique": true,
        "options": {
          "min_length": 1,
          "max_length": 255,
          "pattern": "^[a-zA-Z0-9-]+$"
        },
        "display_order": 1
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "name": "IP地址",
        "identifier": "ip_address",
        "type": "string",
        "is_required": true,
        "options": {
          "pattern": "^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$"
        },
        "display_order": 2
      }
    ],
    "field_groups": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440004",
        "name": "基本信息",
        "identifier": "basic",
        "description": "服务器基本信息",
        "display_order": 1
      }
    ],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### 4. 更新模型

更新模型信息。

**请求**
```http
PUT /api/v1/models/{model_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "物理服务器",
  "description": "数据中心物理服务器设备",
  "icon": "physical-server"
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "物理服务器",
    "identifier": "server",
    "description": "数据中心物理服务器设备",
    "icon": "physical-server",
    "updated_at": "2024-01-01T01:00:00Z"
  }
}
```

### 5. 删除模型

删除指定模型。

**请求**
```http
DELETE /api/v1/models/{model_id}
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "模型删除成功"
}
```

## 字段管理API

### 1. 创建字段

为模型添加新字段。

**请求**
```http
POST /api/v1/models/{model_id}/fields
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "CPU核数",
  "identifier": "cpu_cores",
  "type": "int",
  "description": "服务器CPU核心数量",
  "is_required": true,
  "group_id": "550e8400-e29b-41d4-a716-446655440004",
  "options": {
    "min": 1,
    "max": 128
  },
  "display_order": 3
}
```

**响应**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440005",
    "name": "CPU核数",
    "identifier": "cpu_cores",
    "model_id": "550e8400-e29b-41d4-a716-446655440001",
    "type": "int",
    "is_required": true,
    "options": {
      "min": 1,
      "max": 128
    },
    "display_order": 3,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2. 更新字段

更新模型字段。

**请求**
```http
PUT /api/v1/models/{model_id}/fields/{field_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "CPU核心数",
  "description": "服务器CPU物理核心数量",
  "options": {
    "min": 1,
    "max": 256
  }
}
```

### 3. 删除字段

删除模型字段。

**请求**
```http
DELETE /api/v1/models/{model_id}/fields/{field_id}
Authorization: Bearer <token>
```

## 错误处理

### 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细错误信息"
  }
}
```

### 常见错误码

| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| VALIDATION_FAILED | 400 | 请求参数验证失败 |
| UNAUTHORIZED | 401 | 未授权访问 |
| FORBIDDEN | 403 | 权限不足 |
| NOT_FOUND | 404 | 资源不存在 |
| ALREADY_EXISTS | 409 | 资源已存在 |
| CONSTRAINT_VIOLATION | 409 | 约束冲突 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |

## 字段类型说明

### 基础类型

| 类型 | 描述 | 选项 |
|------|------|------|
| string | 短文本 | min_length, max_length, pattern |
| longtext | 长文本 | min_length, max_length |
| int | 整数 | min, max |
| float | 浮点数 | min, max |
| bool | 布尔值 | - |
| date | 日期 | - |
| datetime | 日期时间 | - |

### 高级类型

| 类型 | 描述 | 选项 |
|------|------|------|
| enum | 单选枚举 | enum_values |
| multi_enum | 多选枚举 | enum_values |
| user | 用户引用 | - |
| timezone | 时区 | - |
| list | 列表 | list_item_type, list_min_items, list_max_items |
| table | 表格 | table_columns |

## 使用示例

### 创建完整的服务器模型

```bash
# 1. 创建模型
curl -X POST http://localhost:8080/api/v1/models \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "服务器",
    "identifier": "server",
    "description": "物理服务器或虚拟机",
    "group_id": "550e8400-e29b-41d4-a716-446655440000"
  }'

# 2. 添加字段
curl -X POST http://localhost:8080/api/v1/models/$MODEL_ID/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "主机名",
    "identifier": "hostname",
    "type": "string",
    "is_required": true,
    "is_unique": true,
    "options": {
      "max_length": 255,
      "pattern": "^[a-zA-Z0-9-]+$"
    }
  }'

# 3. 添加操作系统枚举字段
curl -X POST http://localhost:8080/api/v1/models/$MODEL_ID/fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "操作系统",
    "identifier": "os",
    "type": "enum",
    "is_required": true,
    "options": {
      "enum_values": [
        {"key": "centos7", "value": "CentOS 7", "is_default": true},
        {"key": "centos8", "value": "CentOS 8"},
        {"key": "ubuntu18", "value": "Ubuntu 18.04"},
        {"key": "ubuntu20", "value": "Ubuntu 20.04"},
        {"key": "windows2019", "value": "Windows Server 2019"}
      ]
    }
  }'
```

## 最佳实践

### 模型设计原则

1. **命名规范**: 使用清晰、一致的命名规范
2. **字段设计**: 合理设置字段类型和验证规则
3. **分组管理**: 使用字段组进行逻辑分组
4. **版本控制**: 谨慎修改已有模型结构

### 性能优化

1. **分页查询**: 使用分页避免大量数据传输
2. **字段选择**: 只获取需要的字段
3. **缓存策略**: 合理使用缓存减少数据库查询
4. **索引优化**: 为常用查询字段建立索引

### 安全考虑

1. **权限控制**: 严格控制模型管理权限
2. **数据验证**: 对输入数据进行严格验证
3. **审计日志**: 记录所有模型变更操作
4. **备份恢复**: 定期备份模型定义数据