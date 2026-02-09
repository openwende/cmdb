# CMDB 前端接入指南

本文档为前端工程师提供 CMDB 后端 API 的接入指南。

## 目录

1. [快速开始](#快速开始)
2. [API 概览](#api-概览)
3. [认证与授权](#认证与授权)
4. [通用响应格式](#通用响应格式)
5. [核心 API 详解](#核心-api-详解)
6. [错误处理](#错误处理)
7. [最佳实践](#最佳实践)

---

## 快速开始

### 基础信息

| 项目 | 值 |
|------|-----|
| Base URL | `http://localhost:8080` |
| API 前缀 | `/api/v1` |
| 内容类型 | `application/json` |
| 字符编码 | `UTF-8` |

### 第一个请求

```bash
# 健康检查
curl http://localhost:8080/health

# 获取业务列表
curl http://localhost:8080/api/v1/businesses
```

---

## API 概览

### 模块分类

| 模块 | 路径前缀 | 说明 |
|------|----------|------|
| 业务管理 | `/api/v1/businesses` | 业务 CRUD |
| 动态模型 | `/api/v1/dynamic-models` | 模型定义和资源管理 |
| 业务拓扑 | `/api/v1/topology` | 集群、模块、主机拓扑 |
| 导入导出 | `/api/v1/dynamic-models/:uid/...` | Excel 批量导入导出 |

### 资源层级关系

```
Business (业务)
├── Set (集群)
│   ├── Module (模块)
│   │   └── Host (主机)
│   └── Module
└── Set
```

---

## 通用响应格式

### 成功响应

```json
{
  "code": 0,
  "message": "success",
  "data": {
    // 具体数据
  }
}
```

### 分页响应

```json
{
  "code": 0,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 100,
      "total_pages": 5
    }
  }
}
```

### 错误响应

```json
{
  "code": 400,
  "error": "错误描述",
  "details": {
    // 可选的详细信息
  }
}
```

---

## 核心 API 详解

### 1. 业务管理

#### 获取业务列表

```http
GET /api/v1/businesses?page=1&page_size=20
```

**响应示例:**

```json
{
  "code": 0,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "游戏业务",
        "description": "游戏服务器管理",
        "lifecycle": "active",
        "maintainers": ["admin", "ops"],
        "created_at": "2026-01-15T10:30:00Z",
        "updated_at": "2026-01-15T10:30:00Z"
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

#### 创建业务

```http
POST /api/v1/businesses
Content-Type: application/json

{
  "name": "新业务",
  "description": "业务描述",
  "maintainers": ["admin"]
}
```

#### 更新业务

```http
PUT /api/v1/businesses/:id
Content-Type: application/json

{
  "name": "更新后的名称",
  "description": "更新后的描述"
}
```

#### 删除业务

```http
DELETE /api/v1/businesses/:id
```

**注意:** 业务下有资源时无法删除，需要先清理资源。

---

### 2. 动态模型

动态模型系统支持自定义资源类型和字段。

#### 获取模型列表

```http
GET /api/v1/dynamic-models
```

**响应示例:**

```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "uid": "host",
      "name": "主机",
      "description": "物理机或虚拟机",
      "icon": "server",
      "is_paused": false
    }
  ]
}
```

#### 获取模型详情（含属性）

```http
GET /api/v1/dynamic-models/:uid
```

#### 获取模型属性列表

```http
GET /api/v1/dynamic-models/:uid/attributes
```

**响应示例:**

```json
{
  "code": 0,
  "data": [
    {
      "id": 1,
      "model_uid": "host",
      "field_uid": "primary_ip",
      "field_name": "主IP地址",
      "field_type": "string",
      "category": "config",
      "is_required": true,
      "is_unique": false,
      "unique_group": "primary",
      "validators": {
        "pattern": "^(\\d{1,3}\\.){3}\\d{1,3}$",
        "error_message": "IP地址格式不正确"
      }
    }
  ]
}
```

#### 字段类型说明

| 类型 | 说明 | 示例值 |
|------|------|--------|
| `string` | 字符串 | `"hello"` |
| `int` | 整数 | `100` |
| `float` | 浮点数 | `99.5` |
| `bool` | 布尔值 | `true` / `false` |
| `enum` | 枚举 | `"linux"` |
| `date` | 日期 | `"2026-01-15"` |

#### 字段分类说明

| 分类 | 说明 | 存储位置 |
|------|------|----------|
| `config` | 配置数据（低频变更） | `resources.configs` |
| `state` | 状态数据（高频变更） | `resource_states.metrics` |

---

### 3. 资源实例

#### 创建资源实例

```http
POST /api/v1/dynamic-models/:uid/instances
Content-Type: application/json

{
  "name": "web-server-01",
  "data": {
    "primary_ip": "192.168.1.100",
    "cpu": 16,
    "memory": 32768,
    "os_type": "linux"
  }
}
```

#### 获取资源列表

```http
GET /api/v1/dynamic-models/:uid/instances?page=1&page_size=20
```

**支持的查询参数:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | int | 页码，默认 1 |
| `page_size` | int | 每页数量，默认 20 |
| `sort_by` | string | 排序字段 |
| `sort_order` | string | `asc` 或 `desc` |
| `filter[field]` | string | 按字段过滤 |

**过滤示例:**

```http
GET /api/v1/dynamic-models/host/instances?filter[os_type]=linux&filter[status]=running
```

#### 获取资源详情

```http
GET /api/v1/dynamic-models/:uid/instances/:id
```

#### 更新资源

```http
PUT /api/v1/dynamic-models/:uid/instances/:id
Content-Type: application/json

{
  "data": {
    "cpu": 32,
    "memory": 65536
  }
}
```

#### 删除资源

```http
DELETE /api/v1/dynamic-models/:uid/instances/:id
```

---

### 4. 业务拓扑

#### 获取拓扑树

```http
GET /api/v1/topology/tree?business_id=:uuid&max_depth=3&include_hosts=false
```

**参数说明:**

| 参数 | 类型 | 说明 |
|------|------|------|
| `business_id` | UUID | 可选，指定业务 |
| `max_depth` | int | 最大深度 (1-4) |
| `include_hosts` | bool | 是否包含主机节点 |
| `expand_node_id` | string | 展开指定节点 |

**响应示例:**

```json
{
  "code": 0,
  "data": [
    {
      "id": "business_550e8400-e29b-41d4-a716-446655440000",
      "node_id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "游戏业务",
      "node_type": "business",
      "parent_id": "",
      "icon": "business",
      "is_leaf": false,
      "expandable": true,
      "child_count": 3,
      "children": [
        {
          "id": "set_1",
          "node_id": 1,
          "name": "登录集群",
          "node_type": "set",
          "parent_id": "business_550e8400-e29b-41d4-a716-446655440000",
          "icon": "cluster",
          "is_leaf": false,
          "is_default": false,
          "expandable": true,
          "child_count": 2,
          "extra": {
            "env_type": "prod"
          }
        }
      ]
    }
  ]
}
```

**节点类型:**

| 类型 | 说明 | node_id 类型 |
|------|------|--------------|
| `business` | 业务 | UUID |
| `set` | 集群 | uint64 |
| `module` | 模块 | uint64 |
| `host` | 主机 | UUID |

#### 集群管理

```http
# 获取集群列表
GET /api/v1/topology/sets?business_id=:uuid

# 创建集群
POST /api/v1/topology/sets
{
  "business_id": "uuid",
  "name": "登录集群",
  "description": "登录服务集群",
  "env_type": "prod"
}

# 更新集群
PUT /api/v1/topology/sets/:id
{
  "name": "新名称"
}

# 删除集群
DELETE /api/v1/topology/sets/:id
```

**env_type 可选值:** `prod`, `staging`, `dev`, `test`

#### 模块管理

```http
# 获取模块列表
GET /api/v1/topology/modules?set_id=:id

# 创建模块
POST /api/v1/topology/modules
{
  "set_id": 1,
  "name": "Nginx模块",
  "description": "Web前端模块",
  "service_type": "web"
}

# 更新模块
PUT /api/v1/topology/modules/:id

# 删除模块
DELETE /api/v1/topology/modules/:id
```

**service_type 可选值:** `web`, `api`, `db`, `cache`, `mq`, `other`

#### 主机转移

```http
# 转移主机到指定模块
POST /api/v1/topology/transfer-hosts
{
  "host_ids": ["uuid1", "uuid2"],
  "target_module_id": 5
}
```

#### 获取统计信息

```http
GET /api/v1/topology/statistics?business_id=:uuid
```

**响应示例:**

```json
{
  "code": 0,
  "data": {
    "business_count": 5,
    "set_count": 20,
    "module_count": 80,
    "host_count": 500,
    "by_env_type": {
      "prod": 10,
      "staging": 5,
      "dev": 3,
      "test": 2
    },
    "by_service_type": {
      "web": 30,
      "api": 25,
      "db": 15,
      "cache": 10
    }
  }
}
```

---

### 5. 导入导出

#### 下载导入模板

```http
GET /api/v1/dynamic-models/:uid/template
```

返回 Excel 文件 (.xlsx)，包含三个工作表：
- **数据导入**: 填写数据的主表
- **导入说明**: 字段说明和使用指南
- **字段配置**: 隐藏的配置表（用于验证）

#### 获取模板信息

```http
GET /api/v1/dynamic-models/:uid/template-info
```

**响应示例:**

```json
{
  "code": 0,
  "data": {
    "model_uid": "host",
    "model_name": "主机",
    "fields_hash": "abc123...",
    "total_fields": 15,
    "required_fields": 5,
    "version": "v1"
  }
}
```

#### 上传导入文件

```http
POST /api/v1/dynamic-models/:uid/import
Content-Type: multipart/form-data

file: [Excel文件]
options: {
  "skip_errors": true,
  "update_existing": true,
  "validate_only": false
}
```

**导入选项:**

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `skip_errors` | bool | true | 遇到错误继续导入 |
| `update_existing` | bool | true | 更新已存在的记录 |
| `validate_only` | bool | false | 仅验证不导入 |

**响应示例:**

```json
{
  "code": 0,
  "data": {
    "total": 100,
    "successful": 95,
    "failed": 3,
    "skipped": 2,
    "created_ids": [1, 2, 3, ...],
    "errors": [
      {
        "row": 15,
        "field": "primary_ip",
        "error": "IP地址格式不正确",
        "error_type": "validation"
      }
    ]
  }
}
```

#### 导出数据

```http
GET /api/v1/dynamic-models/:uid/export?filter[os_type]=linux
```

返回 Excel 文件。

---

## 错误处理

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 资源冲突（如重复） |
| 500 | 服务器内部错误 |

### 错误类型

| 类型 | 说明 |
|------|------|
| `validation` | 数据验证失败 |
| `duplicate` | 数据重复 |
| `not_found` | 资源不存在 |
| `constraint` | 约束冲突 |
| `system` | 系统错误 |

### 错误响应示例

```json
{
  "code": 400,
  "error": "字段验证失败",
  "details": {
    "field": "primary_ip",
    "value": "invalid-ip",
    "rule": "pattern",
    "message": "IP地址格式不正确"
  }
}
```

---

## 最佳实践

### 1. 分页查询

始终使用分页，避免一次性加载大量数据：

```javascript
// 推荐
const response = await fetch('/api/v1/dynamic-models/host/instances?page=1&page_size=20');

// 不推荐
const response = await fetch('/api/v1/dynamic-models/host/instances?page_size=10000');
```

### 2. 拓扑树懒加载

对于大型拓扑，使用懒加载：

```javascript
// 第一次只加载业务层
const tree = await fetch('/api/v1/topology/tree?max_depth=1');

// 用户展开时加载子节点
const children = await fetch('/api/v1/topology/tree?expand_node_id=business_xxx');
```

### 3. 批量导入前验证

```javascript
// 先验证
const validateResult = await importFile(file, { validate_only: true });

if (validateResult.failed === 0) {
  // 再正式导入
  const importResult = await importFile(file, { validate_only: false });
}
```

### 4. 错误处理

```javascript
try {
  const response = await fetch('/api/v1/businesses', {
    method: 'POST',
    body: JSON.stringify(data)
  });

  const result = await response.json();

  if (result.code !== 0) {
    // 业务错误
    showError(result.error);
    return;
  }

  // 成功
  showSuccess('创建成功');

} catch (error) {
  // 网络错误
  showError('网络连接失败');
}
```

### 5. TypeScript 类型定义

```typescript
// 通用响应
interface ApiResponse<T> {
  code: number;
  message?: string;
  data?: T;
  error?: string;
}

// 分页响应
interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
  };
}

// 业务
interface Business {
  id: string;
  name: string;
  description: string;
  lifecycle: 'active' | 'archived';
  maintainers: string[];
  created_at: string;
  updated_at: string;
}

// 拓扑节点
interface TopologyNode {
  id: string;
  node_id: string | number;
  name: string;
  node_type: 'business' | 'set' | 'module' | 'host';
  parent_id: string;
  icon: string;
  is_leaf: boolean;
  is_default: boolean;
  expandable: boolean;
  child_count: number;
  children?: TopologyNode[];
  extra?: Record<string, any>;
}
```

---

## 联系方式

如有问题，请联系后端开发团队。
