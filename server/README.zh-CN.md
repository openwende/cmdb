# Wende CMDB Server

[![CI](https://github.com/openwende/cmdb-server/actions/workflows/ci.yml/badge.svg)](https://github.com/openwende/cmdb-server/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

[English](README.md) | 简体中文

Wende CMDB 是一个开源的配置管理数据库，目标是成为人和 AI agent 都能信赖的事实来源。本仓库是它的 API 服务，基于 Go 和 PostgreSQL。

> **状态：** 早期开发阶段。1.0 之前，接口和数据库结构可能随时变化。

## 功能

- **业务拓扑：** 业务 → 集群 → 模块 → 主机的层级，支持空闲机池和默认模块。
- **主机生命周期：** 在业务和资源池之间导入、分配、转移、回收主机，每次变更都有审计记录。
- **动态模型：** 自定义资源类型、属性和实例。
- **权限控制：** JWT 认证，分管理员、编辑者、只读三种角色。
- **MCP 工具：** `/mcp` 提供只读工具，可以搜索业务和主机、查看拓扑、查询变更记录。请求使用调用者自己的令牌。

## 项目组成

| 仓库 | 用途 |
|---|---|
| **cmdb-server**（本仓库） | REST API、MCP 服务、数据库迁移 |
| [cmdb-web](https://github.com/openwende/cmdb-web) | Web 界面 |
| [cmdb-ai](https://github.com/openwende/cmdb-ai) | AI 调查助手 |

```
浏览器 ──▶ cmdb-web ──▶ cmdb-server ──▶ PostgreSQL
              │              ▲
              ▼              │ MCP
           cmdb-ai ──────────┘
```

## 快速开始

需要安装 Docker 和 Compose。从源码运行全部服务：

```bash
git clone https://github.com/openwende/cmdb-server.git
git clone https://github.com/openwende/cmdb-web.git
git clone https://github.com/openwende/cmdb-ai.git

cd cmdb-server/deploy/quickstart
./init-env.sh
docker compose up -d --build
```

打开 <http://localhost:3000>，用 `init-env.sh` 打印的账号密码登录。AI 助手和其他选项见 [deploy/quickstart](deploy/quickstart/README.zh-CN.md)。

## 本地开发

需要 Go（版本见 `go.mod`）和 Docker。

```bash
make dev-db           # 启动 PostgreSQL，监听 127.0.0.1:5432
make db-migrate-up    # 执行迁移
make dev              # 以 debug 模式运行服务，监听 :8080
```

`make dev` 使用 debug 模式，会创建密码公开的演示账号（`admin` / `admin123456`、`editor` / `editor123456`、`viewer` / `viewer123456`），只能用于本地开发。

```bash
go test ./...         # 运行测试
go vet ./...          # 静态检查
gofmt -l .            # 列出未格式化的文件
```

## 配置

配置来自环境变量或 `config/config.yaml`，全部选项见 [config.example.yaml](config/config.example.yaml)。主要变量：

| 变量 | 说明 |
|---|---|
| `SERVER_MODE` | `release`（默认）、`debug` 或 `test` |
| `AUTH_JWT_SECRET` | 令牌签名密钥。release 模式必填，并拒绝公开的示例值。可用 `openssl rand -hex 32` 生成 |
| `AUTH_BOOTSTRAP_ADMIN_PASSWORD` | 空数据库上初始 `admin` 账号的密码。release 模式下不设置时，会生成随机密码并在日志中打印一次 |
| `AUTH_BOOTSTRAP_SEED_DEMO_USERS` | 设为 `true` 时，release 模式也创建演示账号。仅用于公开演示站 |
| `DATABASE_HOST`、`DATABASE_PORT`、`DATABASE_USER`、`DATABASE_PASSWORD`、`DATABASE_NAME` | PostgreSQL 连接 |

## 文档

- [架构方向与决策](docs/ARCHITECTURE_DIRECTION.md)
- [系统架构](docs/ARCHITECTURE.md)
- [API 参考](docs/API.md)
- [路线图](docs/ROADMAP.md)

## 参与贡献

暂不接受外部 Pull Request，但欢迎提交 Bug 报告和功能建议，详见 [CONTRIBUTING.md](CONTRIBUTING.md)（英文）。安全问题请按[安全策略](https://github.com/openwende/.github/blob/main/SECURITY.md)报告，不要公开提 Issue。

## 许可证

基于 [GNU Affero General Public License v3.0](LICENSE) 发布。

业务模型参考了 [BK-CMDB](https://github.com/TencentBlueKing/bk-cmdb)。Wende CMDB 是独立项目，与其没有隶属关系。
