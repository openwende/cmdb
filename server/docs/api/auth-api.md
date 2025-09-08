# 认证授权API

认证授权API提供用户认证、权限管理和访问控制功能。

## 基础信息

- **Base URL**: `/api/v1/auth`
- **认证方式**: JWT Bearer Token
- **内容类型**: `application/json`

## 数据模型

### User (用户)

```json
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "display_name": "string",
  "is_active": "boolean",
  "roles": ["Role"],
  "permissions": ["string"],
  "last_login_at": "datetime",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Role (角色)

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "name": "string",
  "identifier": "string",
  "description": "string",
  "is_built_in": "boolean",
  "permissions": ["Permission"],
  "user_count": "int",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Permission (权限)

```json
{
  "id": "uuid",
  "name": "string",
  "resource": "string",
  "action": "string",
  "description": "string",
  "is_built_in": "boolean"
}
```

### UserSession (用户会话)

```json
{
  "session_id": "string",
  "user_id": "uuid",
  "username": "string",
  "tenant_id": "uuid",
  "ip_address": "string",
  "user_agent": "string",
  "created_at": "datetime",
  "last_seen": "datetime",
  "expires_at": "datetime",
  "is_active": "boolean"
}
```

## 认证API

### 1. 用户登录

用户登录获取访问令牌。

**请求**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "password123",
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2024-01-01T01:00:00Z",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "admin",
      "email": "admin@example.com",
      "display_name": "系统管理员",
      "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
      "roles": ["admin", "user"],
      "permissions": [
        "model:create",
        "model:read",
        "model:update",
        "model:delete",
        "instance:create",
        "instance:read",
        "instance:update",
        "instance:delete"
      ],
      "is_active": true,
      "last_login_at": "2024-01-01T00:00:00Z"
    }
  }
}
```

### 2. 刷新令牌

使用刷新令牌获取新的访问令牌。

**请求**
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expires_at": "2024-01-01T02:00:00Z",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "admin",
      "roles": ["admin", "user"],
      "permissions": [...]
    }
  }
}
```

### 3. 用户登出

退出当前会话。

**请求**
```http
POST /api/v1/auth/logout
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "登出成功"
}
```

### 4. 获取当前用户信息

获取当前登录用户的详细信息。

**请求**
```http
GET /api/v1/auth/me
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
    "username": "admin",
    "email": "admin@example.com",
    "display_name": "系统管理员",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "roles": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "name": "系统管理员",
        "identifier": "admin",
        "permissions": [...]
      }
    ],
    "permissions": [
      "model:create",
      "model:read",
      "model:update",
      "model:delete"
    ],
    "is_active": true,
    "last_login_at": "2024-01-01T00:00:00Z",
    "session": {
      "session_id": "abc123...",
      "ip_address": "192.168.1.100",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-01-01T00:00:00Z",
      "expires_at": "2024-01-01T08:00:00Z"
    }
  }
}
```

## 用户管理API

### 1. 创建用户

创建新用户。

**请求**
```http
POST /api/v1/auth/users
Content-Type: application/json
Authorization: Bearer <token>

{
  "username": "john.doe",
  "email": "john.doe@example.com",
  "display_name": "John Doe",
  "password": "SecureP@ssw0rd",
  "role_ids": [
    "550e8400-e29b-41d4-a716-446655440020"
  ]
}
```

**响应**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "display_name": "John Doe",
    "is_active": true,
    "roles": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440020",
        "name": "普通用户",
        "identifier": "user"
      }
    ],
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2. 获取用户列表

获取用户列表，支持分页和过滤。

**请求**
```http
GET /api/v1/auth/users?page=1&page_size=20&search=john&status=active&role=user
Authorization: Bearer <token>
```

**参数**
- `page` (可选): 页码，默认1
- `page_size` (可选): 每页大小，默认20，最大100
- `search` (可选): 搜索关键词
- `status` (可选): 状态过滤，`active`/`inactive`
- `role` (可选): 角色过滤

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "username": "john.doe",
        "email": "john.doe@example.com",
        "display_name": "John Doe",
        "is_active": true,
        "roles": ["普通用户"],
        "last_login_at": "2024-01-01T00:00:00Z",
        "created_at": "2024-01-01T00:00:00Z"
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

### 3. 获取用户详情

获取指定用户的详细信息。

**请求**
```http
GET /api/v1/auth/users/{user_id}
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "display_name": "John Doe",
    "is_active": true,
    "roles": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440020",
        "name": "普通用户",
        "identifier": "user",
        "permissions": [
          "instance:read",
          "model:read"
        ]
      }
    ],
    "permissions": [
      "instance:read",
      "model:read"
    ],
    "last_login_at": "2024-01-01T00:00:00Z",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### 4. 更新用户

更新用户信息。

**请求**
```http
PUT /api/v1/auth/users/{user_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "email": "john.doe.new@example.com",
  "display_name": "John Doe (Senior)",
  "is_active": true,
  "role_ids": [
    "550e8400-e29b-41d4-a716-446655440020",
    "550e8400-e29b-41d4-a716-446655440021"
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
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "email": "john.doe.new@example.com",
    "display_name": "John Doe (Senior)",
    "roles": [
      {
        "name": "普通用户"
      },
      {
        "name": "高级用户"
      }
    ],
    "updated_at": "2024-01-01T01:00:00Z"
  }
}
```

### 5. 删除用户

删除指定用户。

**请求**
```http
DELETE /api/v1/auth/users/{user_id}
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "用户删除成功"
}
```

### 6. 重置用户密码

重置用户密码。

**请求**
```http
POST /api/v1/auth/users/{user_id}/reset-password
Content-Type: application/json
Authorization: Bearer <token>

{
  "new_password": "NewSecureP@ssw0rd",
  "force_change": true
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "密码重置成功"
}
```

## 角色管理API

### 1. 创建角色

创建新角色。

**请求**
```http
POST /api/v1/auth/roles
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "数据分析师",
  "identifier": "data_analyst",
  "description": "负责数据分析和报表生成",
  "permission_ids": [
    "550e8400-e29b-41d4-a716-446655440030",
    "550e8400-e29b-41d4-a716-446655440031"
  ]
}
```

**响应**
```http
HTTP/1.1 201 Created
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440022",
    "name": "数据分析师",
    "identifier": "data_analyst", 
    "description": "负责数据分析和报表生成",
    "is_built_in": false,
    "permissions": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440030",
        "name": "查看实例",
        "resource": "instance",
        "action": "read"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440031",
        "name": "导出数据",
        "resource": "instance",
        "action": "export"
      }
    ],
    "user_count": 0,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 2. 获取角色列表

获取角色列表。

**请求**
```http
GET /api/v1/auth/roles?page=1&page_size=20&search=分析&include_built_in=false
Authorization: Bearer <token>
```

**参数**
- `search` (可选): 搜索关键词
- `include_built_in` (可选): 是否包含内置角色

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440022",
        "name": "数据分析师",
        "identifier": "data_analyst",
        "description": "负责数据分析和报表生成",
        "is_built_in": false,
        "user_count": 5,
        "permission_count": 8,
        "created_at": "2024-01-01T00:00:00Z"
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

### 3. 获取角色详情

获取指定角色的详细信息。

**请求**
```http
GET /api/v1/auth/roles/{role_id}
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440022",
    "name": "数据分析师",
    "identifier": "data_analyst",
    "description": "负责数据分析和报表生成",
    "is_built_in": false,
    "permissions": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440030",
        "name": "查看实例",
        "resource": "instance",
        "action": "read",
        "description": "查看配置项实例"
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440031",
        "name": "导出数据",
        "resource": "instance",
        "action": "export",
        "description": "导出实例数据"
      }
    ],
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "username": "john.doe",
        "display_name": "John Doe"
      }
    ],
    "user_count": 1,
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

### 4. 更新角色

更新角色信息。

**请求**
```http
PUT /api/v1/auth/roles/{role_id}
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "高级数据分析师",
  "description": "负责高级数据分析和决策支持",
  "permission_ids": [
    "550e8400-e29b-41d4-a716-446655440030",
    "550e8400-e29b-41d4-a716-446655440031",
    "550e8400-e29b-41d4-a716-446655440032"
  ]
}
```

### 5. 删除角色

删除指定角色。

**请求**
```http
DELETE /api/v1/auth/roles/{role_id}
Authorization: Bearer <token>
```

## 权限管理API

### 1. 获取权限列表

获取系统所有权限。

**请求**
```http
GET /api/v1/auth/permissions?resource=instance&action=read
Authorization: Bearer <token>
```

**参数**
- `resource` (可选): 资源类型过滤
- `action` (可选): 操作类型过滤

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "items": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440030",
        "name": "查看实例",
        "resource": "instance",
        "action": "read",
        "description": "查看配置项实例",
        "is_built_in": true
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440031",
        "name": "创建实例",
        "resource": "instance", 
        "action": "create",
        "description": "创建新的配置项实例",
        "is_built_in": true
      }
    ]
  }
}
```

### 2. 检查权限

检查用户是否拥有特定权限。

**请求**
```http
POST /api/v1/auth/check-permission
Content-Type: application/json
Authorization: Bearer <token>

{
  "user_id": "550e8400-e29b-41d4-a716-446655440002",
  "resource": "instance",
  "action": "create",
  "resource_id": "550e8400-e29b-41d4-a716-446655440010"
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "allowed": true,
    "reason": "用户拥有创建实例权限"
  }
}
```

### 3. 批量检查权限

批量检查多个权限。

**请求**
```http
POST /api/v1/auth/check-permissions
Content-Type: application/json
Authorization: Bearer <token>

{
  "user_id": "550e8400-e29b-41d4-a716-446655440002",
  "permissions": [
    {
      "resource": "instance",
      "action": "read"
    },
    {
      "resource": "instance",
      "action": "create"
    },
    {
      "resource": "model",
      "action": "update"
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
    "results": [
      {
        "resource": "instance",
        "action": "read",
        "allowed": true
      },
      {
        "resource": "instance",
        "action": "create",
        "allowed": true
      },
      {
        "resource": "model",
        "action": "update",
        "allowed": false,
        "reason": "权限不足"
      }
    ]
  }
}
```

## 会话管理API

### 1. 获取用户会话列表

获取用户的活跃会话。

**请求**
```http
GET /api/v1/auth/sessions?user_id=550e8400-e29b-41d4-a716-446655440002&active_only=true
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "data": {
    "items": [
      {
        "session_id": "abc123...",
        "user_id": "550e8400-e29b-41d4-a716-446655440002",
        "username": "john.doe",
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "created_at": "2024-01-01T00:00:00Z",
        "last_seen": "2024-01-01T00:30:00Z",
        "expires_at": "2024-01-01T08:00:00Z",
        "is_active": true,
        "is_current": true
      }
    ]
  }
}
```

### 2. 终止会话

终止指定会话。

**请求**
```http
DELETE /api/v1/auth/sessions/{session_id}
Authorization: Bearer <token>
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "会话已终止"
}
```

### 3. 终止用户所有会话

终止指定用户的所有会话。

**请求**
```http
DELETE /api/v1/auth/users/{user_id}/sessions
Authorization: Bearer <token>
```

## 密码管理API

### 1. 修改密码

用户修改自己的密码。

**请求**
```http
POST /api/v1/auth/change-password
Content-Type: application/json
Authorization: Bearer <token>

{
  "current_password": "oldpassword123",
  "new_password": "NewSecureP@ssw0rd",
  "confirm_password": "NewSecureP@ssw0rd"
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "密码修改成功"
}
```

### 2. 忘记密码

发起密码重置请求。

**请求**
```http
POST /api/v1/auth/forgot-password
Content-Type: application/json

{
  "email": "john.doe@example.com"
}
```

**响应**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "message": "密码重置邮件已发送"
}
```

### 3. 重置密码

使用重置令牌重置密码。

**请求**
```http
POST /api/v1/auth/reset-password
Content-Type: application/json

{
  "reset_token": "reset_token_here",
  "new_password": "NewSecureP@ssw0rd",
  "confirm_password": "NewSecureP@ssw0rd"
}
```

## 错误处理

### 认证错误

| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| INVALID_CREDENTIALS | 401 | 用户名或密码错误 |
| ACCOUNT_DISABLED | 401 | 账户已禁用 |
| TOKEN_EXPIRED | 401 | 令牌已过期 |
| TOKEN_INVALID | 401 | 令牌无效 |
| SESSION_EXPIRED | 401 | 会话已过期 |

### 授权错误

| 错误码 | HTTP状态码 | 描述 |
|--------|------------|------|
| INSUFFICIENT_PERMISSIONS | 403 | 权限不足 |
| ROLE_NOT_FOUND | 404 | 角色不存在 |
| USER_NOT_FOUND | 404 | 用户不存在 |
| PERMISSION_DENIED | 403 | 操作被拒绝 |

## 权限资源和操作

### 资源类型

| 资源 | 描述 |
|------|------|
| model | 模型管理 |
| instance | 实例管理 |
| business | 业务拓扑 |
| user | 用户管理 |
| role | 角色管理 |
| audit | 审计日志 |
| system | 系统管理 |

### 操作类型

| 操作 | 描述 |
|------|------|
| create | 创建 |
| read | 读取 |
| update | 更新 |
| delete | 删除 |
| export | 导出 |
| import | 导入 |
| manage | 管理 |

### 内置角色

| 角色 | 标识符 | 描述 | 权限 |
|------|--------|------|------|
| 超级管理员 | super_admin | 系统超级管理员 | 所有权限 |
| 系统管理员 | admin | 系统管理员 | 用户、角色、模型管理 |
| 运维人员 | operator | 运维人员 | 实例、业务拓扑管理 |
| 普通用户 | user | 普通用户 | 实例查看 |
| 只读用户 | readonly | 只读用户 | 所有资源只读 |

## 使用示例

### 完整登录流程

```bash
# 1. 用户登录
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123",
    "tenant_id": "'$TENANT_ID'"
  }'

# 2. 获取当前用户信息
curl -X GET http://localhost:8080/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 3. 检查权限
curl -X POST http://localhost:8080/api/v1/auth/check-permission \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "instance",
    "action": "create"
  }'
```

### 用户和角色管理

```bash
# 1. 创建角色
curl -X POST http://localhost:8080/api/v1/auth/roles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "数据分析师",
    "identifier": "data_analyst",
    "description": "数据分析和报表权限",
    "permission_ids": ["'$PERM_1'", "'$PERM_2'"]
  }'

# 2. 创建用户
curl -X POST http://localhost:8080/api/v1/auth/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "analyst",
    "email": "analyst@company.com",
    "display_name": "数据分析师",
    "password": "SecurePassword123",
    "role_ids": ["'$ROLE_ID'"]
  }'
```

## 安全最佳实践

### 密码策略

1. **复杂度要求**: 至少8位，包含大小写字母、数字和特殊字符
2. **定期更换**: 建议每90天更换一次
3. **历史密码**: 不能重复使用最近5次的密码
4. **锁定策略**: 连续失败5次后锁定账户

### 会话管理

1. **会话超时**: 默认8小时，可配置
2. **并发限制**: 同一用户最多5个活跃会话
3. **安全登出**: 清理所有相关会话数据
4. **设备记忆**: 可选择记住设备避免重复验证

### 权限控制

1. **最小权限**: 用户只拥有必要的最小权限
2. **权限分离**: 关键操作需要多重验证
3. **定期审计**: 定期检查用户权限合理性
4. **权限继承**: 支持角色权限继承机制