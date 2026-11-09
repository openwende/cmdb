# Wende CMDB

[![Server](https://github.com/openwende/cmdb/actions/workflows/server.yml/badge.svg)](https://github.com/openwende/cmdb/actions/workflows/server.yml)
[![Web](https://github.com/openwende/cmdb/actions/workflows/web.yml/badge.svg)](https://github.com/openwende/cmdb/actions/workflows/web.yml)
[![AI](https://github.com/openwende/cmdb/actions/workflows/ai.yml/badge.svg)](https://github.com/openwende/cmdb/actions/workflows/ai.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

English | [简体中文](README.zh-CN.md)

Wende CMDB is an open-source configuration management database built to be a trustworthy source of facts for both people and AI agents.

> **Status:** early development. APIs and the database schema may change without notice before version 1.0.

## Features

- **Business topology:** a business → set → module → host hierarchy with idle pools and default modules.
- **Host lifecycle:** import, allocate, transfer and reclaim hosts between businesses and a resource pool, with audit records for every change.
- **Dynamic models:** define custom resource types, attributes and instances.
- **Access control:** JWT authentication with admin, editor and viewer roles.
- **Agent tools over MCP:** read-only tools for searching businesses and hosts, reading topology and querying change history. Requests run with the caller's own token.
- **AI assistant:** an optional assistant that investigates questions using those tools, and cites the records behind its answers.

## Quick start

You need Docker with Compose.

```bash
git clone https://github.com/openwende/cmdb.git
cd cmdb
./init-env.sh
docker compose up -d --build
```

`init-env.sh` creates `.env` with random secrets and prints the admin password. The first build takes several minutes. When it finishes, open <http://localhost:3000> and sign in.

To stop, run `docker compose down`. Add `-v` to also delete the data.

This setup is for evaluation. Before exposing it to a network, read the [deployment guide](server/deploy/README.md).

### Add the AI assistant

The assistant needs a [DeepSeek](https://platform.deepseek.com/) API key, and using it spends your DeepSeek credit. Set `DEEPSEEK_API_KEY` in `.env`, then run:

```bash
docker compose --profile ai up -d --build
```

Knowledge search is off by default because it needs an embedding model. See [ai/README.md](ai/README.md#knowledge-search) to enable it. When the assistant is running, stop everything with `docker compose --profile ai down`.

### Options

Set these in `.env`:

| Variable | Default | Description |
|---|---|---|
| `WEB_PORT` | `3000` | Port for the web UI |
| `GOPROXY` | `https://proxy.golang.org,direct` | Go module proxy used during the build |

## Repository layout

| Directory | Contents |
|---|---|
| [server/](server/README.md) | REST API, MCP server and database migrations (Go, PostgreSQL) |
| [web/](web/README.md) | Web UI (React, TypeScript) |
| [ai/](ai/README.md) | AI investigation assistant (Python) |

```
browser ──▶ web ──▶ server ──▶ PostgreSQL
             │         ▲
             ▼         │ MCP
             ai ───────┘
```

## Documentation

The design documents below are in Chinese; English translations are planned.

- [Architecture direction and decisions](server/docs/ARCHITECTURE_DIRECTION.md)
- [Architecture](server/docs/ARCHITECTURE.md)
- [API reference](server/docs/API.md)
- [Roadmap](server/docs/ROADMAP.md)

## Contributing

We are not accepting outside pull requests yet, but bug reports and feature requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security issue, follow the [security policy](https://github.com/openwende/.github/blob/main/SECURITY.md) instead of opening a public issue.

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE).

The business model takes inspiration from [BK-CMDB](https://github.com/TencentBlueKing/bk-cmdb). Wende CMDB is an independent project and is not affiliated with it.
