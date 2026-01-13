# WEND CMDB Backend

A strict, production-ready CMDB backend service built with Go, Gin, and PostgreSQL.

## 🚀 Key Features

*   **Clean Architecture**: Layered design (`handlers` -> `service` -> `repository`).
*   **Strict SQL Migrations**: No ORM auto-migration. Schema managed by `golang-migrate` with timestamped SQL files.
*   **PostgreSQL Native**: Optimized for Postgres (uses `uuid`, `text[]`, etc.). No SQLite legacy.
*   **Unified Deployment**: Single `docker-compose.yml` for Dev, QuickStart, and Prod scenarios.

## 📂 Project Structure

```
├── cmd/business-server/     # Entrypoint
├── internal/
│   ├── api/                 # HTTP Layer
│   │   ├── handlers/        # Business logic handlers
│   │   └── server/          # Server setup & routing
│   ├── core/                # Business Service Layer
│   ├── storage/             # Repository Layer (Postgres)
│   └── types/               # Domain Models
├── pkg/config/              # Configuration loading
├── migrations/              # SQL Migration files
├── config/                  # Configuration files
│   ├── config.yaml          # Local config (gitignored)
│   └── config.example.yaml  # Config template
├── deploy/                  # Deployment docs & scripts
├── docker-compose.yml       # Unified Docker Compose
└── Makefile                 # Build & Dev commands
```

## 🛠️ Getting Started

### 1. Development (Local)
Run the database in Docker, and the app locally.

```bash
# Start Postgres only
make dev-db

# Run App
make dev
```

### 2. Quick Start (Full Stack)
Run everything in Docker.

```bash
docker-compose up -d
```
Access API at `http://localhost:8080/health`

### 3. Build & Test

```bash
# Build Binary
make build

# Run Unit Tests
make test
```

## ⚙️ Configuration

Copy the template to create your local config:
```bash
cp config/config.example.yaml config/config.yaml
```

The application loads configuration from `config/config.yaml`. See `config/config.example.yaml` for all available options.

## 📦 Deployment

See [deploy/README.md](deploy/README.md) for detailed deployment guides (VM, Kubernetes, Docker).
