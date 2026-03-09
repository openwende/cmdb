# 业务管理 API 文档

## 概述

业务管理 API 提供对业务（Business）和业务集（Business Set）的 CRUD 操作。

**设计参考**: 蓝鲸 CMDB v3 业务模型

---

## 业务（Business）API

### 创建业务

创建一个新业务。

**请求**:
```
POST /api/v1/businesses
```

**请求体**:
```json
{
  "name": "支付中心",
  "description": "负责支付相关业务",
  "identifier": "payment-center",
  "lifecycle": "online",
  "timezone": "Asia/Shanghai",
  "language": "zh",
  "sres": ["alice@example.com", "bob@example.com"],
  "developers": ["charlie@example.com"],
  "testers": ["david@example.com"],
  "bizops": ["eve@example.com"]
}
```

**请求参数说明**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 业务名称 |
| description | string | 否 | 业务描述 |
| identifier | string | 否 | 业务标识符（唯一），不提供则自动生成 |
| lifecycle | string | 否 | 生命周期：`testing`/`online`/`offline`，默认 `online` |
| timezone | string | 否 | 时区，如 `Asia/Shanghai`、`UTC`，默认 `UTC` |
| language | string | 否 | 语言，如 `zh`、`en`，默认 `en` |
| sres | array | 否 | 运维人员列表（邮箱/用户名） |
| developers | array | 否 | 开发人员列表 |
| testers | array | 否 | 测试人员列表 |
| bizops | array | 否 | 产品人员列表 |

**业务角色说明**:

业务角色设计对齐蓝鲸 CMDB v3：

| 角色 | 对应蓝鲸字段 | 说明 |
|------|-------------|------|
| sres | bk_biz_maintainer | 运维人员/SRE |
| developers | bk_biz_developer | 开发人员 |
| testers | bk_biz_tester | 测试人员 |
| bizops | bk_biz_productor | 产品人员/需求方 |

**响应**:
```json
{
  "success": true,
  "message": "Business created successfully",
  "data": {
    "id": "6c971ed8-caf4-44df-8ea9-c42707d2d529",
    "created_at": "2026-03-07T10:00:00Z",
    "updated_at": "2026-03-07T10:00:00Z",
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "name": "支付中心",
    "identifier": "payment-center",
    "business_id": 1000,
    "description": "负责支付相关业务",
    "lifecycle": "online",
    "timezone": "Asia/Shanghai",
    "language": "zh",
    "maintainers": [],
    "is_built_in": false,
    "sres": ["alice@example.com", "bob@example.com"],
    "developers": ["charlie@example.com"],
    "testers": ["david@example.com"],
    "bizops": ["eve@example.com"]
  }
}
```

**错误响应**:

```json
// 400 Bad Request - 参数错误
{
  "error": "Business name is required"
}

// 409 Conflict - 标识符冲突
{
  "error": "Business identifier already exists",
  "details": "business with identifier 'payment-center' already exists"
}

// 500 Internal Server Error - 服务器错误
{
  "error": "Failed to create business",
  "details": "database connection error"
}
```

---

### 获取业务列表

分页获取业务列表。

**请求**:
```
GET /api/v1/businesses?limit=20&offset=0
```

**查询参数**:

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| limit | int | 否 | 20 | 每页数量，最大 100 |
| offset | int | 否 | 0 | 偏移量 |

**响应**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "6c971ed8-caf4-44df-8ea9-c42707d2d529",
        "name": "支付中心",
        "business_id": 1000,
        "lifecycle": "online",
        "timezone": "Asia/Shanghai",
        "language": "zh",
        // ... 其他字段
      }
    ],
    "total": 42,
    "limit": 20,
    "offset": 0
  }
}
```

---

### 获取业务详情

获取单个业务的详细信息，包含业务人员角色。

**请求**:
```
GET /api/v1/businesses/{id}
```

**路径参数**:
- `id`: 业务 UUID

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "6c971ed8-caf4-44df-8ea9-c42707d2d529",
    "created_at": "2026-03-07T10:00:00Z",
    "updated_at": "2026-03-07T10:00:00Z",
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "name": "支付中心",
    "identifier": "payment-center",
    "business_id": 1000,
    "description": "负责支付相关业务",
    "lifecycle": "online",
    "timezone": "Asia/Shanghai",
    "language": "zh",
    "sres": ["alice@example.com"],
    "developers": ["charlie@example.com"],
    "testers": ["david@example.com"],
    "bizops": ["eve@example.com"]
  }
}
```

**错误响应**:
```json
// 400 Bad Request - ID 格式错误
{
  "error": "Invalid business ID format"
}

// 404 Not Found - 业务不存在
{
  "error": "Business not found"
}
```

---

### 更新业务

更新业务信息。

**请求**:
```
PUT /api/v1/businesses/{id}
```

**请求体**:
```json
{
  "name": "支付中心（新）",
  "description": "更新后的描述",
  "lifecycle": "offline",
  "timezone": "UTC",
  "language": "en"
}
```

**说明**:
- 只传递需要更新的字段
- 业务人员角色不通过此接口更新（待实现专门的人员管理接口）

**响应**:
```json
{
  "success": true,
  "message": "Business updated successfully",
  "data": {
    // 更新后的业务对象
  }
}
```

---

### 删除业务

删除业务（软删除）。

**请求**:
```
DELETE /api/v1/businesses/{id}
```

**限制**:
- 只能删除已归档（lifecycle = "offline"）的业务

**响应**:
```json
{
  "success": true,
  "message": "Business deleted successfully"
}
```

**错误响应**:
```json
// 400 Bad Request - 业务状态不允许删除
{
  "error": "Cannot delete business",
  "details": "只能删除归档状态的业务"
}
```

---

## 业务集（Business Set）API

业务集用于对业务进行分组管理。

### 创建业务集

**请求**:
```
POST /api/v1/business-sets
```

**请求体**:
```json
{
  "name": "核心业务集",
  "description": "公司核心业务",
  "identifier": "core-businesses",
  "business_id": "6c971ed8-caf4-44df-8ea9-c42707d2d529"
}
```

### 其他业务集 API

- `GET /api/v1/business-sets` - 获取业务集列表
- `GET /api/v1/business-sets/{id}` - 获取业务集详情
- `PUT /api/v1/business-sets/{id}` - 更新业务集
- `DELETE /api/v1/business-sets/{id}` - 删除业务集
- `POST /api/v1/business-sets/{id}/members` - 添加业务到业务集
- `GET /api/v1/business-sets/{id}/members` - 获取业务集成员
- `DELETE /api/v1/business-sets/{id}/members/{business_id}` - 从业务集移除业务

---

## 设计说明

### 业务角色模型

业务人员通过 `business_personnel` 表管理：

```sql
CREATE TABLE business_personnel (
    id UUID PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE,
    business_id UUID REFERENCES businesses(id),
    user_id UUID,
    identity TEXT,  -- 邮箱/用户名
    role TEXT       -- sre|developer|tester|bizops
);
```

**角色值**:
- `sre` - 运维人员
- `developer` - 开发人员
- `tester` - 测试人员
- `bizops` - 产品人员

**注意**: 不支持 `operator` 角色，避免与 `sre` 语义重叠。

### 业务 ID (business_id)

- 类型：整数，从 1000 开始自动递增
- 用途：兼容蓝鲸 CMDB 的 `bk_biz_id`
- 生成：创建业务时自动分配

### 租户隔离

所有业务都属于特定租户（tenant_id），当前使用默认租户：
```
00000000-0000-0000-0000-000000000001
```

---

## 版本历史

### v2.3.0 (2026-03-07)
- ✅ 添加 `timezone` 和 `language` 字段支持
- ✅ 业务角色对齐蓝鲸 CMDB v3（4 个角色）
- ✅ 移除 `operators` 角色（避免语义重叠）

### v2.2.0 (2026-02-13)
- ✅ 初始业务管理 API

---

## 参考资料

- [蓝鲸 CMDB v3 业务模型](https://github.com/TencentBlueKing/bk-cmdb)
- [ITIL v4 Service Management](https://www.axelos.com/certifications/itil-service-management)
