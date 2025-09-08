# WEND CMDB Backend Operations Guide

This guide covers day-to-day operations, maintenance, and troubleshooting for the WEND CMDB Backend system.

## Table of Contents

1. [System Overview](#system-overview)
2. [Monitoring and Alerting](#monitoring-and-alerting)
3. [Log Management](#log-management)
4. [Backup and Recovery](#backup-and-recovery)
5. [Performance Optimization](#performance-optimization)
6. [Security Operations](#security-operations)
7. [Incident Response](#incident-response)
8. [Maintenance Tasks](#maintenance-tasks)
9. [Troubleshooting](#troubleshooting)

## System Overview

### Architecture Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │     Ingress     │    │      CDN        │
│                 │    │   Controller    │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────────────┘
          │                      │
          └──────────────────────┼──────────────────────┐
                                 │                      │
    ┌─────────────────────────────▼─────────────────────▼─────┐
    │                Kubernetes Cluster                       │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
    │  │    CMDB     │  │    CMDB     │  │    CMDB     │    │
    │  │  Backend    │  │  Backend    │  │  Backend    │    │
    │  │   Pod 1     │  │   Pod 2     │  │   Pod 3     │    │
    │  └─────────────┘  └─────────────┘  └─────────────┘    │
    │           │               │               │            │
    │  ┌────────▼───────────────▼───────────────▼──────┐    │
    │  │               Service Layer                   │    │
    │  └─────────────────────┬─────────────────────────┘    │
    │                        │                              │
    │  ┌─────────────┐      ┌▼─────────────┐               │
    │  │ PostgreSQL  │      │    Redis     │               │
    │  │             │      │              │               │
    │  └─────────────┘      └──────────────┘               │
    └─────────────────────────────────────────────────────────┘
```

### Service Dependencies

- **PostgreSQL**: Primary data storage
- **Redis**: Caching and session management
- **Plugin System**: External process communication
- **Event System**: WebSocket connections
- **Monitoring**: Prometheus/Grafana stack

## Monitoring and Alerting

### Key Metrics to Monitor

#### Application Metrics

```promql
# Request Rate
rate(cmdb_http_requests_total[5m])

# Error Rate
rate(cmdb_http_requests_total{status=~"5.."}[5m]) / rate(cmdb_http_requests_total[5m])

# Request Duration
histogram_quantile(0.95, rate(cmdb_http_request_duration_seconds_bucket[5m]))

# Database Connection Pool
cmdb_database_connections{state="active"}
cmdb_database_connections{state="idle"}

# Plugin Execution Success Rate
rate(cmdb_plugin_executions_total{status="success"}[5m]) / rate(cmdb_plugin_executions_total[5m])

# Event Processing Rate
rate(cmdb_events_published_total[5m])
rate(cmdb_events_processed_total[5m])
```

#### Infrastructure Metrics

```promql
# CPU Usage
rate(container_cpu_usage_seconds_total{pod=~"cmdb-backend-.*"}[5m])

# Memory Usage
container_memory_working_set_bytes{pod=~"cmdb-backend-.*"}

# Disk Usage
(node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes

# Network I/O
rate(container_network_receive_bytes_total{pod=~"cmdb-backend-.*"}[5m])
rate(container_network_transmit_bytes_total{pod=~"cmdb-backend-.*"}[5m])
```

### Alert Rules

#### Critical Alerts

```yaml
groups:
- name: cmdb-critical
  rules:
  - alert: CMDBServiceDown
    expr: up{job="cmdb-backend"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "CMDB Backend service is down"
      description: "CMDB Backend service has been down for more than 1 minute"

  - alert: CMDBHighErrorRate
    expr: rate(cmdb_http_requests_total{status=~"5.."}[5m]) / rate(cmdb_http_requests_total[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate in CMDB Backend"
      description: "Error rate is {{ $value | humanizePercentage }} for more than 5 minutes"

  - alert: CMDBDatabaseConnectionFailure
    expr: cmdb_database_connections{state="failed"} > 0
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "Database connection failures"
      description: "Database connection failures detected"
```

#### Warning Alerts

```yaml
- name: cmdb-warning
  rules:
  - alert: CMDBHighLatency
    expr: histogram_quantile(0.95, rate(cmdb_http_request_duration_seconds_bucket[5m])) > 1
    for: 10m
    labels:
      severity: warning
    annotations:
      summary: "High latency in CMDB Backend"
      description: "95th percentile latency is {{ $value }}s for more than 10 minutes"

  - alert: CMDBHighMemoryUsage
    expr: container_memory_working_set_bytes{pod=~"cmdb-backend-.*"} / container_spec_memory_limit_bytes > 0.8
    for: 15m
    labels:
      severity: warning
    annotations:
      summary: "High memory usage"
      description: "Memory usage is {{ $value | humanizePercentage }} for more than 15 minutes"
```

### Grafana Dashboards

#### Main Dashboard Panels

1. **Service Overview**
   - Service status
   - Request rate
   - Error rate
   - Response time

2. **Resource Utilization**
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network I/O

3. **Database Performance**
   - Connection pool status
   - Query performance
   - Lock waits
   - Transaction rate

4. **Plugin System**
   - Plugin execution rate
   - Plugin success rate
   - Plugin resource usage

## Log Management

### Log Levels and Structure

```json
{
  "level": "info",
  "time": "2023-12-01T10:00:00Z",
  "msg": "Request processed",
  "method": "POST",
  "path": "/api/v1/models",
  "status": 201,
  "duration": "150ms",
  "user_id": "user123",
  "trace_id": "abc123def456",
  "span_id": "789ghi012jkl",
  "request_id": "req-456",
  "ip": "192.168.1.100"
}
```

### Log Analysis Queries

#### Common Error Patterns

```bash
# High error rate
kubectl logs -n cmdb deployment/cmdb-backend | grep '"level":"error"' | wc -l

# Database connection errors
kubectl logs -n cmdb deployment/cmdb-backend | grep "database connection"

# Plugin execution failures
kubectl logs -n cmdb deployment/cmdb-backend | grep "plugin execution failed"

# Authentication failures
kubectl logs -n cmdb deployment/cmdb-backend | grep "authentication failed"
```

#### ELK Stack Queries

```json
// High response time requests
{
  "query": {
    "bool": {
      "must": [
        {"term": {"level": "info"}},
        {"range": {"duration_ms": {"gte": 1000}}},
        {"range": {"@timestamp": {"gte": "now-1h"}}}
      ]
    }
  }
}

// Error rate by endpoint
{
  "aggs": {
    "endpoints": {
      "terms": {"field": "path"},
      "aggs": {
        "error_rate": {
          "terms": {"field": "status"},
          "aggs": {
            "count": {"value_count": {"field": "@timestamp"}}
          }
        }
      }
    }
  }
}
```

### Log Retention Policy

- **Debug logs**: 7 days
- **Info logs**: 30 days
- **Warning logs**: 90 days
- **Error logs**: 1 year
- **Audit logs**: 7 years (compliance requirement)

## Backup and Recovery

### Database Backup Strategy

#### Automated Backups

```bash
#!/bin/bash
# Daily backup script

BACKUP_DIR="/backups/cmdb"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="cmdb_backup_${DATE}.sql"

# Create backup
kubectl exec -n cmdb deployment/cmdb-postgresql -- \
  pg_dump -U cmdb -h localhost cmdb > "${BACKUP_DIR}/${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

# Upload to S3 (if configured)
aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}.gz" s3://cmdb-backups/

# Clean old backups (keep 30 days)
find "${BACKUP_DIR}" -name "*.gz" -mtime +30 -delete
```

#### Point-in-Time Recovery

```bash
# Create base backup
kubectl exec -n cmdb deployment/cmdb-postgresql -- \
  pg_basebackup -U cmdb -D /backup/base -Ft -z -P

# Archive WAL files
kubectl exec -n cmdb deployment/cmdb-postgresql -- \
  archive_command = 'cp %p /backup/wal/%f'

# Recovery
kubectl exec -n cmdb deployment/cmdb-postgresql -- \
  pg_ctl start -D /backup/base -o "-c recovery_target_time='2023-12-01 12:00:00'"
```

### Application Data Backup

```bash
# Plugin configurations
kubectl cp cmdb/cmdb-backend-pod:/app/plugins ./backup/plugins/

# Configuration files
kubectl get configmap cmdb-config -n cmdb -o yaml > backup/config.yaml
kubectl get secret cmdb-secrets -n cmdb -o yaml > backup/secrets.yaml

# Persistent volume data
kubectl exec -n cmdb deployment/cmdb-backend -- \
  tar czf - /app/data | docker cp - ./backup/data.tar.gz
```

### Disaster Recovery Procedures

#### RTO/RPO Targets

- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 15 minutes

#### Recovery Steps

1. **Infrastructure Recovery**
   ```bash
   # Deploy infrastructure
   helm install cmdb-dr deploy/helm/cmdb -f disaster-recovery-values.yaml
   
   # Verify cluster state
   kubectl get pods -n cmdb
   ```

2. **Database Recovery**
   ```bash
   # Restore from latest backup
   kubectl exec -i -n cmdb deployment/cmdb-postgresql -- \
     psql -U cmdb cmdb < latest_backup.sql
   
   # Verify data integrity
   kubectl exec -n cmdb deployment/cmdb-postgresql -- \
     psql -U cmdb -c "SELECT COUNT(*) FROM models;"
   ```

3. **Application Recovery**
   ```bash
   # Restore application data
   kubectl cp backup/data.tar.gz cmdb/cmdb-backend-pod:/tmp/
   kubectl exec -n cmdb deployment/cmdb-backend -- \
     tar xzf /tmp/data.tar.gz -C /
   
   # Restart services
   kubectl rollout restart deployment/cmdb-backend -n cmdb
   ```

## Performance Optimization

### Database Optimization

#### Query Performance

```sql
-- Create indexes for frequently queried fields
CREATE INDEX CONCURRENTLY idx_instances_model_id ON instances(model_id);
CREATE INDEX CONCURRENTLY idx_relationships_source_target ON relationships(source_id, target_id);
CREATE INDEX CONCURRENTLY idx_audit_logs_timestamp ON audit_logs(created_at);

-- Optimize query plans
ANALYZE;
VACUUM ANALYZE instances;
VACUUM ANALYZE relationships;

-- Monitor slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE mean_time > 1000 
ORDER BY mean_time DESC;
```

#### Connection Pool Tuning

```yaml
# PostgreSQL configuration
max_connections: 100
shared_buffers: 256MB
effective_cache_size: 1GB
maintenance_work_mem: 64MB
checkpoint_completion_target: 0.9
wal_buffers: 16MB
default_statistics_target: 100

# Application configuration
DATABASE_MAX_OPEN_CONNS: 25
DATABASE_MAX_IDLE_CONNS: 5
DATABASE_CONN_MAX_LIFETIME: 5m
```

### Application Performance

#### Memory Optimization

```go
// Enable garbage collection tuning
GOGC=100
GOMEMLIMIT=1GiB

// Profile memory usage
go tool pprof http://localhost:8080/debug/pprof/heap
```

#### CPU Optimization

```yaml
# Resource limits
resources:
  limits:
    cpu: 2000m
    memory: 2Gi
  requests:
    cpu: 1000m
    memory: 1Gi

# JVM tuning (if using Java components)
JAVA_OPTS: "-Xms512m -Xmx1024m -XX:+UseG1GC"
```

### Caching Strategy

#### Redis Configuration

```yaml
# Redis memory optimization
maxmemory: 512mb
maxmemory-policy: allkeys-lru
save: 900 1 300 10 60 10000

# Application cache settings
CACHE_TTL_MODELS: 300s
CACHE_TTL_INSTANCES: 60s
CACHE_TTL_RELATIONSHIPS: 120s
```

#### Cache Invalidation

```go
// Cache invalidation patterns
func (s *Service) InvalidateModelCache(modelID string) {
    s.cache.Delete("model:" + modelID)
    s.cache.DeletePattern("instances:model:" + modelID + ":*")
    s.cache.DeletePattern("relationships:*:" + modelID + ":*")
}
```

## Security Operations

### Security Monitoring

#### Failed Authentication Attempts

```bash
# Monitor failed logins
kubectl logs -n cmdb deployment/cmdb-backend | grep "authentication failed" | \
  grep -o '"ip":"[^"]*"' | sort | uniq -c | sort -nr

# Alert on suspicious activity
rate(cmdb_auth_failures_total[5m]) > 10
```

#### Vulnerability Scanning

```bash
# Container scanning
trivy image wend/cmdb-backend:latest

# Kubernetes scanning
kube-bench run --targets master,node,etcd,policies

# Network policy validation
kubectl auth can-i --list --as=system:serviceaccount:cmdb:cmdb
```

### Certificate Management

```bash
# Check certificate expiration
kubectl get certificates -n cmdb
kubectl describe certificate cmdb-tls -n cmdb

# Renew certificates (cert-manager)
kubectl delete secret cmdb-tls -n cmdb
kubectl annotate certificate cmdb-tls -n cmdb cert-manager.io/issue-temporary-certificate=""
```

### Access Control

#### RBAC Review

```bash
# Review service account permissions
kubectl describe serviceaccount cmdb -n cmdb
kubectl describe rolebinding -n cmdb
kubectl describe clusterrolebinding | grep cmdb

# Audit user access
kubectl get rolebindings,clusterrolebindings --all-namespaces -o json | \
  jq '.items[] | select(.subjects[]?.name == "username")'
```

## Incident Response

### Incident Classification

#### Severity Levels

- **P0 - Critical**: Complete service outage
- **P1 - High**: Major functionality impacted
- **P2 - Medium**: Minor functionality impacted
- **P3 - Low**: Minor issues, cosmetic problems

### Response Procedures

#### P0 - Critical Incident

1. **Immediate Response (0-15 minutes)**
   ```bash
   # Check service status
   kubectl get pods -n cmdb
   kubectl describe pod <failing-pod> -n cmdb
   
   # Check recent changes
   helm history cmdb -n cmdb
   kubectl rollout history deployment/cmdb-backend -n cmdb
   
   # Emergency rollback if needed
   helm rollback cmdb <previous-revision> -n cmdb
   ```

2. **Investigation (15-60 minutes)**
   ```bash
   # Gather logs
   kubectl logs -n cmdb deployment/cmdb-backend --previous
   kubectl logs -n cmdb deployment/cmdb-postgresql
   
   # Check metrics
   curl http://prometheus:9090/api/v1/query?query=up{job="cmdb-backend"}
   ```

3. **Resolution (60+ minutes)**
   - Apply fixes
   - Test functionality
   - Monitor for stability
   - Update incident documentation

### Communication Templates

#### Status Page Update

```
🔴 INVESTIGATING: We are currently investigating an issue with the CMDB API that may cause slow response times or errors.

Posted: Dec 1, 2023 10:30 PST
Affected Services: CMDB API, Web Interface
```

#### Incident Resolution

```
✅ RESOLVED: The issue affecting the CMDB API has been resolved. All services are operating normally.

Root Cause: Database connection pool exhaustion
Resolution: Increased connection pool size and improved connection handling
Prevention: Added monitoring alerts for connection pool utilization

Posted: Dec 1, 2023 12:15 PST
```

## Maintenance Tasks

### Daily Tasks

- [ ] Check system health dashboards
- [ ] Review error logs and alerts
- [ ] Verify backup completion
- [ ] Monitor resource utilization
- [ ] Check security alerts

### Weekly Tasks

- [ ] Review performance metrics
- [ ] Update security patches
- [ ] Clean up old logs and backups
- [ ] Test backup restoration
- [ ] Review access logs

### Monthly Tasks

- [ ] Security vulnerability assessment
- [ ] Performance capacity planning
- [ ] Database maintenance (VACUUM, ANALYZE)
- [ ] Certificate expiration review
- [ ] Disaster recovery testing

### Quarterly Tasks

- [ ] Full disaster recovery drill
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Documentation updates
- [ ] Team training and knowledge transfer

## Troubleshooting

### Common Issues

#### High CPU Usage

```bash
# Identify CPU-intensive processes
kubectl exec -n cmdb deployment/cmdb-backend -- top

# Check for CPU throttling
kubectl describe pod <pod-name> -n cmdb | grep -A 5 "cpu"

# Profile CPU usage
kubectl exec -n cmdb deployment/cmdb-backend -- \
  curl http://localhost:8080/debug/pprof/profile?seconds=30 > cpu.prof
```

#### Memory Leaks

```bash
# Monitor memory usage over time
kubectl top pod -n cmdb --containers

# Generate memory profile
kubectl exec -n cmdb deployment/cmdb-backend -- \
  curl http://localhost:8080/debug/pprof/heap > heap.prof

# Analyze with pprof
go tool pprof heap.prof
```

#### Database Issues

```bash
# Check database connectivity
kubectl exec -n cmdb deployment/cmdb-backend -- \
  nc -zv cmdb-postgresql 5432

# Monitor active connections
kubectl exec -n cmdb deployment/cmdb-postgresql -- \
  psql -U cmdb -c "SELECT count(*) FROM pg_stat_activity;"

# Check for lock waits
kubectl exec -n cmdb deployment/cmdb-postgresql -- \
  psql -U cmdb -c "SELECT * FROM pg_locks WHERE NOT granted;"
```

#### Plugin System Issues

```bash
# Check plugin status
curl http://cmdb-backend:8080/api/v1/plugins

# Plugin execution logs
kubectl logs -n cmdb deployment/cmdb-backend | grep "plugin"

# Check plugin resource usage
kubectl top pod -n cmdb | grep plugin
```

### Performance Debugging

#### Request Tracing

```bash
# Enable debug logging
kubectl set env deployment/cmdb-backend LOG_LEVEL=debug -n cmdb

# Trace specific request
curl -H "X-Trace-Id: debug123" http://cmdb-backend:8080/api/v1/models

# Find request in logs
kubectl logs -n cmdb deployment/cmdb-backend | grep "debug123"
```

#### Database Query Analysis

```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- Find slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC;

-- Analyze specific query
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM models WHERE name LIKE '%server%';
```

### Recovery Procedures

#### Split-brain Scenarios

```bash
# Identify cluster state
kubectl get nodes
kubectl get pods -n cmdb -o wide

# Check etcd cluster health
kubectl exec -n kube-system etcd-master -- \
  etcdctl endpoint health --cluster

# Restore from backup if needed
etcdctl snapshot restore backup.db
```

#### Data Corruption

```bash
# Check data integrity
kubectl exec -n cmdb deployment/cmdb-postgresql -- \
  pg_dump -U cmdb --schema-only cmdb > schema.sql

# Verify relationships
kubectl exec -n cmdb deployment/cmdb-postgresql -- \
  psql -U cmdb -c "SELECT COUNT(*) FROM relationships WHERE source_id NOT IN (SELECT id FROM instances);"

# Restore from clean backup
kubectl exec -i -n cmdb deployment/cmdb-postgresql -- \
  psql -U cmdb cmdb < clean_backup.sql
```

## Contact Information

### On-Call Escalation

1. **Level 1**: Operations Team
   - Response time: 15 minutes
   - Contact: ops@company.com
   - Phone: +1-555-0123

2. **Level 2**: Engineering Team
   - Response time: 30 minutes
   - Contact: engineering@company.com
   - Phone: +1-555-0124

3. **Level 3**: Senior Engineering
   - Response time: 1 hour
   - Contact: senior-eng@company.com
   - Phone: +1-555-0125

### External Vendors

- **Cloud Provider**: AWS Support
- **Monitoring**: Datadog Support
- **Security**: CrowdStrike Support

---

*This document should be reviewed and updated quarterly to ensure accuracy and completeness.*