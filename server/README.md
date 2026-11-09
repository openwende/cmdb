# Wende CMDB Server

[![CI](https://github.com/openwende/cmdb-server/actions/workflows/ci.yml/badge.svg)](https://github.com/openwende/cmdb-server/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

English | [简体中文](README.zh-CN.md)

Wende CMDB is an open-source configuration management database built to be a trustworthy source of facts for both people and AI agents. This repository is its API server, written in Go on PostgreSQL.

> **Status:** early development. APIs and the database schema may change without notice before version 1.0.

## Features

- **Business topology:** a business → set → module → host hierarchy with idle pools and default modules.
- **Host lifecycle:** import, allocate, transfer and reclaim hosts between businesses and a resource pool, with audit records for every change.
- **Dynamic models:** define custom resource types, attributes and instances.
- **Access control:** JWT authentication with admin, editor and viewer roles.
- **Agent tools over MCP:** read-only tools at `/mcp` for searching businesses and hosts, reading topology and querying change history. Requests run with the caller's own token.

## Project layout

| Repository | Purpose |
|---|---|
| **cmdb-server** (this one) | REST API, MCP server, database migrations |
| [cmdb-web](https://github.com/openwende/cmdb-web) | Web UI |
| [cmdb-ai](https://github.com/openwende/cmdb-ai) | AI investigation assistant |

```
browser ──▶ cmdb-web ──▶ cmdb-server ──▶ PostgreSQL
               │              ▲
               ▼              │ MCP
            cmdb-ai ──────────┘
```

## Quick start

You need Docker with Compose. To run everything from source:

```bash
git clone https://github.com/openwende/cmdb-server.git
git clone https://github.com/openwende/cmdb-web.git
git clone https://github.com/openwende/cmdb-ai.git

cd cmdb-server/deploy/quickstart
./init-env.sh
docker compose up -d --build
```

Open <http://localhost:3000> and sign in with the username and password that `init-env.sh` printed. See [deploy/quickstart](deploy/quickstart/README.md) for the AI assistant and other options.

## Development

You need Go (see `go.mod` for the version) and Docker.

```bash
make dev-db           # start PostgreSQL on 127.0.0.1:5432
make db-migrate-up    # apply migrations
make dev              # run the server in debug mode on :8080
```

`make dev` runs in debug mode, which creates demo accounts with published passwords (`admin` / `admin123456`, `editor` / `editor123456`, `viewer` / `viewer123456`). Use it for local development only.

```bash
go test ./...         # run tests
go vet ./...          # static checks
gofmt -l .            # list unformatted files
```

## Configuration

Settings come from environment variables or a `config/config.yaml` file; [config.example.yaml](config/config.example.yaml) lists them all. The most important variables are:

| Variable | Description |
|---|---|
| `SERVER_MODE` | `release` (default), `debug` or `test` |
| `AUTH_JWT_SECRET` | Token signing key. Required in release mode; published example values are refused. Generate one with `openssl rand -hex 32` |
| `AUTH_BOOTSTRAP_ADMIN_PASSWORD` | Password for the initial `admin` account on an empty database. If unset in release mode, a random password is logged once |
| `AUTH_BOOTSTRAP_SEED_DEMO_USERS` | Set to `true` to create demo accounts in release mode. Only for public demo sites |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | PostgreSQL connection |

## Documentation

The design documents below are in Chinese; English translations are planned.

- [Architecture direction and decisions](docs/ARCHITECTURE_DIRECTION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Roadmap](docs/ROADMAP.md)

## Contributing

We are not accepting outside pull requests yet, but bug reports and feature requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). To report a security issue, follow the [security policy](https://github.com/openwende/.github/blob/main/SECURITY.md) instead of opening a public issue.

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE).

The business model takes inspiration from [BK-CMDB](https://github.com/TencentBlueKing/bk-cmdb). Wende CMDB is an independent project and is not affiliated with it.
