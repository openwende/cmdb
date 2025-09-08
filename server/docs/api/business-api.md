# 业务拓扑API

业务拓扑API提供业务层面的组织结构管理，支持树形结构和实例关联。

## 基础信息

- **Base URL**: `/api/v1/business`
- **认证方式**: JWT Bearer Token
- **内容类型**: `application/json`

## 数据模型

### BusinessNode (业务节点)

```json
{
  "id": "uuid",
  "name": "string",
  "parent_id": "uuid",
  "tenant_id": "uuid",
  "level": "int",
  "path": "string",
  "description": "string",
  "metadata": "json",
  "children": ["BusinessNode"],
  "instances": ["Instance"],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### BusinessInstance (业务实例关联)

```json
{
  "id": "uuid",
  "business_node_id": "uuid",
  "instance_id": "uuid",
  "role": "string",
  "weight": "int",
  "metadata": "json",
  "created_at": "datetime"
}
```

## API端点

### 1. 创建业务节点

创建新的业务节点。

**请求**
```http
POST /api/v1/business/nodes
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "电商平台",
  "parent_id": null,
  "description": "在线电商业务平台",
  "metadata": {
    "owner": "platform-team",
    "contact": "platform@company.com",
    "business_type": "e-commerce"
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
    "id": "550e8400-e29b-41d4-a716-446655440100",
    "name": "电商平台",
    "parent_id": null,
    "level": 1,
    "path": "/电商平台",
    "description": "在线电商业务平台",
    "metadata": {
      "owner": "platform-team",
      "contact": "platform@company.com",
      "business_type": "e-commerce"
    },
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2. 获取业务拓扑树

获取完整的业务拓扑树结构。

**请求**
```http
GET /api/v1/business/tree?max_depth=5&include_instances=true
Authorization: Bearer <token>
```

**参数**
- `max_depth` (可选): 最大深度，默认不限制
- `include_instances` (可选): 是否包含实例信息
- `root_id` (可选): 指定根节点ID

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440100",
        "name": "电商平台",
        "level": 1,
        "path": "/电商平台",
        "children": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440101",
            "name": "用户服务",
            "level": 2,
            "path": "/电商平台/用户服务",
            "instances": [
              {
                "id": "550e8400-e29b-41d4-a716-446655440201",
                "name": "user-service-01",
                "model": {
                  "name": "应用"
                },
                "role": "primary"
              }
            ]
          }
        ]
      }
    ],
    "total_nodes": 15,
    "max_depth": 4
  }
}
```

### 3. 获取节点详情

获取指定业务节点的详细信息。

**请求**
```http
GET /api/v1/business/nodes/{node_id}?include=children,instances,parent
Authorization: Bearer <token>
```

**参数**
- `include` (可选): 包含的关联数据，可选值：`children`, `instances`, `parent`, `ancestors`

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440101",
    "name": "用户服务",
    "parent_id": "550e8400-e29b-41d4-a716-446655440100",
    "level": 2,
    "path": "/电商平台/用户服务",
    "description": "用户管理相关服务",
    "metadata": {
      "team": "user-team",
      "service_type": "microservice"
    },
    "parent": {
      "id": "550e8400-e29b-41d4-a716-446655440100",
      "name": "电商平台"
    },
    "children": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440102",
        "name": "用户认证",
        "level": 3,
        "instance_count": 2
      }
    ],
    "instances": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440201",
        "name": "user-service-01",
        "model": {
          "name": "应用"
        },
        "role": "primary",
        "weight": 100
      }
    ],
    "instance_count": 5,
    "children_count": 3,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 4. 更新业务节点

更新业务节点信息。

**请求**
```http
PUT /api/v1/business/nodes/{node_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "用户管理服务",
  "description": "用户管理和认证相关服务",
  "metadata": {
    "team": "user-team",
    "service_type": "microservice",
    "version": "2.0"
  }
}
```

### 5. 移动业务节点

移动节点到新的父节点下。

**请求**
```http
POST /api/v1/business/nodes/{node_id}/move
Content-Type: application/json
Authorization: Bearer <token>

{
  "new_parent_id": "550e8400-e29b-41d4-a716-446655440105",
  "position": "first"
}
```

**参数**
- `new_parent_id`: 新父节点ID，null表示移动到根级别
- `position` (可选): 位置，`first`/`last`/`after:node_id`/`before:node_id`

### 6. 删除业务节点

删除业务节点（必须为空节点）。

**请求**
```http
DELETE /api/v1/business/nodes/{node_id}?force=false
Authorization: Bearer <token>
```

**参数**
- `force` (可选): 是否强制删除（包含子节点和实例）

## 实例关联API

### 1. 关联实例到业务节点

将配置项实例关联到业务节点。

**请求**
```http
POST /api/v1/business/nodes/{node_id}/instances
Content-Type: application/json
Authorization: Bearer <token>

{
  "instance_id": "550e8400-e29b-41d4-a716-446655440201",
  "role": "primary",
  "weight": 100,
  "metadata": {
    "service_port": "8080",
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
    "id": "550e8400-e29b-41d4-a716-446655440301",
    "business_node_id": "550e8400-e29b-41d4-a716-446655440101",
    "instance_id": "550e8400-e29b-41d4-a716-446655440201",
    "role": "primary",
    "weight": 100,
    "metadata": {
      "service_port": "8080",
      "environment": "production"
    },
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2. 获取节点实例列表

获取业务节点关联的所有实例。

**请求**
```http
GET /api/v1/business/nodes/{node_id}/instances?role=primary&model_id=550e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <token>
```

**参数**
- `role` (可选): 角色过滤
- `model_id` (可选): 模型过滤
- `include_children` (可选): 是否包含子节点的实例

### 3. 移除实例关联

移除实例与业务节点的关联。

**请求**
```http
DELETE /api/v1/business/nodes/{node_id}/instances/{instance_id}
Authorization: Bearer <token>
```

## 业务查询API

### 1. 搜索业务节点

搜索业务节点。

**请求**
```http
POST /api/v1/business/search
Content-Type: application/json
Authorization: Bearer <token>

{
  "query": "用户",
  "filters": [
    {
      "field": "level",
      "operator": "eq",
      "value": 2
    },
    {
      "field": "metadata.team",
      "operator": "eq",
      "value": "user-team"
    }
  ],
  "include_instances": true,
  "sort": [
    {
      "field": "name",
      "order": "asc"
    }
  ]
}
```

### 2. 获取节点路径

获取从根节点到指定节点的完整路径。

**请求**
```http
GET /api/v1/business/nodes/{node_id}/path
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "path": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440100",
        "name": "电商平台",
        "level": 1
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440101",
        "name": "用户服务",
        "level": 2
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440102",
        "name": "用户认证",
        "level": 3
      }
    ],
    "path_string": "/电商平台/用户服务/用户认证"
  }
}
```

### 3. 获取节点统计

获取业务拓扑统计信息。

**请求**
```http
GET /api/v1/business/stats?node_id=550e8400-e29b-41d4-a716-446655440100&include_children=true
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "node_count": 25,
    "instance_count": 150,
    "max_depth": 5,
    "model_distribution": {
      "服务器": 45,
      "应用": 35,
      "数据库": 15,
      "负载均衡": 5
    },
    "level_distribution": {
      "1": 1,
      "2": 5,
      "3": 12,
      "4": 7
    }
  }
}
```

## 批量操作API

### 1. 批量创建节点

批量创建业务节点。

**请求**
```http
POST /api/v1/business/nodes/batch
Content-Type: application/json
Authorization: Bearer <token>

{
  "nodes": [
    {
      "name": "订单服务",
      "parent_id": "550e8400-e29b-41d4-a716-446655440100",
      "description": "订单处理服务"
    },
    {
      "name": "支付服务",
      "parent_id": "550e8400-e29b-41d4-a716-446655440100",
      "description": "支付处理服务"
    }
  ]
}
```

### 2. 批量关联实例

批量将实例关联到业务节点。

**请求**
```http
POST /api/v1/business/instances/batch
Content-Type: application/json
Authorization: Bearer <token>

{
  "associations": [
    {
      "business_node_id": "550e8400-e29b-41d4-a716-446655440101",
      "instance_id": "550e8400-e29b-41d4-a716-446655440201",
      "role": "primary"
    },
    {
      "business_node_id": "550e8400-e29b-41d4-a716-446655440101",
      "instance_id": "550e8400-e29b-41d4-a716-446655440202",
      "role": "backup"
    }
  ]
}
```

## 导入导出API

### 1. 导出业务拓扑

导出业务拓扑结构。

**请求**
```http
POST /api/v1/business/export
Content-Type: application/json
Authorization: Bearer <token>

{
  "node_ids": ["550e8400-e29b-41d4-a716-446655440100"],
  "format": "json",
  "include_instances": true,
  "include_metadata": true
}
```

### 2. 导入业务拓扑

从文件导入业务拓扑。

**请求**
```http
POST /api/v1/business/import
Content-Type: multipart/form-data
Authorization: Bearer <token>

file: business_topology.json
merge_strategy: update
validate_only: false
```

## 使用示例

### 创建完整业务拓扑

```bash
# 1. 创建根节点
curl -X POST http://localhost:8080/api/v1/business/nodes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "电商平台",
    "description": "在线电商业务系统"
  }'

# 2. 创建子节点
curl -X POST http://localhost:8080/api/v1/business/nodes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "用户服务",
    "parent_id": "'$PARENT_ID'",
    "description": "用户管理服务模块"
  }'

# 3. 关联实例
curl -X POST http://localhost:8080/api/v1/business/nodes/$NODE_ID/instances \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "instance_id": "'$INSTANCE_ID'",
    "role": "primary",
    "weight": 100
  }'
```

## 最佳实践

### 拓扑设计原则

1. **层次清晰**: 确保业务层次结构清晰合理
2. **命名规范**: 使用一致的命名规范
3. **职责单一**: 每个节点职责明确
4. **扩展性**: 考虑未来扩展需求

### 实例关联策略

1. **角色定义**: 明确实例在业务中的角色
2. **权重设置**: 合理设置实例权重
3. **元数据**: 充分利用元数据记录重要信息
4. **生命周期**: 考虑实例的生命周期管理

### 性能优化

1. **深度控制**: 控制拓扑树的深度
2. **批量操作**: 大量操作时使用批量API
3. **缓存策略**: 合理使用缓存
4. **分页查询**: 大数据量时使用分页