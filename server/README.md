# WEND CMDB Backend

A strict, production-ready CMDB backend service built with Go, Gin, and PostgreSQL.

## 🚀 Key Features

*   **Clean Architecture**: Layered design (`handlers` -> `service` -> `repository`).
*   **Strict SQL Migrations**: No ORM auto-migration. Schema managed by `golang-migrate` with timestamped SQL files.
*   **PostgreSQL Native**: Optimized for Postgres (uses `uuid`, `text[]`, etc.). No SQLite legacy.
*   **Unified Deployment**: Single `docker-compose.yml` for Dev, QuickStart, and Prod scenarios.

## 📂 Project Structure

```
├── cmd/business-server/     # Entrypoint
├── internal/
│   ├── api/                 # HTTP Layer
│   │   ├── handlers/        # Business logic handlers
│   │   └── server/          # Server setup & routing
│   ├── core/                # Business Service Layer
│   ├── storage/             # Repository Layer (Postgres)
│   └── types/               # Domain Models
├── pkg/config/              # Configuration loading
├── migrations/              # SQL Migration files
├── config/                  # Configuration files
│   ├── config.yaml          # Local config (gitignored)
│   └── config.example.yaml  # Config template
├── deploy/                  # Deployment docs & scripts
├── docker-compose.yml       # Unified Docker Compose
└── Makefile                 # Build & Dev commands
```

## 🛠️ Getting Started

### 1. Quick Start (Recommended)
一键启动完整环境(数据库+应用+自动迁移):

```bash
docker-compose up -d
```

验证服务运行:
```bash
curl http://localhost:8080/health
```

### 2. Development (Local)
本地开发模式(数据库在Docker，应用在本地运行):

```bash
# 启动数据库
make dev-db

# 运行数据库迁移
make db-migrate-up

# 运行应用
make dev
```

### 3. Build & Test

```bash
# 构建二进制文件
make build

# 运行单元测试
make test

# 运行API自动化测试
chmod +x scripts/test-api.sh
./scripts/test-api.sh
```

## 📖 Documentation

### API Documentation
完整的API使用文档，包含所有接口的详细说明和示例：
- **[API 文档](docs/API.md)** - 完整的API接口文档
- **[快速开始指南](docs/QUICKSTART.md)** - 快速部署和测试指南

### API端点概览

#### 业务管理
- `POST /api/v1/businesses` - 创建业务
- `GET /api/v1/businesses` - 列出业务
- `GET /api/v1/businesses/:id` - 获取业务详情
- `PUT /api/v1/businesses/:id` - 更新业务
- `DELETE /api/v1/businesses/:id` - 删除业务

#### 业务集管理
- `POST /api/v1/business-sets` - 创建业务集
- `GET /api/v1/business-sets` - 列出业务集
- `POST /api/v1/business-sets/:id/members` - 添加成员
- `GET /api/v1/business-sets/:id/members` - 查看成员
- `DELETE /api/v1/business-sets/:id/members/:business_id` - 移除成员

#### 动态模型引擎
- `POST /api/v1/models` - 创建模型
- `GET /api/v1/models` - 列出模型
- `POST /api/v1/models/:name/attributes` - 添加属性
- `POST /api/v1/models/:name/instances` - 创建实例
- `POST /api/v1/models/:name/instances/batch` - 批量创建实例
- `GET /api/v1/models/:name/instances` - 查询实例

更多详细信息请查看 **[完整API文档](docs/API.md)**

## ⚙️ Configuration

Copy the template to create your local config:
```bash
cp config/config.example.yaml config/config.yaml
```

The application loads configuration from `config/config.yaml`. See `config/config.example.yaml` for all available options.

## 📦 Deployment

See [deploy/README.md](deploy/README.md) for detailed deployment guides (VM, Kubernetes, Docker).
