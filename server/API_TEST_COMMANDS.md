#!/bin/bash

# ========================================
# WEND CMDB API 测试命令集 - 交互式版本
# 每次测试前显示命令，用户可以逐个执行
# ========================================

BASE_URL="http://localhost:8080"

cat << 'EOF'
========================================
WEND CMDB API 完整测试命令集
Go 1.26.0 兼容性验证
========================================

本文档包含所有主要 API 的完整测试命令。
每个命令都使用了尽可能多的参数。

注意：
- 所有命令都可以直接复制到终端执行
- 建议按顺序执行，因为有些命令依赖前面的资源ID
- 需要替换的变量已用 ${} 标记

========================================
1. 健康检查
========================================

# GET /health - 健康检查
curl -s -X GET "http://localhost:8080/health" | jq .


========================================
2. 云区域管理 (Cloud Areas)
========================================

# POST /api/v1/cloud-areas - 创建云区域（使用所有参数）
curl -X POST "http://localhost:8080/api/v1/cloud-areas" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试云区域-完整参数",
    "identifier": "test-cloud-area-full",
    "type": "vpc",
    "description": "这是一个包含所有参数的测试云区域",
    "cloud_vendor": "tencent_cloud",
    "vpc_id": "vpc-test-123456",
    "cidr_block": "10.0.0.0/16",
    "region": "ap-guangzhou",
    "custom_fields": {
      "环境": "测试环境",
      "负责人": "张三",
      "成本中心": "CC-2024-001",
      "创建目的": "Go 1.26.0 兼容性测试"
    }
  }' | jq .

# 保存返回的 cloud_area_id
export CLOUD_AREA_ID="<从上面的响应中复制 id>"

# GET /api/v1/cloud-areas/default - 获取默认云区域
curl -s -X GET "http://localhost:8080/api/v1/cloud-areas/default" | jq .

# 保存默认云区域ID
export DEFAULT_CLOUD_AREA_ID="<从响应中复制 id>"

# GET /api/v1/cloud-areas - 查询云区域列表（带所有查询参数）
curl -X GET "http://localhost:8080/api/v1/cloud-areas?cloud_vendor=tencent_cloud&type=vpc&region=ap-guangzhou&page=1&page_size=20" | jq .

# GET /api/v1/cloud-areas/:id - 获取云区域详情
curl -X GET "http://localhost:8080/api/v1/cloud-areas/${CLOUD_AREA_ID}" | jq .

# PUT /api/v1/cloud-areas/:id - 更新云区域（使用所有可更新参数）
curl -X PUT "http://localhost:8080/api/v1/cloud-areas/${CLOUD_AREA_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试云区域-已更新",
    "description": "更新后的描述信息，增加更多细节",
    "cidr_block": "10.0.0.0/8",
    "region": "ap-guangzhou-zone-1",
    "custom_fields": {
      "环境": "生产环境",
      "负责人": "李四",
      "更新时间": "2026-02-13",
      "备注": "扩容后的网络范围"
    }
  }' | jq .


========================================
3. 业务管理 (Business)
========================================

# POST /api/v1/businesses - 创建业务（使用所有参数）
curl -X POST "http://localhost:8080/api/v1/businesses" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试业务-完整参数",
    "identifier": "test-business-full-params",
    "description": "这是一个包含所有参数的测试业务，用于验证Go 1.26.0兼容性",
    "lifecycle": "testing",
    "timezone": "Asia/Shanghai",
    "language": "zh",
    "sres": ["sre1@example.com", "sre2@example.com", "sre3@example.com"],
    "developers": ["dev1@example.com", "dev2@example.com", "dev3@example.com", "dev4@example.com"],
    "testers": ["qa1@example.com", "qa2@example.com"],
    "bizops": ["ops1@example.com", "ops2@example.com"]
  }' | jq .

# 保存业务ID
export BUSINESS_ID="<从响应中复制 id>"

# GET /api/v1/businesses - 查询业务列表（带分页）
curl -X GET "http://localhost:8080/api/v1/businesses?limit=20&offset=0" | jq .

# GET /api/v1/businesses/:id - 获取业务详情
curl -X GET "http://localhost:8080/api/v1/businesses/${BUSINESS_ID}" | jq .

# PUT /api/v1/businesses/:id - 更新业务（使用所有可更新参数）
curl -X PUT "http://localhost:8080/api/v1/businesses/${BUSINESS_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试业务-已更新名称",
    "description": "更新后的业务描述，包含更详细的信息和使用场景",
    "identifier": "test-business-updated",
    "lifecycle": "online",
    "timezone": "Asia/Shanghai",
    "language": "zh-CN"
  }' | jq .


========================================
4. 主机管理 (Hosts)
========================================

# POST /api/v1/hosts - 创建主机（使用所有参数）
curl -X POST "http://localhost:8080/api/v1/hosts" \
  -H "Content-Type: application/json" \
  -d "{
    \"host_name\": \"test-server-full-params-001\",
    \"cloud_area_id\": \"${DEFAULT_CLOUD_AREA_ID}\",
    \"business_id\": \"${BUSINESS_ID}\",
    \"primary_ip\": \"10.0.1.100\",
    \"ip_addresses\": [\"10.0.1.100\", \"172.16.0.10\", \"192.168.1.50\"],
    \"cloud_vendor\": \"tencent_cloud\",
    \"cloud_instance_id\": \"ins-test-123456\",
    \"cloud_region\": \"ap-guangzhou\",
    \"vpc_id\": \"vpc-test-123456\",
    \"subnet_id\": \"subnet-test-001\",
    \"cpu\": 8,
    \"memory\": 16384,
    \"disk_size\": 500,
    \"os_type\": \"linux\",
    \"os_version\": \"Ubuntu 22.04 LTS\",
    \"status\": \"running\",
    \"custom_fields\": {
      \"应用\": \"Web服务器\",
      \"环境\": \"测试环境\",
      \"责任人\": \"运维团队\",
      \"备注\": \"Go 1.26.0测试专用主机\",
      \"标签\": [\"web\", \"nginx\", \"test\"],
      \"监控\": true,
      \"备份\": true
    }
  }" | jq .

# 保存主机ID
export HOST_ID="<从响应中复制 id>"

# POST /api/v1/hosts/batch - 批量导入主机（使用所有参数）
curl -X POST "http://localhost:8080/api/v1/hosts/batch" \
  -H "Content-Type: application/json" \
  -d '{
    "hosts": [
      {
        "host_name": "batch-server-001",
        "primary_ip": "10.0.2.10",
        "ip_addresses": ["10.0.2.10", "172.16.1.10"],
        "cpu": 4,
        "memory": 8192,
        "disk_size": 200,
        "os_type": "linux",
        "os_version": "CentOS 7.9",
        "cloud_vendor": "aliyun",
        "status": "running",
        "custom_fields": {
          "批次": "batch-1",
          "用途": "测试"
        }
      },
      {
        "host_name": "batch-server-002",
        "primary_ip": "10.0.2.11",
        "ip_addresses": ["10.0.2.11"],
        "cpu": 4,
        "memory": 8192,
        "disk_size": 200,
        "os_type": "linux",
        "os_version": "Ubuntu 20.04",
        "status": "running"
      },
      {
        "host_name": "batch-server-003",
        "primary_ip": "10.0.2.12",
        "cpu": 8,
        "memory": 16384,
        "disk_size": 500,
        "os_type": "windows",
        "os_version": "Windows Server 2022",
        "status": "running"
      }
    ],
    "skip_errors": true,
    "use_default_cloud_area": true
  }' | jq .

# GET /api/v1/hosts - 查询主机列表（带所有查询参数）
curl -X GET "http://localhost:8080/api/v1/hosts?business_id=${BUSINESS_ID}&cloud_vendor=tencent_cloud&status=running&os_type=linux&page=1&page_size=20&include_destroyed=false" | jq .

# GET /api/v1/hosts/:id - 获取主机详情
curl -X GET "http://localhost:8080/api/v1/hosts/${HOST_ID}" | jq .

# PUT /api/v1/hosts/:id - 更新主机（使用所有可更新参数）
curl -X PUT "http://localhost:8080/api/v1/hosts/${HOST_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "host_name": "test-server-updated",
    "primary_ip": "10.0.1.101",
    "ip_addresses": ["10.0.1.101", "172.16.0.11", "192.168.1.51", "192.168.1.52"],
    "cpu": 16,
    "memory": 32768,
    "disk_size": 1000,
    "os_type": "linux",
    "os_version": "Ubuntu 24.04 LTS",
    "status": "running",
    "custom_fields": {
      "应用": "Web服务器",
      "环境": "生产环境",
      "更新时间": "2026-02-13",
      "CPU升级": true,
      "内存升级": true,
      "磁盘扩容": true
    }
  }' | jq .

# PUT /api/v1/hosts/:id/custom-fields - 单独更新主机自定义字段
curl -X PUT "http://localhost:8080/api/v1/hosts/${HOST_ID}/custom-fields" \
  -H "Content-Type: application/json" \
  -d '{
    "custom_fields": {
      "项目": "CMDB系统",
      "版本": "v2.2.0",
      "Go版本": "1.26.0",
      "部署方式": "Docker Compose",
      "监控状态": "正常",
      "备份策略": "每日全量+增量",
      "SLA等级": "P0",
      "标签": ["production", "critical", "monitored", "ha"],
      "最后巡检时间": "2026-02-13 17:00:00"
    }
  }' | jq .


========================================
5. 拓扑管理 (Topology)
========================================

# POST /api/v1/topology/businesses/:id/initialize - 初始化业务拓扑
curl -X POST "http://localhost:8080/api/v1/topology/businesses/${BUSINESS_ID}/initialize" | jq .

# POST /api/v1/topology/sets - 创建集群（使用所有参数）
curl -X POST "http://localhost:8080/api/v1/topology/sets" \
  -H "Content-Type: application/json" \
  -d "{
    \"business_id\": \"${BUSINESS_ID}\",
    \"name\": \"Web服务集群\",
    \"description\": \"包含所有Web服务的集群，负责处理前端请求、API服务和静态资源\",
    \"env_type\": \"prod\",
    \"sort_order\": 1
  }" | jq .

# 保存集群ID
export SET_ID="<从响应中复制 id>"

# GET /api/v1/topology/sets - 查询集群列表
curl -X GET "http://localhost:8080/api/v1/topology/sets?business_id=${BUSINESS_ID}" | jq .

# GET /api/v1/topology/sets/:id - 获取集群详情
curl -X GET "http://localhost:8080/api/v1/topology/sets/${SET_ID}" | jq .

# PUT /api/v1/topology/sets/:id - 更新集群（使用所有可更新参数）
curl -X PUT "http://localhost:8080/api/v1/topology/sets/${SET_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Web服务集群-高可用版",
    "description": "更新后的集群描述，增加了负载均衡、缓存层和故障自动转移",
    "env_type": "prod",
    "sort_order": 0
  }' | jq .

# POST /api/v1/topology/modules - 创建模块（使用所有参数）
curl -X POST "http://localhost:8080/api/v1/topology/modules" \
  -H "Content-Type: application/json" \
  -d "{
    \"set_id\": ${SET_ID},
    \"name\": \"Nginx反向代理模块\",
    \"description\": \"负责反向代理、负载均衡和SSL终止的Nginx服务模块\",
    \"service_type\": \"web\",
    \"sort_order\": 1
  }" | jq .

# 保存模块ID
export MODULE_ID="<从响应中复制 id>"

# GET /api/v1/topology/modules - 查询模块列表
curl -X GET "http://localhost:8080/api/v1/topology/modules?set_id=${SET_ID}" | jq .

# GET /api/v1/topology/modules/:id - 获取模块详情
curl -X GET "http://localhost:8080/api/v1/topology/modules/${MODULE_ID}" | jq .

# PUT /api/v1/topology/modules/:id - 更新模块（使用所有可更新参数）
curl -X PUT "http://localhost:8080/api/v1/topology/modules/${MODULE_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nginx反向代理模块-高可用版",
    "description": "增加了健康检查、自动故障转移和会话保持功能",
    "service_type": "web",
    "sort_order": 0
  }' | jq .

# POST /api/v1/topology/hosts/transfer - 转移主机到模块
curl -X POST "http://localhost:8080/api/v1/topology/hosts/transfer" \
  -H "Content-Type: application/json" \
  -d "{
    \"host_ids\": [\"${HOST_ID}\"],
    \"target_module_id\": ${MODULE_ID}
  }" | jq .

# GET /api/v1/topology/modules/:id/hosts - 获取模块下的主机列表
curl -X GET "http://localhost:8080/api/v1/topology/modules/${MODULE_ID}/hosts" | jq .

# GET /api/v1/topology/tree - 获取拓扑树（使用所有参数）
curl -X GET "http://localhost:8080/api/v1/topology/tree?business_id=${BUSINESS_ID}&include_hosts=true&max_depth=4" | jq .

# GET /api/v1/topology/statistics - 获取拓扑统计信息
curl -X GET "http://localhost:8080/api/v1/topology/statistics" | jq .


========================================
6. 业务集管理 (Business Sets)
========================================

# POST /api/v1/business-sets - 创建业务集（使用所有参数）
curl -X POST "http://localhost:8080/api/v1/business-sets" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"核心业务集\",
    \"identifier\": \"core-business-set\",
    \"description\": \"包含所有核心业务的业务集合，用于统一管理和监控\",
    \"business_id\": \"${BUSINESS_ID}\"
  }" | jq .

# 保存业务集ID
export BUSINESS_SET_ID="<从响应中复制 id>"

# GET /api/v1/business-sets - 查询业务集列表
curl -X GET "http://localhost:8080/api/v1/business-sets?limit=20&offset=0" | jq .

# GET /api/v1/business-sets/:id - 获取业务集详情
curl -X GET "http://localhost:8080/api/v1/business-sets/${BUSINESS_SET_ID}" | jq .

# PUT /api/v1/business-sets/:id - 更新业务集
curl -X PUT "http://localhost:8080/api/v1/business-sets/${BUSINESS_SET_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "核心业务集-V2",
    "description": "更新后的业务集描述，增加了更多业务",
    "identifier": "core-business-set-v2"
  }' | jq .

# POST /api/v1/business-sets/:id/members - 添加业务到业务集
curl -X POST "http://localhost:8080/api/v1/business-sets/${BUSINESS_SET_ID}/members" \
  -H "Content-Type: application/json" \
  -d "{
    \"business_id\": \"${BUSINESS_ID}\"
  }" | jq .

# GET /api/v1/business-sets/:id/members - 查询业务集成员
curl -X GET "http://localhost:8080/api/v1/business-sets/${BUSINESS_SET_ID}/members" | jq .


========================================
7. 删除操作（清理测试数据）
========================================

注意：以下是删除操作，执行前请确认！

# DELETE /api/v1/business-sets/:id/members/:business_id - 从业务集移除业务
curl -X DELETE "http://localhost:8080/api/v1/business-sets/${BUSINESS_SET_ID}/members/${BUSINESS_ID}" | jq .

# DELETE /api/v1/business-sets/:id - 删除业务集
curl -X DELETE "http://localhost:8080/api/v1/business-sets/${BUSINESS_SET_ID}" | jq .

# DELETE /api/v1/hosts/:id - 删除主机
curl -X DELETE "http://localhost:8080/api/v1/hosts/${HOST_ID}" | jq .

# DELETE /api/v1/topology/modules/:id - 删除模块
curl -X DELETE "http://localhost:8080/api/v1/topology/modules/${MODULE_ID}" | jq .

# DELETE /api/v1/topology/sets/:id - 删除集群
curl -X DELETE "http://localhost:8080/api/v1/topology/sets/${SET_ID}" | jq .

# DELETE /api/v1/businesses/:id - 删除业务（需要先offline）
# 先将业务设置为offline状态
curl -X PUT "http://localhost:8080/api/v1/businesses/${BUSINESS_ID}" \
  -H "Content-Type: application/json" \
  -d '{"lifecycle": "offline"}' | jq .
# 然后删除业务
curl -X DELETE "http://localhost:8080/api/v1/businesses/${BUSINESS_ID}" | jq .

# DELETE /api/v1/cloud-areas/:id - 删除云区域
curl -X DELETE "http://localhost:8080/api/v1/cloud-areas/${CLOUD_AREA_ID}" | jq .


========================================
✅ 测试命令集完成！
========================================

提示：
1. 按顺序执行命令，注意保存每次创建资源返回的ID
2. 使用 export 命令保存ID变量，后续命令会自动替换
3. 所有命令都包含了尽可能多的参数
4. 删除命令请谨慎执行

Go 1.26.0 兼容性测试 - 2026-02-13
========================================
EOF
