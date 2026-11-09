# Wende CMDB Web

English | [简体中文](README.zh-CN.md)

The web UI for [Wende CMDB](../README.md). Built with React, TypeScript, Vite and Ant Design. To run the whole product, see the [quick start](../README.md#quick-start).

> **Status:** early development. Some charts on the statistics pages still show sample data, and are labeled as such.

## Features

- **Business topology:** browse and manage the business → set → module → host hierarchy.
- **Host management:** import from Excel, allocate, transfer and reclaim hosts, and search the resource pool.
- **Models:** manage resource types, attributes and unique rules.
- **Audit:** filter change records by object, action, time and account.
- **AI assistant:** a chat panel for the optional [AI service](../ai/README.md), with answers that link to their evidence.
- **Languages:** English and Simplified Chinese.

## Development

You need Node.js 22 or later, and [Corepack](https://nodejs.org/api/corepack.html) for pnpm. Start the [server](../server/README.md) first, then run:

```bash
corepack enable
pnpm install
pnpm dev              # http://localhost:5173
```

In development, the UI calls the API at `http://localhost:8080/api` and the AI service at `http://localhost:8090`.

| Command                | Purpose                             |
| ---------------------- | ----------------------------------- |
| `pnpm build`           | Type-check and build for production |
| `pnpm lint`            | Run ESLint                          |
| `pnpm typecheck`       | Run the TypeScript compiler         |
| `pnpm format:check`    | Check formatting with Prettier      |
| `pnpm exec vitest run` | Run tests once                      |

## Configuration

These variables are read at build time:

| Variable          | Default in production | Description                                                                                                 |
| ----------------- | --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL`    | `/api`                | Base URL of the API                                                                                         |
| `VITE_AI_API_URL` | `/ai-api`             | Base URL of the AI service                                                                                  |
| `VITE_DEMO_LOGIN` | off                   | Set to `true` to show the demo accounts and one-click sign-in on the login page. Only for public demo sites |

The [Dockerfile](Dockerfile) builds an image that serves the UI with nginx and proxies these paths to the `server` and `ai` containers. See [deploy/nginx.conf](deploy/nginx.conf).
