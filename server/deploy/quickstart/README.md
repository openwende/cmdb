# Quick start

English | [简体中文](README.zh-CN.md)

Runs PostgreSQL, the API server and the web UI from source with Docker Compose. The AI assistant is optional.

## Start

Clone [cmdb-server](https://github.com/openwende/cmdb-server), [cmdb-web](https://github.com/openwende/cmdb-web) and [cmdb-ai](https://github.com/openwende/cmdb-ai) into the same parent directory, then run:

```bash
cd cmdb-server/deploy/quickstart
./init-env.sh
docker compose up -d --build
```

`init-env.sh` creates `.env` with random secrets and prints the admin password. The first build takes several minutes. When it finishes, open <http://localhost:3000>.

## Add the AI assistant

The assistant needs a [DeepSeek](https://platform.deepseek.com/) API key, and using it spends your DeepSeek credit. Set `DEEPSEEK_API_KEY` in `.env`, then run:

```bash
docker compose --profile ai up -d --build
```

Knowledge search is off by default because it needs an embedding model. See the [cmdb-ai README](https://github.com/openwende/cmdb-ai#knowledge-search) to enable it.

## Options

Set these in `.env`:

| Variable | Default | Description |
|---|---|---|
| `WEB_PORT` | `3000` | Port for the web UI |
| `GOPROXY` | `https://proxy.golang.org,direct` | Go module proxy used during the build |
| `CMDB_WEB_DIR` | `../../../cmdb-web` | Path to the cmdb-web checkout |
| `CMDB_AI_DIR` | `../../../cmdb-ai` | Path to the cmdb-ai checkout |

## Stop

```bash
docker compose --profile ai down      # stop and keep the data
docker compose --profile ai down -v   # stop and delete the data
```

## Going to production

This setup is for evaluation. Before exposing it to a network, put it behind a reverse proxy that terminates TLS, and change the admin password after signing in for the first time.
