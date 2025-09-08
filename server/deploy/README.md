# WEND CMDB Backend Deployment Guide

This directory contains deployment configurations and scripts for the WEND CMDB Backend system.

## Overview

The WEND CMDB (Configuration Management Database) Backend provides a comprehensive API for managing configuration items, relationships, and business topology. This guide covers various deployment options including Docker, Kubernetes, and Helm.

## Architecture

The system consists of the following components:

- **CMDB Backend**: Core API service built with Go and Gin framework
- **PostgreSQL**: Primary database for storing configuration data
- **Redis**: Caching and session storage
- **Plugin System**: Extensible plugin architecture for custom functionality
- **Event System**: Real-time event processing and notifications
- **Monitoring**: Prometheus metrics and Grafana dashboards (optional)
- **Logging**: ELK stack for centralized logging (optional)

## Prerequisites

### Common Requirements

- Docker 20.10+
- Docker Compose 2.0+ (for Docker Compose deployment)
- Git

### Kubernetes Deployment

- Kubernetes 1.20+
- kubectl configured for your cluster
- Helm 3.8+ (for Helm deployment)
- Ingress controller (nginx recommended)
- Storage class for persistent volumes

### Production Requirements

- SSL/TLS certificates
- Load balancer
- Backup solution for PostgreSQL
- Monitoring and alerting system

## Quick Start

### Docker Compose (Recommended for Development)

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd wend-cmdb-backend
   ```

2. **Start the stack:**
   ```bash
   docker-compose up -d
   ```

3. **Access the application:**
   - API: http://localhost:8080
   - Swagger UI: http://localhost:8080/swagger/index.html
   - Health Check: http://localhost:8080/health

4. **Stop the stack:**
   ```bash
   docker-compose down
   ```

### Kubernetes with Helm (Recommended for Production)

1. **Add dependencies:**
   ```bash
   helm dependency update deploy/helm/cmdb
   ```

2. **Install:**
   ```bash
   helm install cmdb deploy/helm/cmdb --namespace cmdb --create-namespace
   ```

3. **Check status:**
   ```bash
   kubectl get pods -n cmdb
   helm status cmdb -n cmdb
   ```

## Deployment Options

### 1. Docker Compose

**Location:** `docker-compose.yml`

**Features:**
- Full stack with PostgreSQL, Redis, and optional monitoring
- Easy development setup
- Environment variable configuration
- Volume persistence

**Usage:**
```bash
# Start with default configuration
docker-compose up -d

# Start with monitoring stack
docker-compose --profile monitoring up -d

# Start with logging stack
docker-compose --profile logging up -d

# Start with nginx proxy
docker-compose --profile nginx up -d

# Start everything
docker-compose --profile monitoring --profile logging --profile nginx up -d
```

**Configuration:**
Environment variables can be set in `.env` file:
```bash
# Database
DATABASE_PASSWORD=your-secure-password
DATABASE_NAME=cmdb
DATABASE_USER=cmdb

# Redis
REDIS_PASSWORD=your-redis-password

# JWT
JWT_SECRET=your-jwt-secret

# Server
SERVER_PORT=8080
LOG_LEVEL=info
```

### 2. Kubernetes with Helm

**Location:** `deploy/helm/cmdb/`

**Features:**
- Production-ready configuration
- Auto-scaling support
- Health checks and probes
- Security contexts
- Network policies
- Monitoring integration

**Installation:**
```bash
# Install with default values
helm install cmdb deploy/helm/cmdb --namespace cmdb --create-namespace

# Install with custom values
helm install cmdb deploy/helm/cmdb -f custom-values.yaml --namespace cmdb --create-namespace

# Upgrade existing installation
helm upgrade cmdb deploy/helm/cmdb --namespace cmdb
```

**Configuration:**
Edit `deploy/helm/cmdb/values.yaml` or create custom values file:
```yaml
# Custom values example
image:
  tag: "v1.0.0"

resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 1000m
    memory: 1Gi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10

ingress:
  enabled: true
  hosts:
    - host: cmdb.yourdomain.com
      paths:
        - path: /
          pathType: Prefix
```

### 3. Kubernetes with kubectl

**Location:** `deploy/k8s/`

**Features:**
- Direct Kubernetes manifests
- Kustomize support
- Fine-grained control

**Installation:**
```bash
# Apply all manifests
kubectl apply -f deploy/k8s/

# Or use kustomize
kubectl apply -k deploy/k8s/
```

## Build and Push Images

### Using Build Script

```bash
# Build locally
./deploy/scripts/build.sh --name myregistry/cmdb --tag v1.0.0

# Build and push to registry
./deploy/scripts/build.sh --registry myregistry.com --push --tag v1.0.0

# Multi-platform build
./deploy/scripts/build.sh --platform linux/amd64,linux/arm64 --push
```

### Manual Build

```bash
# Build image
docker build -t wend/cmdb-backend:latest .

# Tag for registry
docker tag wend/cmdb-backend:latest myregistry.com/wend/cmdb-backend:v1.0.0

# Push to registry
docker push myregistry.com/wend/cmdb-backend:v1.0.0
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SERVER_HOST` | Server bind address | `0.0.0.0` | No |
| `SERVER_PORT` | Server port | `8080` | No |
| `SERVER_MODE` | Gin mode (debug/release) | `release` | No |
| `DATABASE_HOST` | PostgreSQL host | `localhost` | Yes |
| `DATABASE_PORT` | PostgreSQL port | `5432` | No |
| `DATABASE_NAME` | Database name | `cmdb` | Yes |
| `DATABASE_USER` | Database user | `cmdb` | Yes |
| `DATABASE_PASSWORD` | Database password | - | Yes |
| `REDIS_HOST` | Redis host | `localhost` | Yes |
| `REDIS_PORT` | Redis port | `6379` | No |
| `REDIS_PASSWORD` | Redis password | - | Yes |
| `JWT_SECRET` | JWT signing secret | - | Yes |
| `JWT_EXPIRES_IN` | JWT expiration time | `24h` | No |
| `LOG_LEVEL` | Log level (debug/info/warn/error) | `info` | No |
| `ENABLE_METRICS` | Enable Prometheus metrics | `true` | No |
| `ENABLE_SWAGGER` | Enable Swagger UI | `true` | No |
| `PLUGINS_ENABLED` | Enable plugin system | `true` | No |

### Secrets Management

#### Kubernetes Secrets
```bash
# Create secret manually
kubectl create secret generic cmdb-secrets \
  --from-literal=database-password=your-password \
  --from-literal=redis-password=your-redis-password \
  --from-literal=jwt-secret=your-jwt-secret \
  --namespace cmdb
```

#### External Secrets Operator
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: cmdb-secrets
spec:
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: cmdb-secrets
  data:
  - secretKey: database-password
    remoteRef:
      key: cmdb/database
      property: password
```

## Monitoring and Observability

### Metrics

The application exposes Prometheus metrics at `/metrics` endpoint:

```yaml
# Prometheus configuration
- job_name: 'cmdb-backend'
  static_configs:
  - targets: ['cmdb-backend:9090']
  metrics_path: /metrics
```

**Key Metrics:**
- `cmdb_http_requests_total` - Total HTTP requests
- `cmdb_http_request_duration_seconds` - Request duration
- `cmdb_database_connections` - Database connection pool stats
- `cmdb_plugin_executions_total` - Plugin execution count
- `cmdb_events_published_total` - Published events count

### Health Checks

Health endpoint: `GET /health`

```json
{
  "status": "healthy",
  "timestamp": "2023-12-01T10:00:00Z",
  "version": "1.0.0",
  "checks": {
    "database": "healthy",
    "redis": "healthy",
    "plugins": "healthy"
  }
}
```

### Logging

Structured JSON logging with configurable levels:

```json
{
  "level": "info",
  "time": "2023-12-01T10:00:00Z",
  "msg": "Request completed",
  "method": "GET",
  "path": "/api/v1/models",
  "status": 200,
  "duration": "15ms",
  "trace_id": "abc123"
}
```

## Security

### Network Security

1. **Network Policies:** Restrict pod-to-pod communication
2. **Ingress:** Use TLS termination and rate limiting
3. **Service Mesh:** Consider Istio for advanced security

### Container Security

1. **Non-root User:** Containers run as user 1001
2. **Read-only Filesystem:** Root filesystem is read-only
3. **Security Context:** Drop all capabilities
4. **Resource Limits:** CPU and memory limits set

### Application Security

1. **JWT Authentication:** Secure API access
2. **RBAC:** Role-based access control
3. **Input Validation:** All inputs validated
4. **SQL Injection Protection:** Parameterized queries

## Backup and Recovery

### Database Backup

```bash
# Create backup
kubectl exec -n cmdb deployment/cmdb-postgresql -- \
  pg_dump -U cmdb cmdb > backup-$(date +%Y%m%d).sql

# Restore backup
kubectl exec -i -n cmdb deployment/cmdb-postgresql -- \
  psql -U cmdb cmdb < backup-20231201.sql
```

### Persistent Volume Backup

```bash
# Create volume snapshot (if supported)
kubectl create -f - <<EOF
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: cmdb-data-snapshot
spec:
  source:
    persistentVolumeClaimName: cmdb-data
EOF
```

## Scaling

### Horizontal Scaling

```bash
# Scale manually
kubectl scale deployment cmdb-backend --replicas=5 -n cmdb

# Enable auto-scaling
kubectl autoscale deployment cmdb-backend \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n cmdb
```

### Vertical Scaling

Update resource requests/limits in Helm values:

```yaml
resources:
  limits:
    cpu: 2000m
    memory: 4Gi
  requests:
    cpu: 1000m
    memory: 2Gi
```

## Troubleshooting

### Common Issues

1. **Pod Not Starting:**
   ```bash
   kubectl describe pod <pod-name> -n cmdb
   kubectl logs <pod-name> -n cmdb
   ```

2. **Database Connection Issues:**
   ```bash
   # Check PostgreSQL status
   kubectl get pods -n cmdb -l app.kubernetes.io/name=postgresql
   
   # Check connectivity
   kubectl exec -it deployment/cmdb-backend -n cmdb -- \
     nc -zv cmdb-postgresql 5432
   ```

3. **High Memory Usage:**
   ```bash
   # Check resource usage
   kubectl top pods -n cmdb
   
   # Check memory leaks
   kubectl exec -it deployment/cmdb-backend -n cmdb -- \
     curl localhost:8080/debug/pprof/heap
   ```

### Debug Mode

Enable debug logging:

```yaml
env:
  - name: LOG_LEVEL
    value: "debug"
  - name: SERVER_MODE
    value: "debug"
```

## Migration Guide

### From Docker Compose to Kubernetes

1. **Export data:**
   ```bash
   docker-compose exec postgres pg_dump -U cmdb cmdb > cmdb-export.sql
   ```

2. **Deploy to Kubernetes:**
   ```bash
   helm install cmdb deploy/helm/cmdb --namespace cmdb --create-namespace
   ```

3. **Import data:**
   ```bash
   kubectl exec -i -n cmdb deployment/cmdb-postgresql -- \
     psql -U cmdb cmdb < cmdb-export.sql
   ```

### Version Upgrades

1. **Backup database**
2. **Update image tag in values.yaml**
3. **Run Helm upgrade:**
   ```bash
   helm upgrade cmdb deploy/helm/cmdb --namespace cmdb
   ```
4. **Verify deployment**

## Support

For issues and questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review application logs
3. Check Kubernetes events
4. Open an issue in the repository

## License

This project is licensed under the MIT License - see the LICENSE file for details.