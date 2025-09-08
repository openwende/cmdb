# 审计日志API

审计日志API提供系统操作记录的查询和分析功能，确保所有重要操作都有完整的审计跟踪。

## 基础信息

- **Base URL**: `/api/v1/audit`
- **认证方式**: JWT Bearer Token
- **内容类型**: `application/json`

## 数据模型

### AuditLog (审计日志)

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "user_id": "uuid",
  "username": "string",
  "action": "string",
  "resource_type": "string",
  "resource_id": "string",
  "resource_name": "string",
  "request_method": "string",
  "request_path": "string",
  "request_body": "json",
  "response_status": "int",
  "response_body": "json",
  "ip_address": "string",
  "user_agent": "string",
  "session_id": "string",
  "duration_ms": "int",
  "error_message": "string",
  "metadata": "json",
  "created_at": "datetime"
}
```

### AuditSummary (审计汇总)

```json
{
  "period": "string",
  "total_operations": "int",
  "success_count": "int",
  "error_count": "int",
  "user_count": "int",
  "top_actions": [
    {
      "action": "string",
      "count": "int"
    }
  ],
  "top_users": [
    {
      "username": "string",
      "operation_count": "int"
    }
  ]
}
```

## API端点

### 1. 获取审计日志列表

获取审计日志列表，支持多种过滤条件。

**请求**
```http
GET /api/v1/audit/logs?page=1&page_size=50&start_date=2024-01-01&end_date=2024-01-31&action=create&resource_type=model&user_id=550e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <token>
```

**参数**
- `page` (可选): 页码，默认1
- `page_size` (可选): 每页大小，默认50，最大200
- `start_date` (可选): 开始日期，格式：YYYY-MM-DD
- `end_date` (可选): 结束日期，格式：YYYY-MM-DD
- `action` (可选): 操作类型过滤
- `resource_type` (可选): 资源类型过滤
- `resource_id` (可选): 资源ID过滤
- `user_id` (可选): 用户ID过滤
- `username` (可选): 用户名过滤
- `ip_address` (可选): IP地址过滤
- `status` (可选): 响应状态过滤，`success`/`error`
- `search` (可选): 关键词搜索

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440500",
        "user_id": "550e8400-e29b-41d4-a716-446655440001",
        "username": "admin",
        "action": "create_model",
        "resource_type": "model",
        "resource_id": "550e8400-e29b-41d4-a716-446655440100",
        "resource_name": "服务器模型",
        "request_method": "POST",
        "request_path": "/api/v1/models",
        "response_status": 201,
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0...",
        "duration_ms": 150,
        "created_at": "2024-01-01T10:30:00Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440501",
        "user_id": "550e8400-e29b-41d4-a716-446655440002",
        "username": "operator",
        "action": "update_instance",
        "resource_type": "instance",
        "resource_id": "550e8400-e29b-41d4-a716-446655440200",
        "resource_name": "web-server-01",
        "request_method": "PUT",
        "request_path": "/api/v1/instances/550e8400-e29b-41d4-a716-446655440200",
        "response_status": 200,
        "ip_address": "192.168.1.101",
        "duration_ms": 89,
        "created_at": "2024-01-01T10:35:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 50,
      "total": 1250,
      "total_pages": 25
    }
  }
}
```

### 2. 获取审计日志详情

获取指定审计日志的详细信息。

**请求**
```http
GET /api/v1/audit/logs/{log_id}
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440500",
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "username": "admin",
    "action": "create_model",
    "resource_type": "model",
    "resource_id": "550e8400-e29b-41d4-a716-446655440100",
    "resource_name": "服务器模型",
    "request_method": "POST",
    "request_path": "/api/v1/models",
    "request_body": {
      "name": "服务器",
      "identifier": "server",
      "description": "物理服务器或虚拟机"
    },
    "response_status": 201,
    "response_body": {
      "success": true,
      "data": {
        "id": "550e8400-e29b-41d4-a716-446655440100",
        "name": "服务器"
      }
    },
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "session_id": "sess_abc123",
    "duration_ms": 150,
    "metadata": {
      "client_version": "1.0.0",
      "api_version": "v1"
    },
    "created_at": "2024-01-01T10:30:00Z"
  }
}
```

### 3. 获取审计统计

获取审计日志的统计信息。

**请求**
```http
GET /api/v1/audit/stats?period=week&start_date=2024-01-01&end_date=2024-01-31&group_by=action,user,resource_type
Authorization: Bearer <token>
```

**参数**
- `period` (可选): 统计周期，`hour`/`day`/`week`/`month`
- `start_date` (可选): 开始日期
- `end_date` (可选): 结束日期
- `group_by` (可选): 分组字段，多个用逗号分隔

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "summary": {
      "total_operations": 5420,
      "success_count": 5180,
      "error_count": 240,
      "success_rate": 95.57,
      "unique_users": 25,
      "avg_duration_ms": 125
    },
    "time_series": [
      {
        "period": "2024-01-01",
        "operations": 180,
        "success": 175,
        "errors": 5
      },
      {
        "period": "2024-01-02",
        "operations": 220,
        "success": 210,
        "errors": 10
      }
    ],
    "action_distribution": [
      {
        "action": "read",
        "count": 3200,
        "percentage": 59.04
      },
      {
        "action": "create",
        "count": 1100,
        "percentage": 20.30
      },
      {
        "action": "update",
        "count": 800,
        "percentage": 14.76
      },
      {
        "action": "delete",
        "count": 320,
        "percentage": 5.90
      }
    ],
    "user_distribution": [
      {
        "username": "admin",
        "operations": 850,
        "success": 840,
        "errors": 10
      },
      {
        "username": "operator",
        "operations": 650,
        "success": 635,
        "errors": 15
      }
    ],
    "resource_distribution": [
      {
        "resource_type": "instance",
        "count": 2800,
        "percentage": 51.66
      },
      {
        "resource_type": "model",
        "count": 1200,
        "percentage": 22.14
      },
      {
        "resource_type": "user",
        "count": 900,
        "percentage": 16.61
      }
    ]
  }
}
```

### 4. 获取用户操作历史

获取指定用户的操作历史。

**请求**
```http
GET /api/v1/audit/users/{user_id}/history?page=1&page_size=20&start_date=2024-01-01&action=create,update,delete
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "admin",
      "display_name": "系统管理员"
    },
    "operations": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440500",
        "action": "create_model",
        "resource_type": "model",
        "resource_name": "服务器模型",
        "status": "success",
        "created_at": "2024-01-01T10:30:00Z"
      }
    ],
    "summary": {
      "total_operations": 85,
      "period_operations": 20,
      "success_rate": 97.65,
      "most_frequent_action": "read",
      "last_operation": "2024-01-01T15:45:00Z"
    },
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 85
    }
  }
}
```

### 5. 获取资源操作历史

获取指定资源的操作历史。

**请求**
```http
GET /api/v1/audit/resources/{resource_type}/{resource_id}/history
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "resource": {
      "id": "550e8400-e29b-41d4-a716-446655440100",
      "type": "model",
      "name": "服务器模型"
    },
    "operations": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440500",
        "action": "create",
        "user": {
          "username": "admin",
          "display_name": "系统管理员"
        },
        "changes": {
          "created": {
            "name": "服务器",
            "identifier": "server"
          }
        },
        "created_at": "2024-01-01T10:30:00Z"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440501",
        "action": "update",
        "user": {
          "username": "admin",
          "display_name": "系统管理员"
        },
        "changes": {
          "modified": {
            "description": {
              "old": "服务器模型",
              "new": "物理服务器或虚拟机模型"
            }
          }
        },
        "created_at": "2024-01-01T11:15:00Z"
      }
    ],
    "summary": {
      "total_operations": 5,
      "created_at": "2024-01-01T10:30:00Z",
      "last_modified": "2024-01-01T11:15:00Z",
      "last_accessed": "2024-01-01T15:20:00Z"
    }
  }
}
```

## 高级查询API

### 1. 复杂条件查询

支持复杂条件的审计日志查询。

**请求**
```http
POST /api/v1/audit/search
Content-Type: application/json
Authorization: Bearer <token>

{
  "filters": [
    {
      "field": "action",
      "operator": "in",
      "value": ["create", "update", "delete"]
    },
    {
      "field": "response_status",
      "operator": "ge",
      "value": 400
    },
    {
      "field": "duration_ms",
      "operator": "gt",
      "value": 1000
    },
    {
      "field": "created_at",
      "operator": "between",
      "value": ["2024-01-01T00:00:00Z", "2024-01-31T23:59:59Z"]
    }
  ],
  "sort": [
    {
      "field": "created_at",
      "order": "desc"
    },
    {
      "field": "duration_ms",
      "order": "desc"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 50
  },
  "include_details": true
}
```

### 2. 聚合分析

获取审计日志的聚合分析结果。

**请求**
```http
POST /api/v1/audit/aggregate
Content-Type: application/json
Authorization: Bearer <token>

{
  "group_by": ["action", "resource_type"],
  "metrics": [
    {
      "field": "duration_ms",
      "function": "avg"
    },
    {
      "field": "response_status",
      "function": "count"
    }
  ],
  "filters": [
    {
      "field": "created_at",
      "operator": "gte",
      "value": "2024-01-01T00:00:00Z"
    }
  ],
  "time_bucket": "day"
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "groups": [
      {
        "group_key": {
          "action": "create",
          "resource_type": "model"
        },
        "metrics": {
          "duration_ms_avg": 145.5,
          "response_status_count": 25
        },
        "time_series": [
          {
            "time": "2024-01-01T00:00:00Z",
            "duration_ms_avg": 130.2,
            "response_status_count": 5
          }
        ]
      }
    ],
    "total_groups": 12
  }
}
```

## 导出API

### 1. 导出审计日志

导出审计日志数据。

**请求**
```http
POST /api/v1/audit/export
Content-Type: application/json
Authorization: Bearer <token>

{
  "format": "csv",
  "filters": [
    {
      "field": "created_at",
      "operator": "gte",
      "value": "2024-01-01T00:00:00Z"
    }
  ],
  "fields": [
    "created_at",
    "username",
    "action",
    "resource_type",
    "resource_name",
    "ip_address",
    "response_status"
  ],
  "include_headers": true
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: text/csv
Content-Disposition: attachment; filename="audit_logs_2024-01-01.csv"

created_at,username,action,resource_type,resource_name,ip_address,response_status
2024-01-01T10:30:00Z,admin,create_model,model,服务器模型,192.168.1.100,201
2024-01-01T10:35:00Z,operator,update_instance,instance,web-server-01,192.168.1.101,200
```

### 2. 生成审计报告

生成详细的审计报告。

**请求**
```http
POST /api/v1/audit/reports
Content-Type: application/json
Authorization: Bearer <token>

{
  "report_type": "security",
  "period": {
    "start": "2024-01-01T00:00:00Z",
    "end": "2024-01-31T23:59:59Z"
  },
  "include_sections": [
    "summary",
    "user_activity",
    "security_events",
    "resource_changes",
    "error_analysis"
  ],
  "format": "pdf"
}
```

## 实时监控API

### 1. 获取实时活动

获取当前活跃的操作。

**请求**
```http
GET /api/v1/audit/live?limit=20&min_duration=100
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "active_operations": [
      {
        "session_id": "sess_abc123",
        "username": "admin",
        "action": "bulk_import",
        "resource_type": "instance",
        "started_at": "2024-01-01T15:30:00Z",
        "duration_ms": 5000,
        "status": "running"
      }
    ],
    "recent_operations": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440502",
        "username": "operator",
        "action": "read",
        "resource_type": "model",
        "duration_ms": 25,
        "created_at": "2024-01-01T15:32:00Z"
      }
    ]
  }
}
```

### 2. WebSocket 实时推送

```javascript
// WebSocket连接示例
const ws = new WebSocket('ws://localhost:8080/api/v1/audit/live');

ws.onmessage = function(event) {
  const auditEvent = JSON.parse(event.data);
  console.log('New audit event:', auditEvent);
};
```

## 配置API

### 1. 获取审计配置

获取当前审计配置。

**请求**
```http
GET /api/v1/audit/config
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "enabled": true,
    "retention_days": 365,
    "log_request_body": true,
    "log_response_body": false,
    "excluded_paths": [
      "/health",
      "/metrics"
    ],
    "sensitive_fields": [
      "password",
      "token",
      "secret"
    ],
    "async_logging": true,
    "compression_enabled": true
  }
}
```

### 2. 更新审计配置

更新审计配置（需要管理员权限）。

**请求**
```http
PUT /api/v1/audit/config
Content-Type: application/json
Authorization: Bearer <token>

{
  "retention_days": 730,
  "log_response_body": true,
  "excluded_paths": [
    "/health",
    "/metrics",
    "/static"
  ]
}
```

## 使用示例

### 查询安全相关操作

```bash
# 查询失败的登录尝试
curl -X GET "http://localhost:8080/api/v1/audit/logs?action=login&status=error" \
  -H "Authorization: Bearer $TOKEN"

# 查询权限相关操作
curl -X GET "http://localhost:8080/api/v1/audit/logs?resource_type=user,role&action=create,update,delete" \
  -H "Authorization: Bearer $TOKEN"
```

### 生成合规报告

```bash
# 生成月度审计报告
curl -X POST http://localhost:8080/api/v1/audit/reports \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "report_type": "compliance",
    "period": {
      "start": "2024-01-01T00:00:00Z",
      "end": "2024-01-31T23:59:59Z"
    },
    "format": "pdf"
  }'
```

## 最佳实践

### 审计策略

1. **全覆盖**: 确保所有重要操作都有审计记录
2. **数据保护**: 避免记录敏感信息
3. **性能考虑**: 使用异步日志记录
4. **存储管理**: 定期清理过期日志

### 查询优化

1. **时间范围**: 限制查询时间范围
2. **索引利用**: 利用索引字段进行查询
3. **分页查询**: 避免大量数据传输
4. **缓存策略**: 缓存常用统计结果

### 安全考虑

1. **访问控制**: 严格控制审计日志访问权限
2. **日志完整性**: 确保日志不被篡改
3. **异常监控**: 监控异常操作模式
4. **合规要求**: 满足行业合规要求