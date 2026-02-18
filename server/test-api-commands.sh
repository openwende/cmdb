#!/bin/bash

# ========================================
# WEND CMDB API 完整测试命令集
# Go 1.26.0 兼容性验证
# ========================================

BASE_URL="http://localhost:8080"
CONTENT_TYPE="Content-Type: application/json"

# 颜色输出
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印分隔符
print_separator() {
    echo -e "${BLUE}========================================${NC}"
}

# 打印测试标题
print_test() {
    echo -e "\n${GREEN}[测试] $1${NC}"
    echo -e "${YELLOW}命令:${NC}"
}

# ========================================
# 1. 健康检查
# ========================================
print_separator
echo -e "${BLUE}1. 健康检查 API${NC}"
print_separator

print_test "GET /health - 健康检查"
echo "curl -s -X GET \"$BASE_URL/health\" | jq ."
curl -s -X GET "$BASE_URL/health" | jq .

# ========================================
# 2. 云区域管理 (Cloud Areas)
# ========================================
print_separator
echo -e "${BLUE}2. 云区域管理 API${NC}"
print_separator

print_test "POST /api/v1/cloud-areas - 创建云区域（使用所有参数）"
cat << 'EOF'
curl -X POST "$BASE_URL/api/v1/cloud-areas" \
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
EOF

CLOUD_AREA_ID=$(curl -s -X POST "$BASE_URL/api/v1/cloud-areas" \
  -H "$CONTENT_TYPE" \
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
      "成本中心": "CC-2024-001"
    }
  }' | jq -r '.data.id')

echo "创建的云区域ID: $CLOUD_AREA_ID"

print_test "GET /api/v1/cloud-areas - 查询云区域列表（带参数）"
cat << 'EOF'
curl -X GET "$BASE_URL/api/v1/cloud-areas?cloud_vendor=tencent_cloud&type=vpc&page=1&page_size=10" | jq .
EOF
curl -s -X GET "$BASE_URL/api/v1/cloud-areas?cloud_vendor=tencent_cloud&type=vpc&page=1&page_size=10" | jq .

print_test "GET /api/v1/cloud-areas/default - 获取默认云区域"
echo "curl -X GET \"$BASE_URL/api/v1/cloud-areas/default\" | jq ."
DEFAULT_CLOUD_AREA_ID=$(curl -s -X GET "$BASE_URL/api/v1/cloud-areas/default" | jq -r '.data.id')
echo "默认云区域ID: $DEFAULT_CLOUD_AREA_ID"

print_test "GET /api/v1/cloud-areas/:id - 获取云区域详情"
echo "curl -X GET \"$BASE_URL/api/v1/cloud-areas/$CLOUD_AREA_ID\" | jq ."
curl -s -X GET "$BASE_URL/api/v1/cloud-areas/$CLOUD_AREA_ID" | jq .

print_test "PUT /api/v1/cloud-areas/:id - 更新云区域"
cat << EOF
curl -X PUT "$BASE_URL/api/v1/cloud-areas/$CLOUD_AREA_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "测试云区域-已更新",
    "description": "更新后的描述信息",
    "cidr_block": "10.0.0.0/8",
    "custom_fields": {
      "环境": "生产环境",
      "负责人": "李四",
      "更新时间": "2026-02-13"
    }
  }' | jq .
EOF
curl -s -X PUT "$BASE_URL/api/v1/cloud-areas/$CLOUD_AREA_ID" \
  -H "$CONTENT_TYPE" \
  -d '{
    "name": "测试云区域-已更新",
    "description": "更新后的描述信息",
    "cidr_block": "10.0.0.0/8",
    "custom_fields": {
      "环境": "生产环境",
      "负责人": "李四"
    }
  }' | jq .

# ========================================
# 3. 业务管理 (Business)
# ========================================
print_separator
echo -e "${BLUE}3. 业务管理 API${NC}"
print_separator

print_test "POST /api/v1/businesses - 创建业务（使用所有参数）"
cat << 'EOF'
curl -X POST "$BASE_URL/api/v1/businesses" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试业务-完整参数",
    "identifier": "test-business-full-params",
    "description": "这是一个包含所有参数的测试业务，用于验证Go 1.26.0兼容性",
    "lifecycle": "testing",
    "sres": ["sre1@example.com", "sre2@example.com"],
    "developers": ["dev1@example.com", "dev2@example.com", "dev3@example.com"],
    "testers": ["qa1@example.com", "qa2@example.com"],
    "bizops": ["ops1@example.com"]
  }' | jq .
EOF

BUSINESS_ID=$(curl -s -X POST "$BASE_URL/api/v1/businesses" \
  -H "$CONTENT_TYPE" \
  -d '{
    "name": "测试业务-完整参数",
    "identifier": "test-business-full-params",
    "description": "这是一个包含所有参数的测试业务",
    "lifecycle": "testing",
    "sres": ["sre1@example.com", "sre2@example.com"],
    "developers": ["dev1@example.com", "dev2@example.com"],
    "testers": ["qa1@example.com"],
    "bizops": ["ops1@example.com"]
  }' | jq -r '.data.id')

echo "创建的业务ID: $BUSINESS_ID"

print_test "GET /api/v1/businesses - 查询业务列表（带分页）"
echo "curl -X GET \"$BASE_URL/api/v1/businesses?limit=20&offset=0\" | jq ."
curl -s -X GET "$BASE_URL/api/v1/businesses?limit=20&offset=0" | jq .

print_test "GET /api/v1/businesses/:id - 获取业务详情"
echo "curl -X GET \"$BASE_URL/api/v1/businesses/$BUSINESS_ID\" | jq ."
curl -s -X GET "$BASE_URL/api/v1/businesses/$BUSINESS_ID" | jq .

print_test "PUT /api/v1/businesses/:id - 更新业务（使用所有可更新参数）"
cat << EOF
curl -X PUT "$BASE_URL/api/v1/businesses/$BUSINESS_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "测试业务-已更新名称",
    "description": "更新后的业务描述，包含更详细的信息",
    "identifier": "test-business-updated",
    "lifecycle": "online",
    "timezone": "Asia/Shanghai",
    "language": "zh-CN"
  }' | jq .
EOF
curl -s -X PUT "$BASE_URL/api/v1/businesses/$BUSINESS_ID" \
  -H "$CONTENT_TYPE" \
  -d '{
    "name": "测试业务-已更新名称",
    "description": "更新后的业务描述",
    "lifecycle": "online",
    "timezone": "Asia/Shanghai",
    "language": "zh-CN"
  }' | jq .

# ========================================
# 4. 主机管理 (Hosts)
# ========================================
print_separator
echo -e "${BLUE}4. 主机管理 API${NC}"
print_separator

print_test "POST /api/v1/hosts - 创建主机（使用所有参数）"
cat << EOF
curl -X POST "$BASE_URL/api/v1/hosts" \\
  -H "Content-Type: application/json" \\
  -d '{
    "host_name": "test-server-full-params-001",
    "cloud_area_id": "$CLOUD_AREA_ID",
    "business_id": "$BUSINESS_ID",
    "primary_ip": "10.0.1.100",
    "ip_addresses": ["10.0.1.100", "172.16.0.10", "192.168.1.50"],
    "cloud_vendor": "tencent_cloud",
    "cloud_instance_id": "ins-test-123456",
    "cloud_region": "ap-guangzhou",
    "vpc_id": "vpc-test-123456",
    "subnet_id": "subnet-test-001",
    "cpu": 8,
    "memory": 16384,
    "disk_size": 500,
    "os_type": "linux",
    "os_version": "Ubuntu 22.04 LTS",
    "status": "running",
    "custom_fields": {
      "应用": "Web服务器",
      "环境": "测试环境",
      "责任人": "运维团队",
      "备注": "Go 1.26.0测试专用主机",
      "标签": ["web", "nginx", "test"]
    }
  }' | jq .
EOF

HOST_ID=$(curl -s -X POST "$BASE_URL/api/v1/hosts" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"host_name\": \"test-server-full-params-001\",
    \"cloud_area_id\": \"$CLOUD_AREA_ID\",
    \"business_id\": \"$BUSINESS_ID\",
    \"primary_ip\": \"10.0.1.100\",
    \"ip_addresses\": [\"10.0.1.100\", \"172.16.0.10\"],
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
      \"环境\": \"测试环境\"
    }
  }" | jq -r '.data.id')

echo "创建的主机ID: $HOST_ID"

print_test "POST /api/v1/hosts/batch - 批量导入主机"
cat << EOF
curl -X POST "$BASE_URL/api/v1/hosts/batch" \\
  -H "Content-Type: application/json" \\
  -d '{
    "hosts": [
      {
        "host_name": "batch-server-001",
        "primary_ip": "10.0.2.10",
        "cpu": 4,
        "memory": 8192,
        "os_type": "linux"
      },
      {
        "host_name": "batch-server-002",
        "primary_ip": "10.0.2.11",
        "cpu": 4,
        "memory": 8192,
        "os_type": "linux"
      },
      {
        "host_name": "batch-server-003",
        "primary_ip": "10.0.2.12",
        "cpu": 8,
        "memory": 16384,
        "os_type": "windows",
        "os_version": "Windows Server 2022"
      }
    ],
    "skip_errors": true,
    "use_default_cloud_area": true
  }' | jq .
EOF
curl -s -X POST "$BASE_URL/api/v1/hosts/batch" \
  -H "$CONTENT_TYPE" \
  -d '{
    "hosts": [
      {
        "host_name": "batch-server-001",
        "primary_ip": "10.0.2.10",
        "cpu": 4,
        "memory": 8192,
        "os_type": "linux"
      },
      {
        "host_name": "batch-server-002",
        "primary_ip": "10.0.2.11",
        "cpu": 4,
        "memory": 8192,
        "os_type": "linux"
      }
    ],
    "skip_errors": true,
    "use_default_cloud_area": true
  }' | jq .

print_test "GET /api/v1/hosts - 查询主机列表（带所有查询参数）"
cat << EOF
curl -X GET "$BASE_URL/api/v1/hosts?cloud_area_id=$CLOUD_AREA_ID&business_id=$BUSINESS_ID&cloud_vendor=tencent_cloud&status=running&os_type=linux&page=1&page_size=20" | jq .
EOF
curl -s -X GET "$BASE_URL/api/v1/hosts?business_id=$BUSINESS_ID&status=running&page=1&page_size=20" | jq .

print_test "GET /api/v1/hosts/:id - 获取主机详情"
echo "curl -X GET \"$BASE_URL/api/v1/hosts/$HOST_ID\" | jq ."
curl -s -X GET "$BASE_URL/api/v1/hosts/$HOST_ID" | jq .

print_test "PUT /api/v1/hosts/:id - 更新主机（使用所有可更新参数）"
cat << EOF
curl -X PUT "$BASE_URL/api/v1/hosts/$HOST_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "host_name": "test-server-updated",
    "primary_ip": "10.0.1.101",
    "ip_addresses": ["10.0.1.101", "172.16.0.11", "192.168.1.51"],
    "cpu": 16,
    "memory": 32768,
    "disk_size": 1000,
    "os_version": "Ubuntu 24.04 LTS",
    "status": "running",
    "custom_fields": {
      "应用": "Web服务器",
      "环境": "生产环境",
      "更新时间": "2026-02-13",
      "CPU升级": true
    }
  }' | jq .
EOF
curl -s -X PUT "$BASE_URL/api/v1/hosts/$HOST_ID" \
  -H "$CONTENT_TYPE" \
  -d '{
    "host_name": "test-server-updated",
    "cpu": 16,
    "memory": 32768,
    "disk_size": 1000,
    "status": "running"
  }' | jq .

print_test "PUT /api/v1/hosts/:id/custom-fields - 更新主机自定义字段"
cat << EOF
curl -X PUT "$BASE_URL/api/v1/hosts/$HOST_ID/custom-fields" \\
  -H "Content-Type: application/json" \\
  -d '{
    "custom_fields": {
      "项目": "CMDB系统",
      "版本": "v2.2.0",
      "Go版本": "1.26.0",
      "部署方式": "Docker Compose",
      "监控状态": "正常",
      "备份策略": "每日全量",
      "标签": ["production", "critical", "monitored"]
    }
  }' | jq .
EOF
curl -s -X PUT "$BASE_URL/api/v1/hosts/$HOST_ID/custom-fields" \
  -H "$CONTENT_TYPE" \
  -d '{
    "custom_fields": {
      "项目": "CMDB系统",
      "Go版本": "1.26.0"
    }
  }' | jq .

# ========================================
# 5. 拓扑管理 (Topology)
# ========================================
print_separator
echo -e "${BLUE}5. 拓扑管理 API${NC}"
print_separator

print_test "POST /api/v1/topology/businesses/:id/initialize - 初始化业务拓扑"
echo "curl -X POST \"$BASE_URL/api/v1/topology/businesses/$BUSINESS_ID/initialize\" | jq ."
curl -s -X POST "$BASE_URL/api/v1/topology/businesses/$BUSINESS_ID/initialize" | jq .

print_test "POST /api/v1/topology/sets - 创建集群（使用所有参数）"
cat << EOF
curl -X POST "$BASE_URL/api/v1/topology/sets" \\
  -H "Content-Type: application/json" \\
  -d '{
    "business_id": "$BUSINESS_ID",
    "name": "Web服务集群",
    "description": "包含所有Web服务的集群，负责处理前端请求",
    "env_type": "prod",
    "sort_order": 1
  }' | jq .
EOF

SET_ID=$(curl -s -X POST "$BASE_URL/api/v1/topology/sets" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"business_id\": \"$BUSINESS_ID\",
    \"name\": \"Web服务集群\",
    \"description\": \"包含所有Web服务的集群\",
    \"env_type\": \"prod\",
    \"sort_order\": 1
  }" | jq -r '.data.id')

echo "创建的集群ID: $SET_ID"

print_test "GET /api/v1/topology/sets - 查询集群列表"
echo "curl -X GET \"$BASE_URL/api/v1/topology/sets?business_id=$BUSINESS_ID\" | jq ."
curl -s -X GET "$BASE_URL/api/v1/topology/sets?business_id=$BUSINESS_ID" | jq .

print_test "GET /api/v1/topology/sets/:id - 获取集群详情"
echo "curl -X GET \"$BASE_URL/api/v1/topology/sets/$SET_ID\" | jq ."
curl -s -X GET "$BASE_URL/api/v1/topology/sets/$SET_ID" | jq .

print_test "PUT /api/v1/topology/sets/:id - 更新集群"
cat << EOF
curl -X PUT "$BASE_URL/api/v1/topology/sets/$SET_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Web服务集群-已优化",
    "description": "更新后的集群描述，增加了负载均衡和缓存",
    "env_type": "prod",
    "sort_order": 0
  }' | jq .
EOF
curl -s -X PUT "$BASE_URL/api/v1/topology/sets/$SET_ID" \
  -H "$CONTENT_TYPE" \
  -d '{
    "name": "Web服务集群-已优化",
    "description": "更新后的集群描述"
  }' | jq .

print_test "POST /api/v1/topology/modules - 创建模块（使用所有参数）"
cat << EOF
curl -X POST "$BASE_URL/api/v1/topology/modules" \\
  -H "Content-Type: application/json" \\
  -d '{
    "set_id": $SET_ID,
    "name": "Nginx反向代理模块",
    "description": "负责反向代理和负载均衡的Nginx服务模块",
    "service_type": "web",
    "sort_order": 1
  }' | jq .
EOF

MODULE_ID=$(curl -s -X POST "$BASE_URL/api/v1/topology/modules" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"set_id\": $SET_ID,
    \"name\": \"Nginx反向代理模块\",
    \"description\": \"负责反向代理和负载均衡\",
    \"service_type\": \"web\",
    \"sort_order\": 1
  }" | jq -r '.data.id')

echo "创建的模块ID: $MODULE_ID"

print_test "GET /api/v1/topology/modules - 查询模块列表"
echo "curl -X GET \"$BASE_URL/api/v1/topology/modules?set_id=$SET_ID\" | jq ."
curl -s -X GET "$BASE_URL/api/v1/topology/modules?set_id=$SET_ID" | jq .

print_test "GET /api/v1/topology/modules/:id - 获取模块详情"
echo "curl -X GET \"$BASE_URL/api/v1/topology/modules/$MODULE_ID\" | jq ."
curl -s -X GET "$BASE_URL/api/v1/topology/modules/$MODULE_ID" | jq .

print_test "PUT /api/v1/topology/modules/:id - 更新模块"
cat << EOF
curl -X PUT "$BASE_URL/api/v1/topology/modules/$MODULE_ID" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Nginx反向代理模块-高可用版",
    "description": "增加了健康检查和自动故障转移",
    "service_type": "web",
    "sort_order": 0
  }' | jq .
EOF
curl -s -X PUT "$BASE_URL/api/v1/topology/modules/$MODULE_ID" \
  -H "$CONTENT_TYPE" \
  -d '{
    "name": "Nginx反向代理模块-高可用版",
    "description": "增加了健康检查"
  }' | jq .

print_test "PUT /api/v1/hosts/:id/assign - 分配主机到业务"
cat << EOF
curl -X PUT "$BASE_URL/api/v1/hosts/$HOST_ID/assign" \\
  -H "Content-Type: application/json" \\
  -d '{
    "business_id": "$BUSINESS_ID"
  }' | jq .
EOF
curl -s -X PUT "$BASE_URL/api/v1/hosts/$HOST_ID/assign" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"business_id\": \"$BUSINESS_ID\"
  }" | jq .

print_test "GET /api/v1/topology/tree - 获取拓扑树（完整参数）"
cat << EOF
curl -X GET "$BASE_URL/api/v1/topology/tree?business_id=$BUSINESS_ID&include_hosts=true&max_depth=4" | jq .
EOF
curl -s -X GET "$BASE_URL/api/v1/topology/tree?business_id=$BUSINESS_ID&include_hosts=true&max_depth=4" | jq .

print_test "GET /api/v1/topology/statistics - 获取拓扑统计信息"
echo "curl -X GET \"$BASE_URL/api/v1/topology/statistics\" | jq ."
curl -s -X GET "$BASE_URL/api/v1/topology/statistics" | jq .

# ========================================
# 6. 业务集管理 (Business Sets)
# ========================================
print_separator
echo -e "${BLUE}6. 业务集管理 API${NC}"
print_separator

print_test "POST /api/v1/business-sets - 创建业务集"
cat << EOF
curl -X POST "$BASE_URL/api/v1/business-sets" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "核心业务集",
    "identifier": "core-business-set",
    "description": "包含所有核心业务的业务集合",
    "business_id": "$BUSINESS_ID"
  }' | jq .
EOF

BUSINESS_SET_ID=$(curl -s -X POST "$BASE_URL/api/v1/business-sets" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"name\": \"核心业务集\",
    \"identifier\": \"core-business-set\",
    \"description\": \"包含所有核心业务\",
    \"business_id\": \"$BUSINESS_ID\"
  }" | jq -r '.data.id')

echo "创建的业务集ID: $BUSINESS_SET_ID"

print_test "GET /api/v1/business-sets - 查询业务集列表"
echo "curl -X GET \"$BASE_URL/api/v1/business-sets\" | jq ."
curl -s -X GET "$BASE_URL/api/v1/business-sets" | jq .

print_test "GET /api/v1/business-sets/:id - 获取业务集详情"
echo "curl -X GET \"$BASE_URL/api/v1/business-sets/$BUSINESS_SET_ID\" | jq ."
curl -s -X GET "$BASE_URL/api/v1/business-sets/$BUSINESS_SET_ID" | jq .

print_test "POST /api/v1/business-sets/:id/members - 添加业务到业务集"
cat << EOF
curl -X POST "$BASE_URL/api/v1/business-sets/$BUSINESS_SET_ID/members" \\
  -H "Content-Type: application/json" \\
  -d '{
    "business_id": "$BUSINESS_ID"
  }' | jq .
EOF
curl -s -X POST "$BASE_URL/api/v1/business-sets/$BUSINESS_SET_ID/members" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"business_id\": \"$BUSINESS_ID\"
  }" | jq .

print_test "GET /api/v1/business-sets/:id/members - 查询业务集成员"
echo "curl -X GET \"$BASE_URL/api/v1/business-sets/$BUSINESS_SET_ID/members\" | jq ."
curl -s -X GET "$BASE_URL/api/v1/business-sets/$BUSINESS_SET_ID/members" | jq .

# ========================================
# 7. 清理测试数据（可选）
# ========================================
print_separator
echo -e "${BLUE}7. 清理测试数据（DELETE 操作）${NC}"
print_separator

echo -e "${YELLOW}注意：以下是删除操作的命令，执行前请确认${NC}"

print_test "DELETE /api/v1/hosts/:id - 删除主机"
echo "curl -X DELETE \"$BASE_URL/api/v1/hosts/$HOST_ID\" | jq ."
# curl -s -X DELETE "$BASE_URL/api/v1/hosts/$HOST_ID" | jq .

print_test "DELETE /api/v1/topology/modules/:id - 删除模块"
echo "curl -X DELETE \"$BASE_URL/api/v1/topology/modules/$MODULE_ID\" | jq ."
# curl -s -X DELETE "$BASE_URL/api/v1/topology/modules/$MODULE_ID" | jq .

print_test "DELETE /api/v1/topology/sets/:id - 删除集群"
echo "curl -X DELETE \"$BASE_URL/api/v1/topology/sets/$SET_ID\" | jq ."
# curl -s -X DELETE "$BASE_URL/api/v1/topology/sets/$SET_ID" | jq .

print_test "DELETE /api/v1/business-sets/:id/members/:business_id - 从业务集移除业务"
echo "curl -X DELETE \"$BASE_URL/api/v1/business-sets/$BUSINESS_SET_ID/members/$BUSINESS_ID\" | jq ."
# curl -s -X DELETE "$BASE_URL/api/v1/business-sets/$BUSINESS_SET_ID/members/$BUSINESS_ID" | jq .

print_test "DELETE /api/v1/business-sets/:id - 删除业务集"
echo "curl -X DELETE \"$BASE_URL/api/v1/business-sets/$BUSINESS_SET_ID\" | jq ."
# curl -s -X DELETE "$BASE_URL/api/v1/business-sets/$BUSINESS_SET_ID" | jq .

print_test "DELETE /api/v1/businesses/:id - 删除业务（需要先offline）"
echo "# 先将业务设置为offline状态"
echo "curl -X PUT \"$BASE_URL/api/v1/businesses/$BUSINESS_ID\" -H \"Content-Type: application/json\" -d '{\"lifecycle\": \"offline\"}' | jq ."
echo "# 然后删除业务"
echo "curl -X DELETE \"$BASE_URL/api/v1/businesses/$BUSINESS_ID\" | jq ."

print_test "DELETE /api/v1/cloud-areas/:id - 删除云区域"
echo "curl -X DELETE \"$BASE_URL/api/v1/cloud-areas/$CLOUD_AREA_ID\" | jq ."
# curl -s -X DELETE "$BASE_URL/api/v1/cloud-areas/$CLOUD_AREA_ID" | jq .

# ========================================
# 测试完成
# ========================================
print_separator
echo -e "${GREEN}✅ API 测试命令生成完成！${NC}"
print_separator

echo -e "\n${BLUE}创建的资源ID汇总：${NC}"
echo "云区域ID: $CLOUD_AREA_ID"
echo "默认云区域ID: $DEFAULT_CLOUD_AREA_ID"
echo "业务ID: $BUSINESS_ID"
echo "主机ID: $HOST_ID"
echo "集群ID: $SET_ID"
echo "模块ID: $MODULE_ID"
echo "业务集ID: $BUSINESS_SET_ID"

echo -e "\n${YELLOW}提示：${NC}"
echo "1. 所有命令已经执行并展示结果"
echo "2. 删除命令已注释，需要时可以取消注释执行"
echo "3. 可以复制单个命令到终端执行"
echo "4. 建议保存资源ID用于后续测试"
