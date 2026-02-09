# WEND CMDB Backend API 文档

## 目录
- [基础信息](#基础信息)
- [健康检查](#健康检查)
- [业务管理 API](#业务管理-api)
- [业务集管理 API](#业务集管理-api)
- [云区域管理 API](#云区域管理-api)
- [主机管理 API](#主机管理-api)
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
  "timestamp": "2026-01-26T23:43:00+08:00",
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
    "created_at": "2026-01-26T10:30:00Z",
    "updated_at": "2026-01-26T10:30:00Z",
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

### 2. 列出业务

**请求**:
```http
GET /api/v1/businesses?limit=20&offset=0
```

**查询参数**:
- `limit` (可选): 每页数量，默认20，最大100
- `offset` (可选): 偏移量，默认0

### 3. 获取单个业务

**请求**:
```http
GET /api/v1/businesses/:id
```

### 4. 更新业务

**请求**:
```http
PUT /api/v1/businesses/:id
```

### 5. 删除业务

**请求**:
```http
DELETE /api/v1/businesses/:id
```

**重要**: 只能删除 lifecycle = "offline" 的业务。

---

## 业务集管理 API

### 1-8. 业务集相关接口

详见原文档...

---

## 云区域管理 API

云区域用于主机的IP地址隔离，类似于蓝鲸CMDB的云区域（bk_cloud_id）概念。不同云区域内的主机可以拥有相同的IP地址而不冲突。

### 1. 创建云区域

**请求**:
```http
POST /api/v1/cloud-areas
```

### 2. 列出云区域

**请求**:
```http
GET /api/v1/cloud-areas
```

### 3. 获取默认云区域

**请求**:
```http
GET /api/v1/cloud-areas/default
```

**说明**: 获取系统默认的直连云区域（identifier='default'），用于非云环境的主机。

**响应示例**:
```json
{
  "id": "00000000-0000-0000-0000-000000000000",
  "name": "直连区域",
  "identifier": "default",
  "type": "direct",
  "description": "默认直连区域，用于非云环境的主机"
}
```

### 4. 获取单个云区域

**请求**:
```http
GET /api/v1/cloud-areas/:id
```

### 5. 更新云区域

**请求**:
```http
PUT /api/v1/cloud-areas/:id
```

### 6. 删除云区域

**请求**:
```http
DELETE /api/v1/cloud-areas/:id
```

**重要**: 不能删除默认云区域（identifier='default'）。

---

## 主机管理 API

主机管理采用双维度设计：
- **云区域（cloud_area_id）** - 用于IP地址隔离
- **业务归属（business_id）** - 用于资源归属，NULL表示在资源池中

### 1. 创建主机

**请求**:
```http
POST /api/v1/hosts
```

### 2. 批量导入主机

**请求**:
```http
POST /api/v1/hosts/batch
```

**请求体示例**:
```json
{
  "use_default_cloud_area": true,
  "hosts": [
    {
      "host_name": "web-server-01",
      "primary_ip": "192.168.1.100",
      "cpu": 8,
      "memory": 16384,
      "os_type": "linux"
    }
  ]
}
```

### 3. 列出主机

**请求**:
```http
GET /api/v1/hosts?limit=20&offset=0&in_pool=true
```

**查询参数**:
- `cloud_area_id`: 按云区域过滤
- `business_id`: 按业务过滤
- `in_pool`: 查询资源池（business_id=NULL）
- `status`: 按状态过滤

### 4. 获取单个主机

**请求**:
```http
GET /api/v1/hosts/:id
```

### 5. 更新主机

**请求**:
```http
PUT /api/v1/hosts/:id
```

### 6. 更新主机自定义字段

**请求**:
```http
PUT /api/v1/hosts/:id/custom-fields
```

### 7. 分配主机到业务

**请求**:
```http
PUT /api/v1/hosts/:id/assign
```

**请求体**:
```json
{
  "business_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

### 8. 回收主机到资源池

**请求**:
```http
PUT /api/v1/hosts/:id/reclaim
```

**说明**: 将主机的 business_id 设置为 NULL。

### 9. 删除主机

**请求**:
```http
DELETE /api/v1/hosts/:id
```

---

## 动态模型引擎 API

动态模型引擎允许定义自定义资源类型及其属性，然后创建这些类型的实例。

### 模型管理

#### 1. 创建模型

**请求**:
```http
POST /api/v1/models
```

#### 2. 列出所有模型

**请求**:
```http
GET /api/v1/models
```

#### 3. 获取模型详情

**请求**:
```http
GET /api/v1/models/:name
```

#### 4. 为模型添加属性

**请求**:
```http
POST /api/v1/models/:name/attributes
```

**支持的字段类型**:
- `string`, `int`, `float`, `bool`, `datetime`
- `enum`, `json`, `user`, `obj_ref`

### 实例管理

#### 1. 创建实例

**请求**:
```http
POST /api/v1/models/:name/instances
X-Tenant-ID: <tenant-uuid>
```

#### 2. 批量创建实例

**请求**:
```http
POST /api/v1/models/:name/instances/batch
X-Tenant-ID: <tenant-uuid>
```

#### 3. 列出实例

**请求**:
```http
GET /api/v1/models/:name/instances?page=1&page_size=20
X-Tenant-ID: <tenant-uuid>
```

---

## 架构说明

### 数据库清理（2026-01-26）

已删除未使用的表：
- ❌ `model_relations` - 模型关系表（从未使用）
- ❌ `instance_relations` - 实例关系表（从未使用）

当前保留的表（9张）：
- ✅ `businesses`, `business_personnel`, `business_sets`, `business_set_members`
- ✅ `models`, `model_attributes`, `model_instances`
- ✅ `cloud_areas`, `hosts`

### 混合架构设计

系统采用**静态表**和**动态模型引擎**并存的混合架构：

**静态表模式**（核心实体）:
- 业务、主机、云区域使用固定表结构
- 优点：性能好，类型安全，查询直观

**动态模型引擎**（扩展实体）:
- 模型定义驱动，JSONB存储，分区表
- 优点：极强扩展性，无需改表即可添加新实体

---

## 错误码参考

| HTTP状态码 | 含义 | 常见原因 |
|-----------|------|---------|
| 200 OK | 成功 | - |
| 201 Created | 创建成功 | - |
| 207 Multi-Status | 部分成功 | 批量操作部分失败 |
| 400 Bad Request | 请求参数错误 | JSON格式错误、必填字段缺失 |
| 404 Not Found | 资源不存在 | UUID错误、资源已删除 |
| 409 Conflict | 资源冲突 | 唯一标识符重复、IP地址冲突 |
| 500 Internal Server Error | 服务器错误 | 数据库连接失败、代码异常 |

---

## 注意事项

1. **UUID格式**: 所有ID字段必须是有效的UUID v4格式
2. **租户隔离**: 动态模型引擎API需要 `X-Tenant-ID` 请求头
3. **分页**: 列表接口默认返回20条数据，最大100条
4. **软删除**: 删除操作为软删除（设置 deleted_at 字段）
5. **IP唯一性**: 同一云区域内的主机IP地址必须唯一
6. **资源池**: 主机的 business_id 为 NULL 表示在资源池中

---

## 技术栈

- **框架**: Gin (Go)
- **数据库**: PostgreSQL 18 (ltree扩展)
- **ORM**: GORM
- **验证**: go-playground/validator

---

**文档版本**: v2.3.0
**更新时间**: 2026-01-26
**更新内容**: 新增云区域和主机管理API，反映数据库清理后的实际架构
