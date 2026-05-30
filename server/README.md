# WEND CMDB Backend

[![Go Version](https://img.shields.io/badge/Go-1.24-blue.svg)](https://golang.org)
[![Test Coverage](https://img.shields.io/badge/coverage-20%25+-yellow.svg)](docs/TESTING.md)
[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)]()
[![License](https://img.shields.io/badge/license-MIT-green.svg)]()

一个严谨的、生产级的 CMDB 后端服务，基于 Go、Gin 和 PostgreSQL 构建。

## 🚀 核心特性

*   **清晰架构**: 三层架构设计 (`Handler` → `Service` → `Repository`)
*   **测试完善**: 50+ 单元测试用例，核心业务逻辑覆盖率 20%+
*   **云原生设计**: 支持多云环境 IP 隔离，借鉴蓝鲸 CMDB 设计理念
*   **PostgreSQL 原生**: 充分利用 PostgreSQL 特性（UUID、JSONB、数组等）
*   **严格迁移管理**: 使用 `golang-migrate` 进行 SQL 迁移，无 ORM 自动迁移
*   **统一部署**: 单一 `docker-compose.yml` 支持开发、快速启动和生产场景

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

# 运行所有测试
go test ./...

# 查看测试覆盖率
go test ./... -cover

# 生成覆盖率报告
go test ./... -coverprofile=coverage.out
go tool cover -html=coverage.out

# 运行API自动化测试
chmod +x scripts/test-api.sh
./scripts/test-api.sh
```

**当前测试覆盖率**:
- `internal/core/business`: 23.5%
- `internal/core/host`: 16.8%
- `internal/storage`: 14.0%
- **总体**: 20%+ (目标: 40%)

详细测试指南请参见 **[测试文档](docs/TESTING.md)**

## 📖 文档

### 核心文档
- **[快速开始](docs/QUICKSTART.md)** - 5 分钟部署指南
- **[API 文档](docs/API.md)** - 完整 API 参考
- **[系统架构](docs/ARCHITECTURE.md)** - 架构设计和核心决策
- **[测试指南](docs/TESTING.md)** - 测试框架和覆盖率
- **[贡献指南](docs/CONTRIBUTING.md)** - 如何贡献代码
- **[更新日志](docs/CHANGELOG.md)** - 版本历史
- **[产品路线图](docs/ROADMAP.md)** - 未来规划

### 特性文档
- **[动态模型 API](docs/DYNAMIC_MODEL_API.md)** - 动态模型引擎
- **[拓扑管理 API](docs/TOPOLOGY_API.md)** - 拓扑结构管理
- **[导入导出指南](docs/IMPORT_EXPORT_GUIDE.md)** - 数据导入导出
- **[主机导入指南](docs/HOST_IMPORT_GUIDE.md)** - 主机批量导入
- **[前端集成指南](docs/FRONTEND_INTEGRATION_GUIDE.md)** - 前端对接

### API 端点概览

#### 业务管理
- `POST /api/v1/businesses` - 创建业务
- `GET /api/v1/businesses` - 列出业务
- `GET /api/v1/businesses/:id` - 获取业务详情
- `PUT /api/v1/businesses/:id` - 更新业务
- `DELETE /api/v1/businesses/:id` - 删除业务（仅限归档状态）

#### 主机管理
- `POST /api/v1/hosts` - 创建主机
- `POST /api/v1/hosts/batch` - 批量导入主机
- `GET /api/v1/hosts` - 列出主机
- `GET /api/v1/hosts/:id` - 获取主机详情
- `PUT /api/v1/hosts/:id/assign` - 分配到业务
- `PUT /api/v1/hosts/:id/reclaim` - 回收到资源池

#### 云区域管理
- `POST /api/v1/cloud-areas` - 创建云区域
- `GET /api/v1/cloud-areas` - 列出云区域
- `GET /api/v1/cloud-areas/:id` - 获取云区域详情

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

更多详细信息请查看 **[完整 API 文档](docs/API.md)**

## ⚙️ Configuration

Copy the template to create your local config:
```bash
cp config/config.example.yaml config/config.yaml
```

The application loads configuration from `config/config.yaml`. See `config/config.example.yaml` for all available options.

## 📦 部署

详细的部署指南（虚拟机、Kubernetes、Docker）请参见 [deploy/README.md](deploy/README.md)。

## 🤝 贡献

欢迎贡献！请参阅 **[贡献指南](docs/CONTRIBUTING.md)** 了解：
- 开发环境设置
- 代码规范
- 提交规范
- 测试要求
- Pull Request 流程

## 📊 项目状态

**当前评分**: 7.5/10

**已完成**:
- ✅ 核心业务管理功能
- ✅ 主机管理和云区域管理
- ✅ 动态模型引擎
- ✅ 测试框架（覆盖率 20%+）
- ✅ 完整文档体系

**进行中**:
- 🚧 提升测试覆盖率至 40%
- 🚧 云资源同步功能
- 🚧 网络拓扑管理
- 🚧 IP 地址池管理

详细路线图请参见 **[ROADMAP.md](docs/ROADMAP.md)**

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

本项目设计借鉴了 [蓝鲸 CMDB (BK-CMDB)](https://github.com/TencentBlueKing/bk-cmdb) 的云区域隔离理念。
