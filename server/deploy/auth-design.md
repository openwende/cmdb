# 认证系统设计方案

> **状态**: 📝 设计完成，待实施  
> **优先级**: 等待 CMDB 核心功能完成后再实施  
> **预计工作量**: 10-15 天

---

## 目标

为 WEND 系列系统（CMDB、Job、Monitor 等）设计一个**符合业界标准（OAuth2/OIDC）**的统一认证系统，确保：

- ✅ 完全遵循 OAuth2/OIDC 标准
- ✅ 可以平滑迁移到 Keycloak、Ory Hydra 等第三方服务
- ✅ 支持未来扩展 RBAC 权限系统
- ✅ 预留审计日志能力
- ✅ 采用边界方案（独立 auth-server，便于后续抽离）

---

## 核心设计原则

### 1. 遵循 OAuth2/OIDC 标准

#### 标准 JWT Claims 格式

```json
{
  "iss": "https://auth.wend.io",         // Issuer (标准)
  "sub": "550e8400-e29b-41d4-a716-...",  // Subject = User ID (标准)
  "aud": ["cmdb", "job", "monitor"],     // Audience (标准)
  "exp": 1737654321,                     // Expiry (标准)
  "iat": 1737550921,                     // Issued At (标准)
  "nbf": 1737550921,                     // Not Before (标准)
  "jti": "unique-token-id",              // JWT ID (标准)
  
  // OIDC 标准字段
  "email": "user@example.com",
  "email_verified": true,
  "preferred_username": "john",
  "name": "John Doe",
  
  // 权限字段（Keycloak/Ory 兼容）
  "realm_access": {
    "roles": ["admin", "developer"]
  },
  "resource_access": {
    "cmdb": {
      "roles": ["business_admin"]
    }
  },
  
  // 自定义字段（可扩展）
  "permissions": ["cmdb:read", "cmdb:write"]
}
```

**关键设计**：
- 使用 `sub` 而非自定义 `user_id`
- 使用 `preferred_username` 而非 `username`
- Roles 结构与 Keycloak 完全一致
- 支持多 audience（多系统共用）

---

### 2. 支持多种签名算法

```go
type SignatureAlgorithm string

const (
    HS256 SignatureAlgorithm = "HS256"  // HMAC（对称，初期使用）
    RS256 SignatureAlgorithm = "RS256"  // RSA（非对称，Keycloak 默认）
    ES256 SignatureAlgorithm = "ES256"  // ECDSA（非对称，现代推荐）
)
```

**建议**：
- 初期使用 HS256（简单，无需密钥对管理）
- 代码支持 RS256，后续平滑切换
- Keycloak/Ory 默认使用 RS256

---

### 3. 验证器抽象层（关键设计）

```go
// pkg/authclient/validator.go

type TokenValidator interface {
    Validate(ctx context.Context, token string) (*StandardClaims, error)
    GetPublicKey() (interface{}, error)
}

// 自研实现
type SelfHostedValidator struct {
    algorithm SignatureAlgorithm
    secret    []byte
    publicKey *rsa.PublicKey
}

// Keycloak 实现（未来切换只需改这里）
type KeycloakValidator struct {
    keycloakURL string
    realm       string
    publicKey   *rsa.PublicKey  // 从 JWKS endpoint 动态获取
}

// Ory 实现
type OryValidator struct {
    hydraURL  string
    publicKey *rsa.PublicKey
}
```

**优势**：
- CMDB/Job 等服务只依赖接口，不依赖具体实现
- 切换认证提供商只需改配置，代码几乎不用动

---

## 架构设计

### 边界方案（独立二进制，共享数据库）

```
项目结构：
cmdb-server/
├── cmd/
│   ├── cmdb-server/      # CMDB 服务（端口 8080）
│   └── auth-server/      # 认证服务（端口 8081，独立二进制）
│
├── internal/
│   ├── auth/             # 认证模块（auth-server 专用）
│   ├── api/              # CMDB API
│   ├── core/             # CMDB 业务逻辑
│   └── storage/          # 数据访问层
│
├── pkg/
│   └── authclient/       # JWT 验证库（各服务共用）
│
└── migrations/
    └── 202601XX_auth_tables.up.sql
```

**运行模式**：

```bash
# 本地开发：可以只运行 cmdb-server（暂不需要认证）
make dev

# 完整环境：同时运行 auth-server + cmdb-server
docker-compose up auth cmdb
```

**优势**：
- 不阻塞 CMDB 开发（可以先不启动 auth-server）
- 后续抽离简单（直接把 auth-server 拆成独立项目）
- 数据库共享，迁移方便

---

## 数据库设计

### 完整 Schema（现在就建好，预留扩展）

```sql
-- ========================================
-- 用户表
-- ========================================
CREATE TABLE auth_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    
    -- 状态
    status VARCHAR(20) DEFAULT 'active',
    
    -- 审计字段
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT check_status CHECK (status IN ('active', 'disabled', 'locked'))
);

CREATE INDEX idx_auth_users_email ON auth_users(email);
CREATE INDEX idx_auth_users_username ON auth_users(username);
CREATE INDEX idx_auth_users_status ON auth_users(status);

-- ========================================
-- 角色表（RBAC 预留）
-- ========================================
CREATE TABLE auth_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    scope VARCHAR(50) DEFAULT 'global',  -- 'global', 'cmdb', 'job'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 预置角色
INSERT INTO auth_roles (name, description, scope) VALUES
    ('admin', 'System Administrator', 'global'),
    ('user', 'Regular User', 'global');

-- ========================================
-- 用户-角色关联表
-- ========================================
CREATE TABLE auth_user_roles (
    user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES auth_roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_auth_user_roles_user ON auth_user_roles(user_id);
CREATE INDEX idx_auth_user_roles_role ON auth_user_roles(role_id);

-- ========================================
-- 权限表（RBAC 预留）
-- ========================================
CREATE TABLE auth_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,  -- 'cmdb:business:read'
    description TEXT,
    resource VARCHAR(50) NOT NULL,      -- 'business', 'job'
    action VARCHAR(50) NOT NULL,        -- 'read', 'write', 'delete'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 角色-权限关联表
CREATE TABLE auth_role_permissions (
    role_id UUID REFERENCES auth_roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES auth_permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- ========================================
-- 审计日志表（预留）
-- ========================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth_users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ========================================
-- Refresh Token 表
-- ========================================
CREATE TABLE auth_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_refresh_tokens_user ON auth_refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires ON auth_refresh_tokens(expires_at);
```

**设计原则**：
- 所有表加 `auth_` 前缀（便于后续迁移）
- RBAC 表现在就建好（即使暂不使用）
- 审计日志表预留（重要！）

---

## API 设计

### Auth Server API（符合 OAuth2/OIDC 标准）

```
POST   /api/v1/auth/register        # 注册
POST   /api/v1/auth/login           # 登录
POST   /api/v1/auth/refresh         # 刷新 token
POST   /api/v1/auth/logout          # 登出
GET    /api/v1/auth/me              # 获取当前用户信息

# JWKS endpoint（Keycloak/Ory 兼容）
GET    /.well-known/jwks.json

# OIDC Discovery（可选，后续实现）
GET    /.well-known/openid-configuration
```

### 登录请求/响应（OAuth2 标准格式）

**请求**：
```json
POST /api/v1/auth/login
{
  "username": "john",
  "password": "secret"
}
```

**响应**：
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "scope": "openid profile email"
}
```

---

## 配置设计

```yaml
auth:
  # 认证提供商：self-hosted, keycloak, ory
  provider: "self-hosted"
  
  # Self-hosted 配置
  jwt:
    algorithm: "HS256"             # HS256, RS256, ES256
    secret: "your-secret-key-32+"  # for HS256 (至少32字符)
    public_key_path: ""            # for RS256/ES256
    private_key_path: ""           # for RS256/ES256
    issuer: "https://auth.wend.io"
    access_token_expiry: "1h"
    refresh_token_expiry: "168h"   # 7 days
  
  password:
    algorithm: "bcrypt"
    cost: 12
  
  # Keycloak 配置（未来）
  keycloak:
    url: "http://keycloak.example.com"
    realm: "wend"
    client_id: "cmdb-backend"
    client_secret: "client-secret"
  
  # Ory 配置（未来）
  ory:
    hydra_url: "http://hydra.example.com"
    public_url: "http://hydra-public.example.com"
```

---

## 迁移到 Keycloak 的步骤（未来）

### 1. 部署 Keycloak

```bash
docker run -d \
  --name keycloak \
  -p 8081:8080 \
  -e KEYCLOAK_ADMIN=admin \
  -e KEYCLOAK_ADMIN_PASSWORD=admin \
  quay.io/keycloak/keycloak:latest start-dev
```

### 2. 配置 Keycloak

- 创建 Realm: `wend`
- 创建 Client: `cmdb-backend`, `job-backend` 等
- 配置 JWT 签名: RS256
- 导出用户数据（从 `auth_users` 表）

### 3. 更新配置文件

```yaml
auth:
  provider: "keycloak"  # ← 只需改这一行
  keycloak:
    url: "http://localhost:8081"
    realm: "wend"
    client_id: "cmdb-backend"
```

### 4. 更新验证器（代码改动极小）

```go
// internal/api/server/server.go

var validator authclient.TokenValidator

switch cfg.Auth.Provider {
case "keycloak":
    validator = authclient.NewKeycloakValidator(cfg.Auth.Keycloak)
case "ory":
    validator = authclient.NewOryValidator(cfg.Auth.Ory)
default:
    validator = authclient.NewSelfHostedValidator(cfg.Auth.JWT)
}

// 中间件使用接口，无需改动
middleware := authclient.NewJWTMiddleware(validator)
```

### 5. 下线 auth-server

- 所有认证请求指向 Keycloak
- auth-server 停止运行

**预计迁移时间：1-2 天**

---

## 兼容性检查清单

确保未来能够平滑迁移，需要遵循以下标准：

- [ ] JWT Claims 使用标准字段（`sub`, `iss`, `aud`, `exp` 等）
- [ ] 支持 RS256 签名算法（即使初期用 HS256）
- [ ] 提供 JWKS endpoint（`/.well-known/jwks.json`）
- [ ] Token 响应格式符合 OAuth2 标准（`access_token`, `token_type`, `expires_in`）
- [ ] Roles 字段结构与 Keycloak 一致（`realm_access`, `resource_access`）
- [ ] 支持 `email_verified` 字段（OIDC 标准）
- [ ] 验证器接口化，支持多 provider
- [ ] 配置支持切换认证提供商

---

## 实施阶段规划

### Phase 1: 数据库迁移（1-2 天）
- 创建 auth 相关表
- 预置初始角色（admin, user）

### Phase 2: 认证核心实现（3-5 天）
- JWT 生成与验证（支持 HS256/RS256）
- 密码哈希（bcrypt）
- 用户 Repository
- 认证 Service

### Phase 3: Auth Server 开发（2-3 天）
- 独立二进制 `cmd/auth-server/main.go`
- 登录/注册/刷新 API
- JWKS endpoint
- 健康检查

### Phase 4: CMDB 集成（1-2 天）
- JWT 验证中间件
- 应用到 CMDB API
- 添加审计字段（created_by, updated_by）
- 更新 Business Handler

### Phase 5: 测试与文档（2-3 天）
- 单元测试
- 集成测试
- API 文档（Swagger）
- 迁移指南

**总计：10-15 天工作量**

---

## 关键决策点（待实施时确认）

### 1. JWT 签名算法

**选项 A（推荐）**：
- 初期使用 HS256（简单，无需密钥对管理）
- 代码支持 RS256，后续平滑切换

**选项 B**：
- 直接使用 RS256（与 Keycloak 一致，但需要管理密钥对）

### 2. Refresh Token 存储

**选项 A（推荐）**：
- 存储在数据库（`auth_refresh_tokens` 表）
- 支持主动撤销（踢人下线）
- 安全性更高

**选项 B**：
- 无状态 JWT refresh token
- 简单但无法主动撤销

### 3. RBAC 实施时机

**选项 A**：
- 数据库表现在就建好
- 代码先简单实现（admin/user 两级）
- 后续逐步完善

**选项 B**：
- 现在只建用户表
- 后续需要时再加 RBAC 表（需要数据迁移）

---

## 参考资料

- [RFC 6749: OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 7519: JWT](https://datatracker.ietf.org/doc/html/rfc7519)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [Keycloak Documentation](https://www.keycloak.org/documentation)
- [Ory Hydra Documentation](https://www.ory.sh/docs/hydra)

---

## 总结

这个设计方案的核心优势：

1. **标准兼容** - 完全遵循 OAuth2/OIDC，可无缝对接任何标准认证服务
2. **渐进实施** - 不阻塞 CMDB 开发，可以先让业务跑起来
3. **易于迁移** - 切换到 Keycloak/Ory 只需 1-2 天
4. **可扩展** - RBAC、审计日志等高级功能已预留
5. **成本可控** - 初期自研，后续按需切换第三方

**实施时机**：等 CMDB 核心功能完成 70-80% 后再开始。
