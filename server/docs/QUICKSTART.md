# Wende CMDB Server 快速开始指南

> 本指南使用 `server/docker-compose.yml` 的开发配置（debug 模式，带密码公开的演示账号），只适合本地试用。要运行包含 Web 界面的完整环境，请看[快速开始](../../README.zh-CN.md#快速开始)。

本指南将帮助您快速部署和测试 Wende CMDB Server 服务。

## 目录
- [环境要求](#环境要求)
- [快速部署](#快速部署)
- [API 快速测试](#api-快速测试)
- [完整示例工作流](#完整示例工作流)

---

## 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- curl (用于测试API)

---

## 快速部署

### 1. 启动服务

一键启动数据库和应用服务(包含自动数据库初始化):

```bash
docker-compose up -d
```

### 2. 检查服务状态

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f app

# 检查健康状态
curl http://localhost:8080/health
```

**预期响应**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T10:30:00Z",
  "version": "2.2.0-Refactored",
  "database": "PostgreSQL (Connected)"
}
```

---

## API 快速测试

### 基础测试脚本

创建一个测试脚本 `test-api.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:8080"

echo "=== 测试健康检查 ==="
curl -s $BASE_URL/health | jq

echo -e "\n=== 创建业务 ==="
BUSINESS_RESPONSE=$(curl -s -X POST $BASE_URL/api/v1/businesses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试业务",
    "identifier": "test-business",
    "description": "这是一个测试业务"
  }')
echo $BUSINESS_RESPONSE | jq

# 提取business_id
BUSINESS_ID=$(echo $BUSINESS_RESPONSE | jq -r '.data.id')
echo "Business ID: $BUSINESS_ID"

echo -e "\n=== 查询业务列表 ==="
curl -s $BASE_URL/api/v1/businesses | jq

echo -e "\n=== 创建模型 ==="
curl -s -X POST $BASE_URL/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "server",
    "display_name": "服务器",
    "classification": "resource",
    "description": "服务器资源"
  }' | jq

echo -e "\n=== 为模型添加属性 ==="
curl -s -X POST $BASE_URL/api/v1/models/server/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hostname",
    "display_name": "主机名",
    "field_type": "string",
    "is_required": true,
    "is_unique": true
  }' | jq

echo -e "\n=== 创建实例 ==="
curl -s -X POST $BASE_URL/api/v1/models/server/instances \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3" \
  -d '{
    "properties": {
      "hostname": "test-server-01"
    }
  }' | jq

echo -e "\n=== 查询实例列表 ==="
curl -s "$BASE_URL/api/v1/models/server/instances" \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3" | jq
```

运行测试:
```bash
chmod +x test-api.sh
./test-api.sh
```

---

## 完整示例工作流

### 场景：构建一个简单的主机管理系统

#### 1️⃣ 创建业务

```bash
curl -X POST http://localhost:8080/api/v1/businesses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "云计算平台",
    "identifier": "cloud-platform",
    "description": "公司云计算平台业务",
    "lifecycle": "online",
    "sres": ["alice@example.com", "bob@example.com"],
    "developers": ["charlie@example.com"]
  }' | jq
```

**记录返回的 `business_id`** (示例: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

---

#### 2️⃣ 创建主机模型

```bash
curl -X POST http://localhost:8080/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "host",
    "display_name": "主机",
    "classification": "resource",
    "icon": "server",
    "description": "物理服务器或虚拟机"
  }' | jq
```

---

#### 3️⃣ 定义主机属性

```bash
# hostname 属性
curl -X POST http://localhost:8080/api/v1/models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hostname",
    "display_name": "主机名",
    "field_type": "string",
    "is_required": true,
    "is_unique": true,
    "sort_order": 1
  }' | jq

# ip_address 属性
curl -X POST http://localhost:8080/api/v1/models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ip_address",
    "display_name": "IP地址",
    "field_type": "string",
    "is_required": true,
    "sort_order": 2,
    "options": {
      "pattern": "^\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}$"
    }
  }' | jq

# cpu_cores 属性
curl -X POST http://localhost:8080/api/v1/models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "cpu_cores",
    "display_name": "CPU核心数",
    "field_type": "int",
    "is_required": false,
    "sort_order": 3,
    "options": {
      "min": 1,
      "max": 256,
      "default": 4
    }
  }' | jq

# memory_gb 属性
curl -X POST http://localhost:8080/api/v1/models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "memory_gb",
    "display_name": "内存(GB)",
    "field_type": "int",
    "is_required": false,
    "sort_order": 4,
    "options": {
      "min": 1,
      "max": 2048
    }
  }' | jq

# status 属性(枚举类型)
curl -X POST http://localhost:8080/api/v1/models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "status",
    "display_name": "状态",
    "field_type": "enum",
    "is_required": true,
    "sort_order": 5,
    "options": {
      "enum_values": ["running", "stopped", "maintenance", "error"],
      "default": "running"
    }
  }' | jq

# os 属性
curl -X POST http://localhost:8080/api/v1/models/host/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "os",
    "display_name": "操作系统",
    "field_type": "string",
    "is_required": false,
    "sort_order": 6
  }' | jq
```

---

#### 4️⃣ 查看完整模型定义

```bash
curl http://localhost:8080/api/v1/models/host | jq
```

---

#### 5️⃣ 创建主机实例

**单个创建:**
```bash
curl -X POST http://localhost:8080/api/v1/models/host/instances \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3" \
  -d '{
    "properties": {
      "hostname": "web-server-01",
      "ip_address": "192.168.1.100",
      "cpu_cores": 16,
      "memory_gb": 32,
      "status": "running",
      "os": "Ubuntu 22.04 LTS"
    },
    "business_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }' | jq
```

**批量创建:**
```bash
curl -X POST http://localhost:8080/api/v1/models/host/instances/batch \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3" \
  -d '{
    "instances": [
      {
        "properties": {
          "hostname": "web-server-02",
          "ip_address": "192.168.1.101",
          "cpu_cores": 16,
          "memory_gb": 32,
          "status": "running",
          "os": "Ubuntu 22.04 LTS"
        }
      },
      {
        "properties": {
          "hostname": "web-server-03",
          "ip_address": "192.168.1.102",
          "cpu_cores": 8,
          "memory_gb": 16,
          "status": "running",
          "os": "CentOS 7"
        }
      },
      {
        "properties": {
          "hostname": "db-server-01",
          "ip_address": "192.168.1.200",
          "cpu_cores": 32,
          "memory_gb": 128,
          "status": "running",
          "os": "Ubuntu 22.04 LTS"
        }
      }
    ]
  }' | jq
```

---

#### 6️⃣ 查询主机实例

**查询所有主机:**
```bash
curl "http://localhost:8080/api/v1/models/host/instances?page=1&page_size=20" \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3" | jq
```

**带条件查询 (查询运行中的主机):**
```bash
curl "http://localhost:8080/api/v1/models/host/instances?q=%7B%22status%22%3A%22running%22%7D" \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3" | jq
```

**URL编码说明**: `%7B%22status%22%3A%22running%22%7D` 对应 `{"status":"running"}`

或者使用更易读的方式:
```bash
curl -G "http://localhost:8080/api/v1/models/host/instances" \
  --data-urlencode 'q={"status":"running"}' \
  -H "X-Tenant-ID: ce307a3d-a1a7-4838-ab0b-23182f9851c3" | jq
```

---

#### 7️⃣ 创建业务集并管理成员

**创建业务集:**
```bash
curl -X POST http://localhost:8080/api/v1/business-sets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "生产环境业务集",
    "identifier": "production-set",
    "description": "所有生产环境的业务",
    "business_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }' | jq
```

**记录返回的 `business_set_id`** (示例: `b2c3d4e5-f6a7-8901-bcde-f12345678901`)

**添加更多业务到业务集:**
```bash
curl -X POST http://localhost:8080/api/v1/business-sets/b2c3d4e5-f6a7-8901-bcde-f12345678901/members \
  -H "Content-Type: application/json" \
  -d '{
    "business_id": "c3d4e5f6-a7b8-9012-cdef-123456789012"
  }' | jq
```

**查看业务集成员:**
```bash
curl http://localhost:8080/api/v1/business-sets/b2c3d4e5-f6a7-8901-bcde-f12345678901/members | jq
```

---

## 常用 Makefile 命令

```bash
# 本地开发(需要先启动数据库)
make dev-db          # 只启动数据库
make dev             # 启动开发服务器

# 完整部署
make dev-all         # 启动完整环境(数据库+应用)

# 数据库迁移
make db-migrate-up   # 运行迁移
make db-migrate-down # 回滚迁移

# 测试
make test            # 运行单元测试
make test-integration # 运行集成测试

# 构建
make build           # 构建二进制文件
```

---

## 停止和清理

```bash
# 停止服务
docker-compose down

# 停止服务并删除数据卷(完全清理)
docker-compose down -v

# 删除特定数据卷
docker volume rm cmdb_postgres_data
```

---

## 数据库连接信息

如需直接连接数据库进行调试:

```bash
# 使用 psql
docker exec -it cmdb-db psql -U cmdb -d cmdb

# 或者从本地连接
psql -h localhost -p 5432 -U cmdb -d cmdb
# 密码: password
```

**数据库连接字符串**:
```
postgres://cmdb:password@localhost:5432/cmdb?sslmode=disable
```

---

## 故障排查

### 1. 服务无法启动

```bash
# 查看日志
docker-compose logs app
docker-compose logs db

# 检查容器状态
docker-compose ps
```

### 2. 数据库连接失败

```bash
# 检查数据库健康状态
docker exec cmdb-db pg_isready -U cmdb -d cmdb

# 查看数据库日志
docker-compose logs db
```

### 3. 迁移失败

```bash
# 查看迁移服务日志
docker-compose logs db-migrate

# 手动运行迁移
docker run --rm -v $(pwd)/migrations:/migrations \
  --network cmdb-network \
  migrate/migrate:v4.17.0 \
  -path=/migrations \
  -database postgres://cmdb:password@cmdb-db:5432/cmdb?sslmode=disable \
  up
```

### 4. API返回500错误

```bash
# 查看应用日志
docker-compose logs -f app

# 进入容器检查
docker exec -it cmdb-server sh
```

---

## Postman 集合

推荐导入 Postman 集合进行测试，创建 `postman_collection.json`:

```json
{
  "info": {
    "name": "Wende CMDB API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:8080"
    },
    {
      "key": "tenant_id",
      "value": "ce307a3d-a1a7-4838-ab0b-23182f9851c3"
    }
  ],
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "{{base_url}}/health"
      }
    },
    {
      "name": "Businesses",
      "item": [
        {
          "name": "Create Business",
          "request": {
            "method": "POST",
            "url": "{{base_url}}/api/v1/businesses",
            "header": [{"key": "Content-Type", "value": "application/json"}],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"name\": \"测试业务\",\n  \"identifier\": \"test-business\"\n}"
            }
          }
        },
        {
          "name": "List Businesses",
          "request": {
            "method": "GET",
            "url": "{{base_url}}/api/v1/businesses"
          }
        }
      ]
    }
  ]
}
```

---

## 下一步

- 查看完整 [API 文档](./API.md)
- 了解[架构设计](../deploy/model-design.md)
- 贡献代码请参考 [README](../README.md)

---

**文档版本**: v1.0
**更新时间**: 2026-01-15
