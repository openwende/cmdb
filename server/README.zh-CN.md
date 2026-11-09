# Wende CMDB Server

[English](README.md) | 简体中文

[Wende CMDB](../README.zh-CN.md) 的 API 服务：REST API、MCP 服务和数据库迁移，基于 Go 和 PostgreSQL。要运行完整产品，请看[快速开始](../README.zh-CN.md#快速开始)。

## 本地开发

需要 Go（版本见 `go.mod`）和 Docker。

```bash
make dev-db           # 启动 PostgreSQL，监听 127.0.0.1:5432
make db-migrate-up    # 执行迁移
make dev              # 以 debug 模式运行服务，监听 :8080
```

`make dev` 使用 debug 模式，会创建密码公开的演示账号（`admin` / `admin123456`、`editor` / `editor123456`、`viewer` / `viewer123456`），只能用于本地开发。

## 配置

配置来自环境变量或 `config/config.yaml`，全部选项见 [config.example.yaml](config/config.example.yaml)。主要变量：

| 变量 | 说明 |
|---|---|
| `SERVER_MODE` | `release`（默认）、`debug` 或 `test` |
| `AUTH_JWT_SECRET` | 令牌签名密钥。release 模式必填，并拒绝公开的示例值。可用 `openssl rand -hex 32` 生成 |
| `AUTH_BOOTSTRAP_ADMIN_PASSWORD` | 空数据库上初始 `admin` 账号的密码。release 模式下不设置时，会生成随机密码并在日志中打印一次 |
| `AUTH_BOOTSTRAP_SEED_DEMO_USERS` | 设为 `true` 时，release 模式也创建演示账号。仅用于公开演示站 |
| `DATABASE_HOST`、`DATABASE_PORT`、`DATABASE_USER`、`DATABASE_PASSWORD`、`DATABASE_NAME` | PostgreSQL 连接 |

生产部署见[部署指南](deploy/README.md)（英文）。

## MCP

`/mcp` 为 agent 提供只读工具：`search_businesses`、`get_business_topology`、`search_hosts`、`get_host`、`query_host_changes` 和 `list_pool_directories`。请求使用调用者自己的 JWT 认证。

## 文档

- [架构方向与决策](docs/ARCHITECTURE_DIRECTION.md)
- [系统架构](docs/ARCHITECTURE.md)
- [API 参考](docs/API.md)
- [路线图](docs/ROADMAP.md)
