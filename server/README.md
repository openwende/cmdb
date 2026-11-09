# Wende CMDB Server

English | [简体中文](README.zh-CN.md)

The API server for [Wende CMDB](../README.md): REST API, MCP server and database migrations, written in Go on PostgreSQL. To run the whole product, see the [quick start](../README.md#quick-start).

## Development

You need Go (see `go.mod` for the version) and Docker.

```bash
make dev-db           # start PostgreSQL on 127.0.0.1:5432
make db-migrate-up    # apply migrations
make dev              # run the server in debug mode on :8080
```

`make dev` runs in debug mode, which creates demo accounts with published passwords (`admin` / `admin123456`, `editor` / `editor123456`, `viewer` / `viewer123456`). Use it for local development only.

## Configuration

Settings come from environment variables or a `config/config.yaml` file; [config.example.yaml](config/config.example.yaml) lists them all. The most important variables are:

| Variable | Description |
|---|---|
| `SERVER_MODE` | `release` (default), `debug` or `test` |
| `AUTH_JWT_SECRET` | Token signing key. Required in release mode; published example values are refused. Generate one with `openssl rand -hex 32` |
| `AUTH_BOOTSTRAP_ADMIN_PASSWORD` | Password for the initial `admin` account on an empty database. If unset in release mode, a random password is logged once |
| `AUTH_BOOTSTRAP_SEED_DEMO_USERS` | Set to `true` to create demo accounts in release mode. Only for public demo sites |
| `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` | PostgreSQL connection |

See the [deployment guide](deploy/README.md) for production setups.

## MCP

`/mcp` provides read-only tools for agents: `search_businesses`, `get_business_topology`, `search_hosts`, `get_host`, `query_host_changes` and `list_pool_directories`. Requests authenticate with the caller's own JWT.

## Documentation

These documents are in Chinese; English translations are planned.

- [Architecture direction and decisions](docs/ARCHITECTURE_DIRECTION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API reference](docs/API.md)
- [Roadmap](docs/ROADMAP.md)
