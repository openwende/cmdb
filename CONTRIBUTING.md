# Contributing to Wende CMDB

> **We are not accepting outside pull requests yet.** See the [organization contributing guide](https://github.com/openwende/.github/blob/main/CONTRIBUTING.md) for why and for other ways to help. The notes below are for project members and for anyone working on their own fork.

## Server (`server/`)

You need Go (see `server/go.mod` for the version) and Docker.

```bash
cd server
make dev-db           # start PostgreSQL on 127.0.0.1:5432
make db-migrate-up    # apply migrations
make dev              # run the server in debug mode on :8080
```

CI runs these checks. Run them locally before you push:

```bash
gofmt -l .            # should print nothing
go vet ./...
go build ./...
go test -race ./...
```

- **Layers:** code flows from `internal/api/handlers` to `internal/core` to `internal/storage`. Keep business rules in `internal/core`.
- **Schema changes:** add a new pair of files under `server/migrations/`. Never edit a migration that has been released.
- **Tests:** add tests with behavior changes. Tests that depend on PostgreSQL behavior need to run against PostgreSQL, because SQLite does not cover it.
- **Architecture:** read [ARCHITECTURE_DIRECTION.md](server/docs/ARCHITECTURE_DIRECTION.md) before large changes, and open an issue to discuss them first.

## Web (`web/`)

You need Node.js 22 or later, and a running server.

```bash
cd web
corepack enable
pnpm install
pnpm dev
```

CI runs these checks. Run them locally before you push:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm exec vitest run
pnpm build
```

- **Text:** user-facing text goes in both `src/locales/en-US.json` and `src/locales/zh-CN.json`.
- **API calls:** go through the shared client in `src/api`, which handles tokens and sign-in redirects.
- **Types:** avoid `any` in new code. ESLint warns about it, and existing warnings are being cleaned up over time.
- **Tests:** add tests with behavior changes, using Vitest and Testing Library.

## AI (`ai/`)

You need [uv](https://docs.astral.sh/uv/). Database tests also need PostgreSQL with pgvector; they are skipped when it is not available.

```bash
cd ai
uv sync
```

CI runs these checks. Run them locally before you push:

```bash
uv run ruff check .
uv run ruff format --check .
uv run pytest
```

Tests do not call the model or the network.

Prompt and tool changes affect answer quality in ways unit tests cannot see:

1. **Measure:** run the same configuration three times with `eval/run_eval.py` and compare with `eval/compare.py`. Include the numbers in the pull request.
2. **Start small:** when changing a judging prompt, tune it on a few cases before running the full set, because runs spend model credit. Use `eval/judge.py --dry-run` to estimate calls.
3. **Keep answers out:** evaluation answers must not appear in prompts or in `knowledge/`.

The AI service only creates and changes tables in its own `ai` schema. It must not change CMDB tables or data.
