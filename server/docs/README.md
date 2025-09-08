# WEND CMDB Backend

企业级配置管理数据库(CMDB)后端系统，基于Go语言开发，提供完整的IT资产管理、配置项管理和业务拓扑功能。

## 功能特性

- 🏗️ **模型管理** - 灵活的配置项模型定义和字段管理
- 📦 **实例管理** - 配置项实例的CRUD操作和批量管理
- 🔗 **关系管理** - 复杂的配置项关系建模和拓扑查询
- 🏢 **业务拓扑** - 业务结构建模和实例关联
- 🔐 **认证授权** - JWT认证和基于角色的访问控制(RBAC)
- 📊 **动态查询** - 灵活的查询语言和聚合分析
- 📝 **审计日志** - 完整的操作记录和审计跟踪
- 🖥️ **CLI工具** - 命令行管理工具
- 🚀 **GraphQL API** - 现代化的GraphQL查询接口
- 🔄 **实时订阅** - WebSocket实时数据推送

## 技术架构

### 核心技术栈
- **语言**: Go 1.21+
- **框架**: Gin (HTTP), Cobra (CLI), gqlgen (GraphQL)
- **数据库**: PostgreSQL
- **认证**: JWT
- **日志**: Structured Logging
- **通信**: REST API + GraphQL + WebSocket

### 架构设计
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Web Frontend  │  │   Mobile App    │  │   CLI Client    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────────────────────────────────────┐
         │              API Gateway                        │
         └─────────────────────────────────────────────────┘
                                 │
    ┌────────────────────────────┼────────────────────────────┐
    │                            │                            │
┌─────────┐              ┌──────────────┐              ┌─────────┐
│REST API │              │  GraphQL API │              │WebSocket│
└─────────┘              └──────────────┘              └─────────┘
    │                            │                            │
    └────────────────────────────┼────────────────────────────┘
                                 │
         ┌─────────────────────────────────────────────────┐
         │              Business Layer                     │
         │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
         │  │ Model   │ │Instance │ │Business │ │  Auth   ││
         │  │Service  │ │Service  │ │Service  │ │Service  ││
         │  └─────────┘ └─────────┘ └─────────┘ └─────────┘│
         └─────────────────────────────────────────────────┘
                                 │
         ┌─────────────────────────────────────────────────┐
         │              Data Layer                         │
         │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│
         │  │  Model  │ │Instance │ │Business │ │  Audit  ││
         │  │   Repo  │ │  Repo   │ │  Repo   │ │  Repo   ││
         │  └─────────┘ └─────────┘ └─────────┘ └─────────┘│
         └─────────────────────────────────────────────────┘
                                 │
         ┌─────────────────────────────────────────────────┐
         │              PostgreSQL Database                │
         └─────────────────────────────────────────────────┘
```

## 项目结构

```
wend-cmdb-backend/
├── cmd/                    # 应用程序入口
│   ├── server/            # HTTP服务器
│   └── cli/               # CLI工具
├── internal/              # 内部代码
│   ├── api/               # API层
│   │   ├── rest/          # REST API
│   │   └── middleware/    # 中间件
│   ├── core/              # 核心业务逻辑
│   │   ├── model/         # 模型管理
│   │   ├── instance/      # 实例管理
│   │   ├── business/      # 业务拓扑
│   │   ├── auth/          # 认证授权
│   │   ├── audit/         # 审计日志
│   │   └── query/         # 动态查询
│   ├── graphql/           # GraphQL API
│   ├── storage/           # 数据存储
│   └── config/            # 配置管理
├── pkg/                   # 公共包
│   ├── types/             # 数据类型定义
│   ├── utils/             # 工具函数
│   └── errors/            # 错误处理
├── migrations/            # 数据库迁移
├── docs/                  # 文档
└── scripts/               # 脚本工具
```

## 快速开始

### 环境要求
- Go 1.21+
- PostgreSQL 13+
- 8GB+ RAM
- 20GB+ 存储空间

### 安装部署

1. **克隆项目**
```bash
git clone https://github.com/wend/cmdb-backend.git
cd cmdb-backend
```

2. **配置数据库**
```bash
# 创建数据库
createdb wend_cmdb

# 设置环境变量
export DATABASE_URL="postgres://user:password@localhost/wend_cmdb?sslmode=disable"
export JWT_SECRET="your-jwt-secret-key"
```

3. **构建应用**
```bash
go mod tidy
go build -o bin/server cmd/server/main.go
go build -o bin/cmdb cmd/cli/main.go
```

4. **运行数据库迁移**
```bash
./bin/server migrate
```

5. **启动服务**
```bash
./bin/server start
```

### API访问

- **REST API**: http://localhost:8080/api/v1
- **GraphQL API**: http://localhost:8080/api/v1/graphql
- **GraphQL Playground**: http://localhost:8080/api/v1/graphql/playground
- **Health Check**: http://localhost:8080/health

## API文档

### REST API

详细的REST API文档请参考:
- [模型管理API](./api/model-api.md)
- [实例管理API](./api/instance-api.md)
- [业务拓扑API](./api/business-api.md)
- [认证授权API](./api/auth-api.md)
- [审计日志API](./api/audit-api.md)

### GraphQL API

GraphQL schema和查询示例请参考:
- [GraphQL Schema](./api/graphql-schema.md)
- [查询示例](./api/graphql-examples.md)

### CLI工具

CLI命令参考:
- [CLI使用指南](./cli/cli-guide.md)

## 核心概念

### 模型(Model)
配置项的模板定义，包含字段结构、验证规则和关系定义。

### 实例(Instance)
基于模型创建的具体配置项数据，包含实际的属性值。

### 关系(Relationship)
配置项之间的关联关系，支持一对一、一对多、多对多关系。

### 业务拓扑(Business Topology)
业务层面的组织结构，支持树形结构和实例关联。

### 权限控制(RBAC)
基于角色的访问控制，支持细粒度的权限管理。

## 开发指南

### 代码结构

项目采用分层架构，主要包含以下层次：

1. **API层** - 处理HTTP请求和响应
2. **服务层** - 业务逻辑处理
3. **存储层** - 数据访问和持久化

### 开发环境搭建

```bash
# 安装开发工具
go install github.com/air-verse/air@latest
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest

# 启动热重载开发
air
```

### 代码规范

- 遵循Go官方代码规范
- 使用gofmt格式化代码
- 添加适当的注释和文档
- 编写单元测试

### 测试

```bash
# 运行单元测试
go test ./...

# 运行集成测试
go test -tags=integration ./...

# 生成测试覆盖率报告
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

## 部署

### Docker部署

```bash
# 构建镜像
docker build -t wend-cmdb-backend .

# 运行容器
docker run -p 8080:8080 \
  -e DATABASE_URL="postgres://user:password@host/dbname" \
  -e JWT_SECRET="your-secret" \
  wend-cmdb-backend
```

### Kubernetes部署

```bash
# 应用配置
kubectl apply -f k8s/
```

## 监控和维护

### 健康检查

系统提供多层次的健康检查:

- `/health` - 基础健康检查
- `/health/database` - 数据库连接检查
- `/health/detailed` - 详细健康状态

### 日志管理

- 结构化日志输出
- 支持多种日志级别
- 日志轮转和归档

### 性能监控

- 内置Prometheus指标
- 支持分布式追踪
- 性能分析工具集成

## 安全性

### 认证机制
- JWT令牌认证
- 令牌刷新机制
- 会话管理

### 授权控制
- RBAC权限模型
- 资源级权限控制
- 操作级权限验证

### 数据安全
- 敏感数据加密
- SQL注入防护
- XSS攻击防护

## 贡献指南

我们欢迎社区贡献！请参考[贡献指南](CONTRIBUTING.md)了解如何参与项目开发。

### 问题反馈

如果您发现bug或有功能建议，请在GitHub Issues中提交。

### 开发流程

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

## 许可证

本项目采用MIT许可证，详情请查看[LICENSE](LICENSE)文件。

## 联系我们

- 项目地址: https://github.com/wend/cmdb-backend
- 问题反馈: https://github.com/wend/cmdb-backend/issues
- 邮箱: support@wend.com

---

Copyright © 2024 WEND Technology. All rights reserved.