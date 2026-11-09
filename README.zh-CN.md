# Wende CMDB

[![Server](https://github.com/openwende/cmdb/actions/workflows/server.yml/badge.svg)](https://github.com/openwende/cmdb/actions/workflows/server.yml)
[![Web](https://github.com/openwende/cmdb/actions/workflows/web.yml/badge.svg)](https://github.com/openwende/cmdb/actions/workflows/web.yml)
[![AI](https://github.com/openwende/cmdb/actions/workflows/ai.yml/badge.svg)](https://github.com/openwende/cmdb/actions/workflows/ai.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

[English](README.md) | 简体中文

Wende CMDB 是一个开源的配置管理数据库，目标是成为人和 AI agent 都能信赖的事实来源。

> **状态：** 早期开发阶段。1.0 之前，接口和数据库结构可能随时变化。

## 功能

- **业务拓扑：** 业务 → 集群 → 模块 → 主机的层级，支持空闲机池和默认模块。
- **主机生命周期：** 在业务和资源池之间导入、分配、转移、回收主机，每次变更都有审计记录。
- **动态模型：** 自定义资源类型、属性和实例。
- **权限控制：** JWT 认证，分管理员、编辑者、只读三种角色。
- **MCP 工具：** 提供只读工具，可以搜索业务和主机、查看拓扑、查询变更记录。请求使用调用者自己的令牌。
- **AI 助手：** 可选的助手，用这些工具调查问题，并引用回答依据的记录。

## 快速开始

需要安装 Docker 和 Compose。

```bash
git clone https://github.com/openwende/cmdb.git
cd cmdb
./init-env.sh
docker compose up -d --build
```

`init-env.sh` 会生成带随机密钥的 `.env`，并打印管理员密码。首次构建需要几分钟，完成后打开 <http://localhost:3000> 并登录。

要停止，运行 `docker compose down`；加上 `-v` 会同时删除数据。

这套配置用于试用。暴露到网络之前，请阅读[部署指南](server/deploy/README.md)（英文）。

### 启用 AI 助手

AI 助手需要 [DeepSeek](https://platform.deepseek.com/) API Key，使用时会消耗你的 DeepSeek 额度。在 `.env` 里填好 `DEEPSEEK_API_KEY`，然后运行：

```bash
docker compose --profile ai up -d --build
```

知识库检索需要向量模型，默认关闭，启用方法见 [ai/README.zh-CN.md](ai/README.zh-CN.md#知识库检索)。AI 助手运行时，用 `docker compose --profile ai down` 停止全部服务。

### 选项

在 `.env` 中设置：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `WEB_PORT` | `3000` | Web 界面的端口 |
| `GOPROXY` | `https://proxy.golang.org,direct` | 构建时使用的 Go 模块代理。国内网络可设为 `https://goproxy.cn,direct` |

## 目录结构

| 目录 | 内容 |
|---|---|
| [server/](server/README.zh-CN.md) | REST API、MCP 服务和数据库迁移（Go、PostgreSQL） |
| [web/](web/README.zh-CN.md) | Web 界面（React、TypeScript） |
| [ai/](ai/README.zh-CN.md) | AI 调查助手（Python） |

```
浏览器 ──▶ web ──▶ server ──▶ PostgreSQL
            │         ▲
            ▼         │ MCP
            ai ───────┘
```

## 文档

- [架构方向与决策](server/docs/ARCHITECTURE_DIRECTION.md)
- [系统架构](server/docs/ARCHITECTURE.md)
- [API 参考](server/docs/API.md)
- [路线图](server/docs/ROADMAP.md)

## 参与贡献

暂不接受外部 Pull Request，但欢迎提交 Bug 报告和功能建议，详见 [CONTRIBUTING.md](CONTRIBUTING.md)（英文）。安全问题请按[安全策略](https://github.com/openwende/.github/blob/main/SECURITY.md)报告，不要公开提 Issue。

## 许可证

基于 [GNU Affero General Public License v3.0](LICENSE) 发布。

业务模型参考了 [BK-CMDB](https://github.com/TencentBlueKing/bk-cmdb)。Wende CMDB 是独立项目，与其没有隶属关系。
