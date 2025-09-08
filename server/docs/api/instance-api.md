# 实例管理API

实例管理API提供配置项实例的创建、查询、更新和删除功能。

## 基础信息

- **Base URL**: `/api/v1/instances`
- **认证方式**: JWT Bearer Token
- **内容类型**: `application/json`

## 数据模型

### Instance (实例)

```json
{
  "id": "uuid",
  "model_id": "uuid",
  "name": "string",
  "status": "active|inactive|deleted",
  "data": "json",
  "created_at": "datetime",
  "updated_at": "datetime",
  "created_by": "uuid",
  "updated_by": "uuid",
  "model": "Model",
  "source_relationships": ["InstanceRelationship"],
  "target_relationships": ["InstanceRelationship"]
}
```

### InstanceRelationship (实例关系)

```json
{
  "id": "uuid",
  "source_instance_id": "uuid",
  "target_instance_id": "uuid",
  "relationship_id": "uuid",
  "created_at": "datetime",
  "source_instance": "Instance",
  "target_instance": "Instance",
  "relationship": "Relationship"
}
```

## API端点

### 1. 创建实例

创建新的配置项实例。

**请求**
```http
POST /api/v1/instances
Content-Type: application/json
Authorization: Bearer <token>

{
  "model_id": "550e8400-e29b-41d4-a716-446655440001",
  "name": "web-server-01",
  "data": {
    "hostname": "web01.example.com",
    "ip_address": "192.168.1.100",
    "cpu_cores": 8,
    "memory_gb": 32,
    "os": "centos7",
    "environment": "production"
  }
}
```

**响应**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "model_id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "web-server-01",
    "status": "active",
    "data": {
      "hostname": "web01.example.com",
      "ip_address": "192.168.1.100",
      "cpu_cores": 8,
      "memory_gb": 32,
      "os": "centos7",
      "environment": "production"
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2. 获取实例列表

获取实例列表，支持分页和过滤。

**请求**
```http
GET /api/v1/instances?page=1&page_size=20&model_id=550e8400-e29b-41d4-a716-446655440001&search=web&status=active
Authorization: Bearer <token>
```

**参数**
- `page` (可选): 页码，默认1
- `page_size` (可选): 每页大小，默认20，最大100
- `model_id` (可选): 模型ID过滤
- `search` (可选): 搜索关键词，在name和data中搜索
- `status` (可选): 状态过滤
- `sort` (可选): 排序字段，如`name:asc`或`created_at:desc`

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "model_id": "550e8400-e29b-41d4-a716-446655440001",
        "name": "web-server-01",
        "status": "active",
        "data": {
          "hostname": "web01.example.com",
          "ip_address": "192.168.1.100",
          "environment": "production"
        },
        "model": {
          "id": "550e8400-e29b-41d4-a716-446655440001",
          "name": "服务器",
          "identifier": "server"
        },
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

### 3. 获取实例详情

获取指定实例的详细信息，包括关系。

**请求**
```http
GET /api/v1/instances/{instance_id}?include=relationships
Authorization: Bearer <token>
```

**参数**
- `include` (可选): 包含的关联数据，可选值：`relationships`, `model`, `audit_logs`

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "model_id": "550e8400-e29b-41d4-a716-446655440001",
    "name": "web-server-01",
    "status": "active",
    "data": {
      "hostname": "web01.example.com",
      "ip_address": "192.168.1.100",
      "cpu_cores": 8,
      "memory_gb": 32,
      "os": "centos7",
      "environment": "production",
      "description": "主要Web服务器"
    },
    "model": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "服务器",
      "identifier": "server",
      "fields": [...]
    },
    "source_relationships": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440020",
        "target_instance_id": "550e8400-e29b-41d4-a716-446655440011",
        "relationship": {
          "name": "部署于",
          "type": "deployment"
        },
        "target_instance": {
          "id": "550e8400-e29b-41d4-a716-446655440011",
          "name": "应用服务",
          "model": {
            "name": "应用"
          }
        }
      }
    ],
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### 4. 更新实例

更新实例信息。

**请求**
```http
PUT /api/v1/instances/{instance_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "web-server-01-updated",
  "data": {
    "hostname": "web01-new.example.com",
    "memory_gb": 64,
    "description": "升级后的Web服务器"
  },
  "partial_update": true
}
```

**参数**
- `partial_update` (可选): 是否部分更新，true时合并现有数据，false时替换全部数据

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "name": "web-server-01-updated",
    "data": {
      "hostname": "web01-new.example.com",
      "ip_address": "192.168.1.100",
      "cpu_cores": 8,
      "memory_gb": 64,
      "os": "centos7",
      "environment": "production",
      "description": "升级后的Web服务器"
    },
    "updated_at": "2024-01-01T01:00:00Z"
  }
}
```

### 5. 删除实例

删除指定实例。

**请求**
```http
DELETE /api/v1/instances/{instance_id}
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "实例删除成功"
}
```

## 高级搜索API

### 1. 复杂搜索

支持复杂条件的实例搜索。

**请求**
```http
POST /api/v1/instances/search
Content-Type: application/json
Authorization: Bearer <token>

{
  "query": "web",
  "model_ids": ["550e8400-e29b-41d4-a716-446655440001"],
  "filters": [
    {
      "field": "environment",
      "operator": "eq",
      "value": "production"
    },
    {
      "field": "cpu_cores",
      "operator": "ge",
      "value": 4
    },
    {
      "field": "ip_address",
      "operator": "like",
      "value": "192.168.1.*"
    }
  ],
  "sort": [
    {
      "field": "name",
      "order": "asc"
    },
    {
      "field": "created_at",
      "order": "desc"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20
  }
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 5,
      "total_pages": 1
    },
    "aggregations": {
      "environment": {
        "production": 3,
        "staging": 2
      },
      "os": {
        "centos7": 4,
        "ubuntu20": 1
      }
    }
  }
}
```

### 2. 聚合查询

获取实例的聚合统计信息。

**请求**
```http
POST /api/v1/instances/aggregate
Content-Type: application/json
Authorization: Bearer <token>

{
  "model_id": "550e8400-e29b-41d4-a716-446655440001",
  "group_by": ["environment", "os"],
  "metrics": [
    {
      "field": "cpu_cores",
      "function": "sum"
    },
    {
      "field": "memory_gb",
      "function": "avg"
    }
  ],
  "filters": [
    {
      "field": "status",
      "operator": "eq",
      "value": "active"
    }
  ]
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
          "environment": "production",
          "os": "centos7"
        },
        "count": 10,
        "metrics": {
          "cpu_cores_sum": 80,
          "memory_gb_avg": 48.5
        }
      }
    ],
    "total_count": 15,
    "total_metrics": {
      "cpu_cores_sum": 120,
      "memory_gb_avg": 42.3
    }
  }
}
```

## 关系管理API

### 1. 创建实例关系

在两个实例之间创建关系。

**请求**
```http
POST /api/v1/instances/relationships
Content-Type: application/json
Authorization: Bearer <token>

{
  "source_instance_id": "550e8400-e29b-41d4-a716-446655440010",
  "target_instance_id": "550e8400-e29b-41d4-a716-446655440011",
  "relationship_id": "550e8400-e29b-41d4-a716-446655440030"
}
```

**响应**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440040",
    "source_instance_id": "550e8400-e29b-41d4-a716-446655440010",
    "target_instance_id": "550e8400-e29b-41d4-a716-446655440011",
    "relationship_id": "550e8400-e29b-41d4-a716-446655440030",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2. 获取实例关系

获取实例的所有关系。

**请求**
```http
GET /api/v1/instances/{instance_id}/relationships?direction=both&relationship_type=deployment
Authorization: Bearer <token>
```

**参数**
- `direction` (可选): 关系方向，`source`/`target`/`both`
- `relationship_type` (可选): 关系类型过滤

### 3. 删除实例关系

删除实例之间的关系。

**请求**
```http
DELETE /api/v1/instances/relationships/{relationship_id}
Authorization: Bearer <token>
```

## 批量操作API

### 1. 批量创建实例

批量创建多个实例。

**请求**
```http
POST /api/v1/instances/batch
Content-Type: application/json
Authorization: Bearer <token>

{
  "instances": [
    {
      "model_id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "web-server-02",
      "data": {
        "hostname": "web02.example.com",
        "ip_address": "192.168.1.101"
      }
    },
    {
      "model_id": "550e8400-e29b-41d4-a716-446655440001",
      "name": "web-server-03",
      "data": {
        "hostname": "web03.example.com",
        "ip_address": "192.168.1.102"
      }
    }
  ]
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "created_count": 2,
    "failed_count": 0,
    "created_instances": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440012",
        "name": "web-server-02"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440013", 
        "name": "web-server-03"
      }
    ],
    "errors": []
  }
}
```

### 2. 批量更新实例

批量更新多个实例。

**请求**
```http
PUT /api/v1/instances/batch
Content-Type: application/json
Authorization: Bearer <token>

{
  "instance_ids": [
    "550e8400-e29b-41d4-a716-446655440012",
    "550e8400-e29b-41d4-a716-446655440013"
  ],
  "updates": {
    "data": {
      "environment": "production",
      "backup_enabled": true
    }
  },
  "partial_update": true
}
```

### 3. 批量删除实例

批量删除多个实例。

**请求**
```http
DELETE /api/v1/instances/batch
Content-Type: application/json
Authorization: Bearer <token>

{
  "instance_ids": [
    "550e8400-e29b-41d4-a716-446655440012",
    "550e8400-e29b-41d4-a716-446655440013"
  ]
}
```

## 导入导出API

### 1. 导出实例

导出实例数据。

**请求**
```http
POST /api/v1/instances/export
Content-Type: application/json
Authorization: Bearer <token>

{
  "model_ids": ["550e8400-e29b-41d4-a716-446655440001"],
  "instance_ids": ["550e8400-e29b-41d4-a716-446655440010"],
  "format": "json",
  "include_relationships": true
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json
Content-Disposition: attachment; filename="instances_export.json"

{
  "metadata": {
    "export_time": "2024-01-01T00:00:00Z",
    "total_instances": 1,
    "models": [...]
  },
  "instances": [...],
  "relationships": [...]
}
```

### 2. 导入实例

从文件导入实例数据。

**请求**
```http
POST /api/v1/instances/import
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: instances.json
model_id: 550e8400-e29b-41d4-a716-446655440001
update_existing: true
validate_only: false
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "processed_count": 100,
    "created_count": 80,
    "updated_count": 15,
    "skipped_count": 3,
    "error_count": 2,
    "errors": [
      {
        "row": 5,
        "field": "ip_address",
        "message": "IP地址格式不正确"
      }
    ]
  }
}
```

## 实例拓扑API

### 1. 获取实例拓扑

获取以指定实例为中心的拓扑关系。

**请求**
```http
GET /api/v1/instances/{instance_id}/topology?max_depth=3&direction=both
Authorization: Bearer <token>
```

**参数**
- `max_depth` (可选): 最大深度，默认2
- `direction` (可选): 拓扑方向，`up`/`down`/`both`
- `relationship_types` (可选): 关系类型过滤

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "root_instance": {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "name": "web-server-01",
      "model": {
        "name": "服务器"
      }
    },
    "nodes": [
      {
        "instance_id": "550e8400-e29b-41d4-a716-446655440011",
        "name": "web-app",
        "model_name": "应用",
        "level": 1,
        "data": {...}
      }
    ],
    "relationships": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440040",
        "source_instance_id": "550e8400-e29b-41d4-a716-446655440010",
        "target_instance_id": "550e8400-e29b-41d4-a716-446655440011",
        "relationship_name": "部署",
        "relationship_type": "deployment"
      }
    ],
    "depth": 2
  }
}
```

## 实例历史API

### 1. 获取实例变更历史

获取实例的变更历史记录。

**请求**
```http
GET /api/v1/instances/{instance_id}/history?start_date=2024-01-01&end_date=2024-01-31&page=1&page_size=20
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "instance_id": "550e8400-e29b-41d4-a716-446655440010",
    "changes": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440050",
        "action": "update",
        "user_id": "550e8400-e29b-41d4-a716-446655440060",
        "user_name": "admin",
        "timestamp": "2024-01-01T01:00:00Z",
        "changes": {
          "memory_gb": {
            "old_value": 32,
            "new_value": 64,
            "action": "modified"
          },
          "description": {
            "old_value": null,
            "new_value": "升级后的Web服务器",
            "action": "added"
          }
        },
        "comment": "内存升级"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 1
    }
  }
}
```

## 实例比较API

### 1. 比较实例

比较多个实例的差异。

**请求**
```http
POST /api/v1/instances/compare
Content-Type: application/json
Authorization: Bearer <token>

{
  "instance_ids": [
    "550e8400-e29b-41d4-a716-446655440010",
    "550e8400-e29b-41d4-a716-446655440012"
  ],
  "compare_fields": ["hostname", "ip_address", "cpu_cores", "memory_gb"]
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "instances": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "name": "web-server-01"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440012",
        "name": "web-server-02"
      }
    ],
    "differences": [
      {
        "field": "hostname",
        "values": {
          "550e8400-e29b-41d4-a716-446655440010": "web01.example.com",
          "550e8400-e29b-41d4-a716-446655440012": "web02.example.com"
        }
      },
      {
        "field": "ip_address",
        "values": {
          "550e8400-e29b-41d4-a716-446655440010": "192.168.1.100",
          "550e8400-e29b-41d4-a716-446655440012": "192.168.1.101"
        }
      }
    ],
    "common_fields": {
      "cpu_cores": 8,
      "memory_gb": 32
    }
  }
}
```

## 使用示例

### 创建服务器实例

```bash
curl -X POST http://localhost:8080/api/v1/instances \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model_id": "'$MODEL_ID'",
    "name": "prod-web-01",
    "data": {
      "hostname": "prod-web-01.company.com",
      "ip_address": "10.0.1.100",
      "cpu_cores": 16,
      "memory_gb": 64,
      "disk_gb": 500,
      "os": "centos7",
      "environment": "production",
      "owner": "web-team",
      "location": "DC-Beijing"
    }
  }'
```

### 搜索生产环境服务器

```bash
curl -X POST http://localhost:8080/api/v1/instances/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model_ids": ["'$SERVER_MODEL_ID'"],
    "filters": [
      {
        "field": "environment",
        "operator": "eq",
        "value": "production"
      },
      {
        "field": "cpu_cores",
        "operator": "ge",
        "value": 8
      }
    ],
    "sort": [
      {"field": "name", "order": "asc"}
    ]
  }'
```

## 最佳实践

### 数据管理

1. **字段验证**: 严格按照模型字段规则验证数据
2. **版本控制**: 记录实例变更历史
3. **数据一致性**: 确保关联数据的一致性
4. **备份策略**: 定期备份重要实例数据

### 性能优化

1. **分页查询**: 大量数据时使用分页
2. **字段过滤**: 只获取需要的字段
3. **批量操作**: 大量操作时使用批量API
4. **缓存策略**: 缓存常用查询结果

### 关系管理

1. **关系约束**: 遵循模型定义的关系约束
2. **循环检测**: 避免创建循环关系
3. **级联删除**: 考虑删除实例对关系的影响
4. **拓扑分析**: 定期分析拓扑结构的合理性