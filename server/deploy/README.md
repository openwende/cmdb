# WEND CMDB Deployment Guide

## 1. Development Environment (Local)

For developers who want to run the Go application locally (e.g. `go run ...`) but need infrastructure dependencies.

**Command:**
```bash
# Start PostgreSQL only
docker-compose up -d db

# Or via Makefile
make dev-db
```

**Connection:**
- **Host**: `localhost`
- **Port**: `5432`
- **Creds**: `cmdb` / `password` (Matches default `config/config.yaml`)

---

## 2. Quick Start (Open Source / Demo)

For users who want to quickly spin up the entire system to experience the features.

**Command:**
```bash
# Start full stack (App + DB)
docker-compose up -d

# Check status
docker-compose ps
```

**Access:**
- **API**: `http://localhost:8080`
- **Health**: `http://localhost:8080/health`

---

## 3. Production Deployment

### VM / Single Node
You can use the `docker-compose.yml` related features, but ensure you:
1. Update `docker-compose.yml` environment variables with strong passwords.
2. Mount a persistent volume for Postgres data that is backed up.
3. Consider using a reverse proxy (Nginx) in front of port 8080.

### Kubernetes (K8s)
The Docker image is cloud-native ready (non-root user, health checks, environment config).

1. **Build & Push Image**:
   ```bash
   ./deploy/scripts/build.sh --name your-registry/cmdb --tag v1.0.0 --push
   ```

2. **Deploy (Minimal Config)**:
   Create a standard Deployment + Service + Secret.
   *   **Liveness Probe**: `GET /health`
   *   **Config**: Inject via Environment Variables (see `config/config.example.yaml` key mappings).
   *   **Security**: Runs as `UID 1001` (cmdb).

### Configuration
See `config/config.example.yaml` for all environment variable mappings (e.g., `SERVER_PORT`, `DB_HOST`).