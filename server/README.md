# WEND CMDB Backend (Slim)

最小可用的 Business 域后端（REST），基于 Go + Gin + GORM + PostgreSQL。

## 目录结构（精简）

```
├── cmd/business-server/     # 入口：业务服务 HTTP Server
├── internal/core/business/  # 业务领域服务
├── internal/storage/        # 数据库连接与仓储
├── internal/types/          # 领域模型（业务）
├── pkg/config/              # 配置加载
├── migrations/              # 数据库迁移（SQL）
├── docker-compose.business.yml
├── Dockerfile.business
└── docs/DELIVERY_NOTES.md   # 交付说明
```

## 本地运行

```bash
# 直接启动（读取 config.yaml）
make dev

# 构建二进制
make build
make server
```

## Docker Compose

```bash
docker compose -f docker-compose.business.yml up -d --build
docker compose -f docker-compose.business.yml ps
docker compose -f docker-compose.business.yml logs -f cmdb-business-server
```

默认端口：`8080`（可在 `config.yaml` 或环境变量中覆盖）。

## API（当前范围）

- GET `/health`
- POST `/api/v1/businesses`
- GET `/api/v1/businesses`
- GET `/api/v1/businesses/:id`
- PUT `/api/v1/businesses/:id`
- DELETE `/api/v1/businesses/:id`
- POST `/api/v1/business-sets`

详情见 `docs/DELIVERY_NOTES.md`。

## 配置

参考 `config.yaml` 或 `deploy/configs/business-config.yaml`（compose 会挂载至容器 `/app/config.yaml`）。

## 说明

此仓库已去除未使用的 GraphQL、插件系统、复杂查询、CLI 等模块，后续需要可按需逐步引入。仅保留 Business 域的最小可用实现与必要依赖。
