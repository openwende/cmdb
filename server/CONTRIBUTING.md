# Contributing to cmdb-server

> **We are not accepting outside pull requests yet.** See the [organization contributing guide](https://github.com/openwende/.github/blob/main/CONTRIBUTING.md) for why and for other ways to help. The notes below are for project members and for anyone working on their own fork.

## Set up

You need Go (see `go.mod` for the version) and Docker.

```bash
make dev-db           # start PostgreSQL on 127.0.0.1:5432
make db-migrate-up    # apply migrations
make dev              # run the server in debug mode on :8080
```

## Checks

CI runs these checks. Run them locally before you push:

```bash
gofmt -l .            # should print nothing
go vet ./...
go build ./...
go test -race ./...
```

## Guidelines

- **Layers:** code flows from `internal/api/handlers` to `internal/core` to `internal/storage`. Keep business rules in `internal/core`.
- **Schema changes:** add a new pair of files under `migrations/`. Never edit a migration that has been released.
- **Tests:** add tests with behavior changes. Tests that depend on PostgreSQL behavior need to run against PostgreSQL, because SQLite does not cover it.
- **Architecture:** read [ARCHITECTURE_DIRECTION.md](docs/ARCHITECTURE_DIRECTION.md) before large changes, and open an issue to discuss them first.
