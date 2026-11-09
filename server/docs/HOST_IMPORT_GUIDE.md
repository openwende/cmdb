# 云主机批量导入功能使用指南

## 📋 功能概述

本功能实现了云主机的批量导入和管理，支持通过 REST API 导入、查询、更新和删除主机数据。

## 🚀 快速开始

### 1. 运行数据库迁移

```bash
# 确保 PostgreSQL 数据库已启动
make dev-db

# 运行数据库迁移
make db-migrate-up
```

### 2. 启动服务

```bash
# 开发模式启动
make dev

# 或者构建后启动
make build-server
./bin/cmdb-server
```

### 3. 测试 API

服务默认运行在 `http://localhost:8080`

---

## 📚 API 接口说明

### 网络空间管理

#### 1. 创建网络空间

```bash
POST /api/v1/network-spaces
Content-Type: application/json

{
  "name": "生产VPC",
  "identifier": "prod-vpc",
  "cidr_block": "10.0.0.0/16",
  "region": "ap-guangzhou",
  "type": "vpc",
  "description": "生产环境VPC",
  "custom_fields": {
    "environment": "production",
    "owner": "运维团队"
  }
}
```

**响应示例**：
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-01-26T10:00:00Z",
  "updated_at": "2026-01-26T10:00:00Z",
  "tenant_id": "...",
  "name": "生产VPC",
  "identifier": "prod-vpc",
  "cidr_block": "10.0.0.0/16",
  "region": "ap-guangzhou",
  "type": "vpc",
  "description": "生产环境VPC",
  "custom_fields": {
    "environment": "production",
    "owner": "运维团队"
  }
}
```

#### 2. 获取网络空间列表

```bash
GET /api/v1/network-spaces?page=1&page_size=20&region=ap-guangzhou
```

#### 3. 获取网络空间详情

```bash
GET /api/v1/network-spaces/{id}
```

---

### 主机管理

#### 1. 创建单个主机

```bash
POST /api/v1/hosts
Content-Type: application/json

{
  "host_name": "web-server-01",
  "network_space_id": "550e8400-e29b-41d4-a716-446655440000",
  "primary_ip": "10.0.1.10",
  "ip_addresses": ["10.0.1.10", "172.16.0.10"],
  "cloud_vendor": "tencent_cloud",
  "cloud_instance_id": "ins-abc123",
  "cloud_region": "ap-guangzhou",
  "cpu": 4,
  "memory": 8192,
  "disk_size": 100,
  "os_type": "linux",
  "os_version": "Ubuntu 22.04",
  "status": "running",
  "custom_fields": {
    "department": "技术部",
    "owner": "张三",
    "purpose": "Web服务器",
    "tags": ["production", "web"]
  }
}
```

#### 2. 批量导入主机 ⭐️

这是核心功能！支持一次性导入多台主机。

```bash
POST /api/v1/hosts/batch
Content-Type: application/json

{
  "hosts": [
    {
      "host_name": "web-server-01",
      "network_space_id": "550e8400-e29b-41d4-a716-446655440000",
      "primary_ip": "10.0.1.10",
      "ip_addresses": ["10.0.1.10"],
      "cloud_vendor": "tencent_cloud",
      "cpu": 4,
      "memory": 8192,
      "os_type": "linux",
      "status": "running",
      "custom_fields": {
        "department": "技术部",
        "owner": "张三",
        "purpose": "Web服务器"
      }
    },
    {
      "host_name": "db-server-01",
      "network_space_id": "550e8400-e29b-41d4-a716-446655440000",
      "primary_ip": "10.0.1.20",
      "cloud_vendor": "custom",
      "cpu": 8,
      "memory": 16384,
      "disk_size": 500,
      "os_type": "linux",
      "os_version": "CentOS 7",
      "custom_fields": {
        "department": "技术部",
        "owner": "李四",
        "purpose": "MySQL数据库"
      }
    },
    {
      "host_name": "cache-server-01",
      "network_space_id": "550e8400-e29b-41d4-a716-446655440000",
      "primary_ip": "10.0.1.30",
      "cloud_vendor": "aws",
      "cloud_instance_id": "i-0123456789abcdef",
      "cloud_region": "us-east-1",
      "cpu": 2,
      "memory": 4096,
      "os_type": "linux",
      "custom_fields": {
        "department": "技术部",
        "owner": "王五",
        "purpose": "Redis缓存"
      }
    }
  ],
  "skip_errors": true,
  "create_network_space": false
}
```

**响应示例**：
```json
{
  "total": 3,
  "successful": 3,
  "failed": 0,
  "errors": [],
  "created_ids": [
    "650e8400-e29b-41d4-a716-446655440001",
    "650e8400-e29b-41d4-a716-446655440002",
    "650e8400-e29b-41d4-a716-446655440003"
  ]
}
```

**参数说明**：
- `hosts`: 主机列表（必填）
- `skip_errors`: 遇到错误是否跳过继续导入（默认 false）
- `create_network_space`: 网络空间不存在时是否自动创建（默认 false，暂未实现）

**错误处理示例**：
```json
{
  "total": 3,
  "successful": 2,
  "failed": 1,
  "errors": [
    {
      "index": 1,
      "host_name": "db-server-01",
      "error": "IP address 10.0.1.20 already exists in network space"
    }
  ],
  "created_ids": [
    "650e8400-e29b-41d4-a716-446655440001",
    "650e8400-e29b-41d4-a716-446655440003"
  ]
}
```

#### 3. 获取主机列表

```bash
# 基础查询
GET /api/v1/hosts?page=1&page_size=20

# 按网络空间过滤
GET /api/v1/hosts?network_space_id=550e8400-e29b-41d4-a716-446655440000

# 按云厂商过滤
GET /api/v1/hosts?cloud_vendor=tencent_cloud

# 按状态过滤
GET /api/v1/hosts?status=running

# 包含已销毁主机
GET /api/v1/hosts?include_destroyed=true

# 组合查询
GET /api/v1/hosts?network_space_id=xxx&status=running&os_type=linux&page=1&page_size=50
```

**响应示例**：
```json
{
  "total": 100,
  "page": 1,
  "page_size": 20,
  "hosts": [
    {
      "id": "...",
      "host_name": "web-server-01",
      "primary_ip": "10.0.1.10",
      "status": "running",
      "network_space": {
        "id": "...",
        "name": "生产VPC",
        "identifier": "prod-vpc"
      },
      "custom_fields": {
        "department": "技术部",
        "owner": "张三"
      }
    }
  ]
}
```

#### 4. 获取主机详情

```bash
GET /api/v1/hosts/{id}
```

#### 5. 更新主机

```bash
PUT /api/v1/hosts/{id}
Content-Type: application/json

{
  "host_name": "web-server-01-new",
  "cpu": 8,
  "memory": 16384,
  "status": "stopped"
}
```

#### 6. 更新主机自定义字段

```bash
PUT /api/v1/hosts/{id}/custom-fields
Content-Type: application/json

{
  "custom_fields": {
    "department": "运维部",
    "owner": "赵六",
    "tags": ["production", "critical", "high-priority"],
    "backup_schedule": "daily"
  }
}
```

**注意**：此接口会合并自定义字段，不会覆盖未提供的字段。

#### 7. 删除主机

```bash
# 标记为已销毁（默认，保留记录）
DELETE /api/v1/hosts/{id}?mark_destroyed=true

# 软删除（移到回收站）
DELETE /api/v1/hosts/{id}?mark_destroyed=false
```

---

## 💡 使用场景示例

### 场景 1: 初次导入现有主机资产

**步骤**：

1. **创建网络空间**
```bash
curl -X POST http://localhost:8080/api/v1/network-spaces \
  -H "Content-Type: application/json" \
  -d '{
    "name": "生产VPC",
    "identifier": "prod-vpc",
    "cidr_block": "10.0.0.0/16",
    "region": "ap-guangzhou",
    "type": "vpc"
  }'
```

2. **准备主机数据**（JSON 文件：`hosts.json`）
```json
{
  "hosts": [
    {
      "host_name": "web-01",
      "network_space_id": "YOUR_NETWORK_SPACE_ID",
      "primary_ip": "10.0.1.10",
      "cpu": 4,
      "memory": 8192,
      "os_type": "linux",
      "custom_fields": {
        "department": "技术部",
        "owner": "张三"
      }
    },
    {
      "host_name": "web-02",
      "network_space_id": "YOUR_NETWORK_SPACE_ID",
      "primary_ip": "10.0.1.11",
      "cpu": 4,
      "memory": 8192,
      "os_type": "linux",
      "custom_fields": {
        "department": "技术部",
        "owner": "李四"
      }
    }
  ],
  "skip_errors": true
}
```

3. **批量导入**
```bash
curl -X POST http://localhost:8080/api/v1/hosts/batch \
  -H "Content-Type: application/json" \
  -d @hosts.json
```

### 场景 2: 从云平台导出数据后导入

假设你有从腾讯云导出的主机清单，可以转换为以下格式：

```python
# convert_tencent_to_cmdb.py
import json

# 从腾讯云 API 获取的数据
tencent_instances = [
    {
        "InstanceId": "ins-abc123",
        "InstanceName": "prod-web-01",
        "PrivateIpAddresses": ["10.0.1.10"],
        "CPU": 4,
        "Memory": 8,
        "OsName": "Ubuntu Server 22.04 LTS",
        "Region": "ap-guangzhou"
    }
]

# 转换为 CMDB 格式
cmdb_hosts = []
for instance in tencent_instances:
    cmdb_hosts.append({
        "host_name": instance["InstanceName"],
        "network_space_id": "YOUR_NETWORK_SPACE_ID",
        "primary_ip": instance["PrivateIpAddresses"][0],
        "cloud_vendor": "tencent_cloud",
        "cloud_instance_id": instance["InstanceId"],
        "cloud_region": instance["Region"],
        "cpu": instance["CPU"],
        "memory": instance["Memory"] * 1024,  # 转换为 MB
        "os_type": "linux",
        "custom_fields": {
            "cloud_source": "tencent_cloud",
            "import_time": "2026-01-26"
        }
    })

# 输出导入数据
with open('import.json', 'w', encoding='utf-8') as f:
    json.dump({
        "hosts": cmdb_hosts,
        "skip_errors": True
    }, f, indent=2, ensure_ascii=False)
```

然后导入：
```bash
curl -X POST http://localhost:8080/api/v1/hosts/batch \
  -H "Content-Type: application/json" \
  -d @import.json
```

### 场景 3: 更新主机自定义字段

```bash
# 批量更新多台主机的部门字段
for host_id in "id1" "id2" "id3"; do
  curl -X PUT "http://localhost:8080/api/v1/hosts/${host_id}/custom-fields" \
    -H "Content-Type: application/json" \
    -d '{
      "custom_fields": {
        "department": "DevOps团队",
        "updated_at": "2026-01-26"
      }
    }'
done
```

---

## 🔍 数据模型说明

### 主机字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `host_name` | string | ✅ | 主机名 |
| `primary_ip` | string (IP) | ✅ | 主IP地址 |
| `network_space_id` | UUID | ❌ | 网络空间ID |
| `ip_addresses` | []string | ❌ | IP地址列表 |
| `cloud_vendor` | string | ❌ | 云厂商：aws, tencent_cloud, aliyun, custom |
| `cloud_instance_id` | string | ❌ | 云实例ID |
| `cloud_region` | string | ❌ | 云区域 |
| `cpu` | int | ❌ | CPU核数 |
| `memory` | int | ❌ | 内存（MB） |
| `disk_size` | int | ❌ | 磁盘大小（GB） |
| `os_type` | string | ❌ | 操作系统类型：linux, windows |
| `os_version` | string | ❌ | 操作系统版本 |
| `status` | string | ❌ | 状态：running, stopped, terminated |
| `custom_fields` | object | ❌ | 自定义字段（JSON对象） |

### 自定义字段示例

```json
{
  "custom_fields": {
    "department": "技术部",
    "owner": "张三",
    "purpose": "Web服务器",
    "tags": ["production", "web", "nginx"],
    "backup_enabled": true,
    "monitoring_url": "https://monitor.example.com/host/123",
    "maintenance_window": "Sunday 02:00-04:00",
    "cost_center": "CC-001",
    "project": "电商平台"
  }
}
```

自定义字段支持任意 JSON 数据类型（字符串、数字、布尔值、数组、对象）。

---

## 🚨 错误处理

### 常见错误

1. **IP 冲突**
```json
{
  "error": "IP address 10.0.1.10 already exists in this network space"
}
```

**解决方案**：检查 IP 是否已被使用，或者使用不同的 IP

2. **网络空间不存在**
```json
{
  "error": "network space not found"
}
```

**解决方案**：先创建网络空间，或者检查 `network_space_id` 是否正确

3. **云实例ID冲突**
```json
{
  "error": "cloud instance ins-abc123 (tencent_cloud) already exists"
}
```

**解决方案**：该云实例已导入，检查是否重复导入

4. **无效的IP格式**
```json
{
  "error": "validation failed: invalid primary_ip format: 10.0.1"
}
```

**解决方案**：提供合法的 IPv4 或 IPv6 地址

---

## 📊 性能建议

### 批量导入优化

1. **分批导入**：建议每批不超过 500 台主机
```bash
# 假设有 2000 台主机，分 4 批导入
split -l 500 all_hosts.json batch_
```

2. **并发导入**：如果主机分属不同网络空间，可以并发导入
```bash
# 并发导入多个批次（小心控制并发数）
for batch in batch_*.json; do
  curl -X POST http://localhost:8080/api/v1/hosts/batch \
    -H "Content-Type: application/json" \
    -d @$batch &
done
wait
```

3. **错误跳过**：大批量导入时建议开启 `skip_errors`
```json
{
  "hosts": [...],
  "skip_errors": true
}
```

---

## 🔄 与云同步功能的关系

当前实现的批量导入是**手动导入**功能，后续会扩展**云同步**功能：

| 功能 | 批量导入（当前） | 云同步（未来） |
|------|-----------------|----------------|
| 数据来源 | 手动准备 JSON/Excel | 自动从云API获取 |
| 触发方式 | 手动调用 API | 定时任务 + 手动触发 |
| 字段填充 | 手动填写所有字段 | 自动填充云平台字段 |
| `cloud_metadata` | 可选填充 | 自动填充 |
| `custom_fields` | 手动填充 | 保留手动填充 |

**扩展路径**：
1. 当前：手动批量导入 ✅
2. Phase 2：实现云同步引擎（复用相同的数据模型）
3. Phase 3：云同步自动更新（增量同步）

---

## 📝 下一步

### 待实现功能

- [ ] Excel/CSV 文件上传导入
- [ ] 导入模板下载
- [ ] 导入历史记录
- [ ] 云同步功能
- [ ] 主机变更历史
- [ ] 主机关系拓扑

### 建议优化

1. **认证授权**：添加租户隔离和用户认证
2. **数据校验**：添加更严格的数据校验规则
3. **审计日志**：记录所有导入和修改操作
4. **导出功能**：支持导出为 Excel/CSV
5. **批量操作**：支持批量更新、批量删除

---

## 🐛 问题反馈

如有问题，请提供以下信息：
1. API 请求完整内容（包括 headers 和 body）
2. 完整的错误响应
3. 数据库日志（如果有）
4. 导入的主机数量

---

**版本**：v1.0.0
**更新时间**：2026-01-26
**文档维护**：Wende CMDB Team
