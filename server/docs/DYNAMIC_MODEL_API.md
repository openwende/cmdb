# 动态模型 HTTP API 文档

## 📚 目录

1. [模型管理 API](#模型管理-api)
2. [属性管理 API](#属性管理-api)
3. [资源实例管理 API](#资源实例管理-api)
4. [关联关系管理 API](#关联关系管理-api)
5. [拓扑查询 API](#拓扑查询-api)
6. [审计日志 API](#审计日志-api)

---

## 模型管理 API

### 1. 创建模型
```http
POST /api/v1/dynamic-models
Content-Type: application/json

{
  "uid": "host",
  "name": "主机",
  "description": "物理机或虚拟机",
  "icon": "server",
  "unique_fields": {
    "fields": ["cloud_id", "inner_ip"],
    "name": "idx_unique_host"
  }
}
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "uid": "host",
    "name": "主机",
    "description": "物理机或虚拟机",
    "icon": "server",
    "created_at": "2026-02-07T10:00:00Z"
  }
}
```

### 2. 列出所有模型
```http
GET /api/v1/dynamic-models
```

**响应**：
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "uid": "host",
      "name": "主机",
      "description": "物理机或虚拟机"
    },
    {
      "id": 2,
      "uid": "switch",
      "name": "交换机"
    }
  ]
}
```

### 3. 获取模型详情
```http
GET /api/v1/dynamic-models/:uid
```

**示例**：
```http
GET /api/v1/dynamic-models/host
```

### 4. 更新模型
```http
PUT /api/v1/dynamic-models/:uid
Content-Type: application/json

{
  "name": "物理主机",
  "description": "数据中心物理服务器"
}
```

### 5. 删除模型
```http
DELETE /api/v1/dynamic-models/:uid
```

---

## 属性管理 API

### 1. 创建属性
```http
POST /api/v1/dynamic-models/:uid/attributes
Content-Type: application/json

{
  "field_uid": "cpu_cores",
  "field_name": "CPU 核数",
  "field_type": "int",
  "category": "config",
  "is_required": false,
  "unit": "核",
  "validators": {
    "min": 1,
    "max": 256,
    "error_message": "CPU 核数必须在 1-256 之间"
  }
}
```

**字段类型**：
- `string` - 字符串
- `int` - 整数
- `float` - 浮点数
- `bool` - 布尔值
- `enum` - 枚举
- `date` - 日期

**Category**：
- `config` - 配置数据（存入 resources 表）
- `state` - 状态数据（存入 resource_states 表）

**Validators**：
```json
{
  // 数值类型
  "min": 1,
  "max": 100,

  // 字符串类型
  "min_length": 3,
  "max_length": 63,
  "pattern": "^[a-z0-9-]+$",

  // 枚举类型
  "enum_values": ["linux", "windows", "aix"],

  // 自定义错误消息
  "error_message": "格式不正确"
}
```

### 2. 列出模型的所有属性
```http
GET /api/v1/dynamic-models/:uid/attributes
```

### 3. 更新属性
```http
PUT /api/v1/dynamic-models/:uid/attributes/:field_uid
Content-Type: application/json

{
  "field_name": "CPU 核心数",
  "validators": {
    "min": 2,
    "max": 512
  }
}
```

### 4. 删除属性
```http
DELETE /api/v1/dynamic-models/:uid/attributes/:field_uid
```

---

## 资源实例管理 API

### 1. 创建/更新资源实例（智能 Upsert）
```http
POST /api/v1/dynamic-models/:uid/instances
Content-Type: application/json
X-User-ID: admin

{
  "data": {
    "cloud_id": 0,
    "inner_ip": "192.168.1.100",
    "hostname": "web-server-01",
    "cpu_cores": 16,
    "memory_gb": 64.0,
    "os_type": "linux",
    "cpu_usage": 45.5,
    "memory_usage": 60.2
  }
}
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "resource_id": 123,
    "message": "操作成功"
  }
}
```

**说明**：
- 如果 `cloud_id` + `inner_ip` 已存在，会自动更新
- `cpu_usage`, `memory_usage` 等 `state` 类型字段会自动写入 `resource_states` 表
- 自动记录审计日志

**错误响应**：
```json
// 校验失败
{
  "error": "[VALIDATION_FAILED] CPU 核数必须在 1-256 之间",
  "details": {
    "field": "cpu_cores",
    "value": 300,
    "rule": "max"
  }
}

// 唯一性冲突
{
  "error": "[DUPLICATE_RESOURCE] 资源已存在，字段 [cloud_id, inner_ip] 违反唯一性约束",
  "details": {
    "model": "host",
    "conflict_fields": ["cloud_id", "inner_ip"]
  }
}
```

### 2. 获取资源实例
```http
GET /api/v1/dynamic-models/:uid/instances/:id
```

**示例**：
```http
GET /api/v1/dynamic-models/host/instances/123
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "id": 123,
    "model_uid": "host",
    "name": "web-server-01",
    "configs": {
      "cloud_id": 0,
      "inner_ip": "192.168.1.100",
      "hostname": "web-server-01",
      "cpu_cores": 16,
      "memory_gb": 64.0,
      "os_type": "linux"
    },
    "created_at": "2026-02-07T10:00:00Z",
    "updated_at": "2026-02-07T11:30:00Z",
    "state": {
      "resource_id": 123,
      "last_check_time": "2026-02-07T11:30:00Z",
      "health_status": 0,
      "metrics": {
        "cpu_usage": 45.5,
        "memory_usage": 60.2
      }
    }
  }
}
```

### 3. 列出资源实例
```http
GET /api/v1/dynamic-models/:uid/instances?page=1&page_size=20&os_type=linux
```

**查询参数**：
- `page` - 页码（默认 1）
- `page_size` - 每页大小（默认 20，最大 100）
- 其他参数作为 JSONB 过滤条件（如 `os_type=linux`）

**响应**：
```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": 123,
        "model_uid": "host",
        "name": "web-server-01",
        "configs": {...}
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 150,
      "total_page": 8
    }
  }
}
```

### 4. 删除资源实例
```http
DELETE /api/v1/dynamic-models/:uid/instances/:id
X-User-ID: admin
```

---

## 关联关系管理 API

### 1. 创建关联关系
```http
POST /api/v1/dynamic-models/relations
Content-Type: application/json

{
  "source_id": 123,
  "target_id": 456,
  "association_uid": "runs_on"
}
```

**内置关联类型**：
- `runs_on` - 运行于（虚拟机运行在物理机）
- `deployed_on` - 部署于（应用部署在虚拟机）
- `connects_to` - 连接到（主机连接到交换机）
- `belongs_to` - 属于（网卡属于主机）
- `depends_on` - 依赖于（服务依赖数据库）
- `composed_of` - 组成（集群由节点组成）

### 2. 查询资源的关联关系
```http
GET /api/v1/dynamic-models/instances/:id/relations?direction=both&association_uid=runs_on
```

**查询参数**：
- `direction` - 方向：`source`（作为源）、`target`（作为目标）、`both`（两者，默认）
- `association_uid` - 关联类型过滤（可选）

**响应**：
```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "source_id": 123,
      "target_id": 456,
      "association_uid": "runs_on",
      "source_model_uid": "vm",
      "target_model_uid": "host",
      "created_at": "2026-02-07T10:00:00Z"
    }
  ]
}
```

### 3. 删除关联关系
```http
DELETE /api/v1/dynamic-models/relations/:id
```

---

## 拓扑查询 API

### 查询拓扑关系
```http
GET /api/v1/dynamic-models/instances/:id/topology?max_depth=5&reverse=false&association_uids=runs_on,connects_to
```

**查询参数**：
- `max_depth` - 最大递归深度（默认 5，最大 10）
- `reverse` - 是否反向查询（查找父节点，默认 false）
- `association_uids` - 关联类型过滤，逗号分隔（可选）

**响应**：
```json
{
  "code": 0,
  "data": [
    {
      "resource_id": 123,
      "model_uid": "vm",
      "name": "web-vm-01",
      "association_uid": "",
      "depth": 0,
      "path": "123"
    },
    {
      "resource_id": 456,
      "model_uid": "host",
      "name": "physical-host-01",
      "association_uid": "runs_on",
      "depth": 1,
      "path": "123.456"
    },
    {
      "resource_id": 789,
      "model_uid": "switch",
      "name": "switch-01",
      "association_uid": "connects_to",
      "depth": 2,
      "path": "123.456.789"
    }
  ]
}
```

---

## 审计日志 API

### 查询资源变更历史
```http
GET /api/v1/dynamic-models/instances/:id/history?page=1&page_size=20
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": 1,
        "resource_id": 123,
        "model_uid": "host",
        "change_type": "update",
        "before_data": {
          "cpu_cores": 16,
          "memory_gb": 64.0
        },
        "after_data": {
          "cpu_cores": 32,
          "memory_gb": 128.0
        },
        "changed_by": "admin",
        "changed_at": "2026-02-07T11:30:00Z",
        "client_ip": "192.168.1.1",
        "user_agent": "Mozilla/5.0..."
      },
      {
        "change_type": "create",
        "before_data": null,
        "after_data": {...},
        "changed_at": "2026-02-07T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 5,
      "total_page": 1
    }
  }
}
```

---

## 🚀 完整使用流程示例

### 1. 定义主机模型
```bash
# 创建模型
curl -X POST http://localhost:8080/api/v1/dynamic-models \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "host",
    "name": "主机",
    "unique_fields": {
      "fields": ["cloud_id", "inner_ip"]
    }
  }'

# 添加配置字段
curl -X POST http://localhost:8080/api/v1/dynamic-models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "field_uid": "cloud_id",
    "field_name": "云区域 ID",
    "field_type": "int",
    "category": "config",
    "is_required": true,
    "unique_group": "primary"
  }'

curl -X POST http://localhost:8080/api/v1/dynamic-models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "field_uid": "inner_ip",
    "field_name": "内网 IP",
    "field_type": "string",
    "category": "config",
    "is_required": true,
    "unique_group": "primary"
  }'

# 添加状态字段
curl -X POST http://localhost:8080/api/v1/dynamic-models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "field_uid": "cpu_usage",
    "field_name": "CPU 使用率",
    "field_type": "float",
    "category": "state",
    "unit": "%"
  }'
```

### 2. 创建主机实例
```bash
curl -X POST http://localhost:8080/api/v1/dynamic-models/host/instances \
  -H "Content-Type: application/json" \
  -H "X-User-ID: admin" \
  -d '{
    "data": {
      "cloud_id": 0,
      "inner_ip": "192.168.1.100",
      "hostname": "web-server-01",
      "cpu_cores": 16,
      "cpu_usage": 45.5
    }
  }'
```

### 3. 更新主机（相同唯一键自动识别）
```bash
curl -X POST http://localhost:8080/api/v1/dynamic-models/host/instances \
  -H "Content-Type: application/json" \
  -H "X-User-ID: admin" \
  -d '{
    "data": {
      "cloud_id": 0,
      "inner_ip": "192.168.1.100",
      "cpu_cores": 32,
      "cpu_usage": 25.3
    }
  }'
```

### 4. 查询和拓扑
```bash
# 列出所有 Linux 主机
curl "http://localhost:8080/api/v1/dynamic-models/host/instances?os_type=linux&page=1&page_size=20"

# 查询拓扑关系
curl "http://localhost:8080/api/v1/dynamic-models/instances/123/topology?max_depth=5"

# 查看变更历史
curl "http://localhost:8080/api/v1/dynamic-models/instances/123/history"
```

---

## ✅ 特性总结

1. **智能 Upsert** - 自动识别创建/更新
2. **严格校验** - 类型、范围、正则全覆盖
3. **冷热分离** - config/state 自动分流
4. **审计日志** - 自动记录变更历史
5. **拓扑查询** - 递归查询关联关系
6. **友好错误** - 详细的错误提示和 details
