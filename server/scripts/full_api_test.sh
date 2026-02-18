#!/bin/bash

# WEND CMDB Backend API 完整测试脚本
# 测试所有接口及其字段

# set -e  # 禁用，让测试即使遇到错误也能继续

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 基础配置
BASE_URL="${BASE_URL:-http://localhost:8080}"
TENANT_ID="${TENANT_ID:-ce307a3d-a1a7-4838-ab0b-23182f9851c3}"

# 生成唯一标识
timestamp=$(date +%s)
random_suffix=$((RANDOM % 10000))

# 存储测试过程中创建的ID
BIZ_ID=""
BIZ_SET_ID=""
CLOUD_AREA_ID=""
HOST_ID=""
SET_ID=""
MODULE_ID=""
PROCESS_TEMPLATE_ID=""
PROCESS_ID=""
SERVICE_TEMPLATE_ID=""
SET_TEMPLATE_ID=""
DIRECTORY_ID=""
DYNAMIC_MODEL_UID=""
FIELD_UID=""
INSTANCE_ID=""
RELATION_ID=""
LEGACY_MODEL_NAME=""

# 计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓ PASS]${NC} $1"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

log_error() {
    echo -e "${RED}[✗ FAIL]${NC} $1"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

log_section() {
    echo ""
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}========================================${NC}"
}

# 通用请求函数
# 用法: make_request METHOD PATH BODY [EXTRA_HEADERS]
make_request() {
    local method="$1"
    local path="$2"
    local body="${3:-}"
    local url="${BASE_URL}${path}"
    
    local curl_cmd="curl -s -w \"\\n%{http_code}\" -X ${method} \"${url}\""
    curl_cmd="${curl_cmd} -H \"Content-Type: application/json\""
    curl_cmd="${curl_cmd} -H \"X-Tenant-ID: ${TENANT_ID}\""
    
    if [ -n "$body" ]; then
        curl_cmd="${curl_cmd} -d '${body}'"
    fi
    
    eval "$curl_cmd"
}

# 检查响应状态
# 用法: check_status HTTP_CODE EXPECTED_CODE TEST_NAME

check_status() {
    local actual="$1"
    local expected="$2"
    local test_name="$3"
    
    if [ "$actual" = "$expected" ]; then
        log_success "$test_name (HTTP $actual)"
        return 0
    else
        log_error "$test_name (Expected: $expected, Got: $actual)"
        return 1
    fi
}

# ============================================
# 0. 健康检查
# ============================================
test_health_check() {
    log_section "0. 健康检查"
    
    local response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/health")
    local http_code=$(echo "$response" | tail -n1)
    
    if check_status "$http_code" "200" "GET /health"; then
        local status=$(echo "$response" | sed '$d' | jq -r '.status // empty')
        if [ "$status" = "healthy" ]; then
            log_info "服务状态: $status"
        fi
    fi
}

# ============================================
# 1. 业务管理 API
# ============================================
test_business_api() {
    log_section "1. 业务管理 API"
    
    # 1.1 创建业务 - 完整字段
    log_info "1.1 创建业务 (完整字段)"
    local biz_body=$(cat <<EOF
{
    "name": "测试业务-${timestamp}-${random_suffix}",
    "identifier": "test-biz-${timestamp}-${random_suffix}",
    "description": "这是一个用于API测试的业务",
    "lifecycle": "testing",
    "sres": ["sre1@example.com", "sre2@example.com"],
    "developers": ["dev1@example.com", "dev2@example.com"],
    "testers": ["tester1@example.com"],
    "bizops": ["ops1@example.com"],
    "maintainers": ["admin@example.com"],
    "timezone": "Asia/Shanghai",
    "language": "zh-CN"
}
EOF
)
    
    local response=$(make_request "POST" "/api/v1/businesses" "$biz_body")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if check_status "$http_code" "201" "POST /api/v1/businesses"; then
        BIZ_ID=$(echo "$body" | jq -r '.data.id // empty')
        log_info "创建的业务ID: $BIZ_ID"
    fi
    
    # 1.2 列出业务 - 带分页参数
    log_info "1.2 列出业务 (带分页)"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/businesses?limit=10&offset=0")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/businesses?limit=10&offset=0"
    
    # 1.3 获取单个业务
    if [ -n "$BIZ_ID" ]; then
        log_info "1.3 获取业务详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/businesses/${BIZ_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/businesses/:id"
    fi
    
    # 1.4 更新业务 - 完整字段
    if [ -n "$BIZ_ID" ]; then
        log_info "1.4 更新业务 (完整字段)"
        local update_body=$(cat <<EOF
{
    "name": "测试业务-已更新-${timestamp}",
    "description": "更新后的业务描述",
    "lifecycle": "online",
    "sres": ["new-sre@example.com"],
    "developers": ["new-dev@example.com"],
    "testers": [],
    "bizops": ["new-ops@example.com"]
}
EOF
)
        response=$(make_request "PUT" "/api/v1/businesses/${BIZ_ID}" "$update_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/businesses/:id"
    fi
    
    # 1.5 删除业务 - 需要先改为offline
    if [ -n "$BIZ_ID" ]; then
        log_info "1.5 先将业务改为offline"
        local offline_body='{"lifecycle": "offline"}'
        response=$(make_request "PUT" "/api/v1/businesses/${BIZ_ID}" "$offline_body")
        http_code=$(echo "$response" | tail -n1)
        
        log_info "1.6 删除业务"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/businesses/${BIZ_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/businesses/:id"
    fi
}

# ============================================
# 2. 业务集管理 API
# ============================================
test_business_set_api() {
    log_section "2. 业务集管理 API"
    
    # 需要先创建一个新的业务作为成员
    log_info "2.0 创建测试业务"
    local test_biz_body=$(cat <<EOF
{
    "name": "业务集测试业务-${timestamp}",
    "identifier": "bizset-test-${timestamp}",
    "description": "用于业务集测试",
    "lifecycle": "testing"
}
EOF
)
    local response=$(make_request "POST" "/api/v1/businesses" "$test_biz_body")
    local test_biz_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
    
    # 2.1 创建业务集 - 完整字段
    log_info "2.1 创建业务集 (完整字段)"
    local bizset_body=$(cat <<EOF
{
    "name": "测试业务集-${timestamp}-${random_suffix}",
    "identifier": "test-bizset-${timestamp}-${random_suffix}",
    "description": "这是一个业务集",
    "business_id": "${test_biz_id}",
    "scope": "global",
    "type": "standard"
}
EOF
)
    
    response=$(make_request "POST" "/api/v1/business-sets" "$bizset_body")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if check_status "$http_code" "201" "POST /api/v1/business-sets"; then
        BIZ_SET_ID=$(echo "$body" | jq -r '.data.id // empty')
        log_info "创建的业务集ID: $BIZ_SET_ID"
    fi
    
    # 2.2 列出业务集
    log_info "2.2 列出业务集"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/business-sets")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/business-sets"
    
    # 2.3 获取业务集详情
    if [ -n "$BIZ_SET_ID" ]; then
        log_info "2.3 获取业务集详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/business-sets/${BIZ_SET_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/business-sets/:id"
    fi
    
    # 2.4 更新业务集
    if [ -n "$BIZ_SET_ID" ]; then
        log_info "2.4 更新业务集"
        local update_body=$(cat <<EOF
{
    "name": "测试业务集-已更新-${timestamp}",
    "description": "更新后的描述"
}
EOF
)
        response=$(make_request "PUT" "/api/v1/business-sets/${BIZ_SET_ID}" "$update_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/business-sets/:id"
    fi
    
    # 2.5 添加成员
    if [ -n "$BIZ_SET_ID" ] && [ -n "$test_biz_id" ]; then
        log_info "2.5 添加成员到业务集"
        local member_body=$(cat <<EOF
{
    "business_id": "${test_biz_id}"
}
EOF
)
        response=$(make_request "POST" "/api/v1/business-sets/${BIZ_SET_ID}/members" "$member_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "201" "POST /api/v1/business-sets/:id/members"
    fi
    
    # 2.6 列出成员
    if [ -n "$BIZ_SET_ID" ]; then
        log_info "2.6 列出业务集成员"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/business-sets/${BIZ_SET_ID}/members")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/business-sets/:id/members"
    fi
    
    # 2.7 移除成员
    if [ -n "$BIZ_SET_ID" ] && [ -n "$test_biz_id" ]; then
        log_info "2.7 移除业务集成员"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/business-sets/${BIZ_SET_ID}/members/${test_biz_id}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/business-sets/:id/members/:business_id"
    fi
    
    # 2.8 删除业务集
    if [ -n "$BIZ_SET_ID" ]; then
        log_info "2.8 删除业务集"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/business-sets/${BIZ_SET_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/business-sets/:id"
    fi
}

# ============================================
# 3. 云区域管理 API
# ============================================
test_cloud_area_api() {
    log_section "3. 云区域管理 API"
    
    # 3.1 创建云区域 - 完整字段
    log_info "3.1 创建云区域 (完整字段)"
    local cloud_body=$(cat <<EOF
{
    "name": "测试云区域-${timestamp}-${random_suffix}",
    "identifier": "test-cloud-${timestamp}-${random_suffix}",
    "type": "private",
    "description": "私有云测试区域",
    "region": "ap-beijing",
    "provider": "tencent",
    "status": "active",
    "config": {
        "vpc_id": "vpc-test123",
        "network_segment": "10.0.0.0/16"
    }
}
EOF
)
    
    local response=$(make_request "POST" "/api/v1/cloud-areas" "$cloud_body")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if check_status "$http_code" "201" "POST /api/v1/cloud-areas"; then
        CLOUD_AREA_ID=$(echo "$body" | jq -r '.data.id // empty')
        log_info "创建的云区域ID: $CLOUD_AREA_ID"
    fi
    
    # 3.2 列出云区域
    log_info "3.2 列出云区域"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/cloud-areas")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/cloud-areas"
    
    # 3.3 获取默认云区域
    log_info "3.3 获取默认云区域"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/cloud-areas/default")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/cloud-areas/default"
    
    # 3.4 获取单个云区域
    if [ -n "$CLOUD_AREA_ID" ]; then
        log_info "3.4 获取云区域详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/cloud-areas/${CLOUD_AREA_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/cloud-areas/:id"
    fi
    
    # 3.5 更新云区域
    if [ -n "$CLOUD_AREA_ID" ]; then
        log_info "3.5 更新云区域"
        local update_body=$(cat <<EOF
{
    "name": "测试云区域-已更新-${timestamp}",
    "description": "更新后的描述",
    "status": "inactive",
    "config": {
        "vpc_id": "vpc-updated456",
        "network_segment": "172.16.0.0/16"
    }
}
EOF
)
        response=$(make_request "PUT" "/api/v1/cloud-areas/${CLOUD_AREA_ID}" "$update_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/cloud-areas/:id"
    fi
    
    # 3.6 删除云区域
    if [ -n "$CLOUD_AREA_ID" ]; then
        log_info "3.6 删除云区域"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/cloud-areas/${CLOUD_AREA_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/cloud-areas/:id"
    fi
}

# ============================================
# 4. 主机管理 API
# ============================================
test_host_api() {
    log_section "4. 主机管理 API"
    
    # 4.1 创建主机 - 完整字段
    log_info "4.1 创建主机 (完整字段)"
    local host_body=$(cat <<EOF
{
    "host_name": "test-server-${timestamp}-${random_suffix}",
    "primary_ip": "192.168.100.${random_suffix}",
    "inner_ip": "10.0.0.${random_suffix}",
    "outer_ip": "203.0.113.${random_suffix}",
    "os_type": "linux",
    "os_name": "CentOS 7.9",
    "cpu": 8,
    "memory": 16384,
    "disk": 500,
    "cloud_area_id": "00000000-0000-0000-0000-000000000000",
    "asset_id": "ASSET-${timestamp}",
    "sn": "SN${timestamp}${random_suffix}",
    "status": "idle",
    "custom_fields": {
        "rack": "A-01-02",
        "switch": "sw-core-01",
        "environment": "test"
    }
}
EOF
)
    
    local response=$(make_request "POST" "/api/v1/hosts" "$host_body")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if check_status "$http_code" "201" "POST /api/v1/hosts"; then
        HOST_ID=$(echo "$body" | jq -r '.data.id // empty')
        log_info "创建的主机ID: $HOST_ID"
    fi
    
    # 4.2 批量导入主机
    log_info "4.2 批量导入主机"
    local batch_body=$(cat <<EOF
{
    "use_default_cloud_area": true,
    "hosts": [
        {
            "host_name": "batch-host-1-${timestamp}",
            "primary_ip": "192.168.101.1",
            "cpu": 4,
            "memory": 8192,
            "os_type": "linux"
        },
        {
            "host_name": "batch-host-2-${timestamp}",
            "primary_ip": "192.168.101.2",
            "cpu": 8,
            "memory": 16384,
            "os_type": "windows"
        }
    ]
}
EOF
)
    response=$(make_request "POST" "/api/v1/hosts/batch" "$batch_body")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "201" "POST /api/v1/hosts/batch"
    
    # 4.3 列出主机 - 带多种查询参数
    log_info "4.3 列出主机 (带查询参数)"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/hosts?limit=20&offset=0&status=idle&in_pool=true")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/hosts (with filters)"
    
    # 4.4 获取单个主机
    if [ -n "$HOST_ID" ]; then
        log_info "4.4 获取主机详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/hosts/${HOST_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/hosts/:id"
    fi
    
    # 4.5 更新主机
    if [ -n "$HOST_ID" ]; then
        log_info "4.5 更新主机"
        local update_body=$(cat <<EOF
{
    "host_name": "test-server-updated-${timestamp}",
    "cpu": 16,
    "memory": 32768,
    "status": "busy",
    "custom_fields": {
        "rack": "B-02-03",
        "environment": "production"
    }
}
EOF
)
        response=$(make_request "PUT" "/api/v1/hosts/${HOST_ID}" "$update_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/hosts/:id"
    fi
    
    # 4.6 更新主机自定义字段
    if [ -n "$HOST_ID" ]; then
        log_info "4.6 更新主机自定义字段"
        local custom_body=$(cat <<EOF
{
    "custom_fields": {
        "department": "IT",
        "owner": "admin",
        "project": "cmdb-test"
    }
}
EOF
)
        response=$(make_request "PUT" "/api/v1/hosts/${HOST_ID}/custom-fields" "$custom_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/hosts/:id/custom-fields"
    fi
    
    # 4.7 分配主机到业务 - 需要先创建业务
    if [ -n "$HOST_ID" ]; then
        log_info "4.7 创建临时业务用于分配测试"
        local temp_biz_body=$(cat <<EOF
{
    "name": "临时业务-${timestamp}",
    "identifier": "temp-biz-${timestamp}",
    "lifecycle": "testing"
}
EOF
)
        response=$(make_request "POST" "/api/v1/businesses" "$temp_biz_body")
        local temp_biz_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
        
        if [ -n "$temp_biz_id" ]; then
            log_info "4.8 分配主机到业务"
            local assign_body=$(cat <<EOF
{
    "business_id": "${temp_biz_id}"
}
EOF
)
            response=$(make_request "PUT" "/api/v1/hosts/${HOST_ID}/assign" "$assign_body")
            http_code=$(echo "$response" | tail -n1)
            check_status "$http_code" "200" "PUT /api/v1/hosts/:id/assign"
            
            log_info "4.9 回收主机到资源池"
            response=$(make_request "PUT" "/api/v1/hosts/${HOST_ID}/reclaim" '{}')
            http_code=$(echo "$response" | tail -n1)
            check_status "$http_code" "200" "PUT /api/v1/hosts/:id/reclaim"
            
            # 清理临时业务
            local offline_body='{"lifecycle": "offline"}'
            make_request "PUT" "/api/v1/businesses/${temp_biz_id}" "$offline_body" > /dev/null 2>&1
            curl -s -X DELETE "${BASE_URL}/api/v1/businesses/${temp_biz_id}" > /dev/null 2>&1
        fi
    fi
    
    # 4.10 删除主机
    if [ -n "$HOST_ID" ]; then
        log_info "4.10 删除主机"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/hosts/${HOST_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/hosts/:id"
    fi
}

# ============================================
# 5. 业务拓扑 API
# ============================================
test_topology_api() {
    log_section "5. 业务拓扑 API"
    
    # 先创建测试业务
    log_info "5.0 创建测试业务"
    local test_biz_body=$(cat <<EOF
{
    "name": "拓扑测试业务-${timestamp}",
    "identifier": "topology-test-${timestamp}",
    "lifecycle": "testing"
}
EOF
)
    local response=$(make_request "POST" "/api/v1/businesses" "$test_biz_body")
    local test_biz_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
    
    if [ -z "$test_biz_id" ]; then
        log_error "无法创建测试业务，跳过拓扑测试"
        return
    fi
    
    # 5.1 获取拓扑树
    log_info "5.1 获取拓扑树"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/topology/tree?business_id=${test_biz_id}&max_depth=3")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/topology/tree"
    
    # 5.2 获取节点子节点
    log_info "5.2 获取节点子节点"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/topology/nodes/business/${test_biz_id}/children")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/topology/nodes/:type/:id/children"
    
    # 5.3 获取拓扑统计
    log_info "5.3 获取拓扑统计"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/topology/statistics")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/topology/statistics"
    
    # 5.4 初始化业务拓扑
    log_info "5.4 初始化业务拓扑"
    response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/topology/businesses/${test_biz_id}/initialize")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "POST /api/v1/topology/businesses/:id/initialize"
    
    # 5.5 创建集群 - 完整字段
    log_info "5.5 创建集群 (完整字段)"
    local set_body=$(cat <<EOF
{
    "business_id": "${test_biz_id}",
    "name": "测试集群-${timestamp}",
    "description": "这是一个测试集群",
    "env_type": "test",
    "set_type": "普通",
    "capacity": 100
}
EOF
)
    response=$(make_request "POST" "/api/v1/topology/sets" "$set_body")
    http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if check_status "$http_code" "201" "POST /api/v1/topology/sets"; then
        SET_ID=$(echo "$body" | jq -r '.data.id // empty')
        log_info "创建的集群ID: $SET_ID"
    fi
    
    # 5.6 列出集群
    if [ -n "$test_biz_id" ]; then
        log_info "5.6 列出集群"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/topology/sets?business_id=${test_biz_id}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/topology/sets?business_id=:id"
    fi
    
    # 5.7 获取集群详情
    if [ -n "$SET_ID" ]; then
        log_info "5.7 获取集群详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/topology/sets/${SET_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/topology/sets/:id"
    fi
    
    # 5.8 更新集群
    if [ -n "$SET_ID" ]; then
        log_info "5.8 更新集群"
        local update_body=$(cat <<EOF
{
    "name": "测试集群-已更新-${timestamp}",
    "description": "更新后的集群描述",
    "env_type": "production"
}
EOF
)
        response=$(make_request "PUT" "/api/v1/topology/sets/${SET_ID}" "$update_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/topology/sets/:id"
    fi
    
    # 5.9 创建模块 - 完整字段
    if [ -n "$SET_ID" ]; then
        log_info "5.9 创建模块 (完整字段)"
        local module_body=$(cat <<EOF
{
    "set_id": "${SET_ID}",
    "name": "测试模块-${timestamp}",
    "description": "这是一个测试模块",
    "service_type": "web",
    "operator": "admin",
    "bak_operator": "backup-admin"
}
EOF
)
        response=$(make_request "POST" "/api/v1/topology/modules" "$module_body")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        if check_status "$http_code" "201" "POST /api/v1/topology/modules"; then
            MODULE_ID=$(echo "$body" | jq -r '.data.id // empty')
            log_info "创建的模块ID: $MODULE_ID"
        fi
    fi
    
    # 5.10 列出模块
    if [ -n "$SET_ID" ]; then
        log_info "5.10 列出模块"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/topology/modules?set_id=${SET_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/topology/modules?set_id=:id"
    fi
    
    # 5.11 获取模块详情
    if [ -n "$MODULE_ID" ]; then
        log_info "5.11 获取模块详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/topology/modules/${MODULE_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/topology/modules/:id"
    fi
    
    # 5.12 更新模块
    if [ -n "$MODULE_ID" ]; then
        log_info "5.12 更新模块"
        local update_body=$(cat <<EOF
{
    "name": "测试模块-已更新-${timestamp}",
    "description": "更新后的模块描述",
    "service_type": "api"
}
EOF
)
        response=$(make_request "PUT" "/api/v1/topology/modules/${MODULE_ID}" "$update_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/topology/modules/:id"
    fi
    
    # 5.13 获取模块下的主机
    if [ -n "$MODULE_ID" ]; then
        log_info "5.13 获取模块下的主机"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/topology/modules/${MODULE_ID}/hosts")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/topology/modules/:id/hosts"
    fi
    
    # 5.14 移动模块到另一个集群
    # 先创建另一个集群
    if [ -n "$test_biz_id" ]; then
        log_info "5.14 创建目标集群用于移动测试"
        local target_set_body=$(cat <<EOF
{
    "business_id": "${test_biz_id}",
    "name": "目标集群-${timestamp}",
    "description": "用于移动测试",
    "env_type": "test"
}
EOF
)
        response=$(make_request "POST" "/api/v1/topology/sets" "$target_set_body")
        local target_set_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
        
        if [ -n "$target_set_id" ] && [ -n "$MODULE_ID" ]; then
            log_info "5.15 移动模块到目标集群"
            local move_body=$(cat <<EOF
{
    "target_set_id": "${target_set_id}"
}
EOF
)
            response=$(make_request "POST" "/api/v1/topology/modules/${MODULE_ID}/move" "$move_body")
            http_code=$(echo "$response" | tail -n1)
            check_status "$http_code" "200" "POST /api/v1/topology/modules/:id/move"
            
            # 清理目标集群
            curl -s -X DELETE "${BASE_URL}/api/v1/topology/sets/${target_set_id}" > /dev/null 2>&1
        fi
    fi
    
    # 5.16 删除模块
    if [ -n "$MODULE_ID" ]; then
        log_info "5.16 删除模块"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/topology/modules/${MODULE_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/topology/modules/:id"
    fi
    
    # 5.17 移动集群
    # 创建另一个业务用于移动测试
    log_info "5.17 创建目标业务用于集群移动"
    local target_biz_body=$(cat <<EOF
{
    "name": "目标业务-${timestamp}",
    "identifier": "target-biz-${timestamp}",
    "lifecycle": "testing"
}
EOF
)
    response=$(make_request "POST" "/api/v1/businesses" "$target_biz_body")
    local target_biz_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
    
    if [ -n "$target_biz_id" ] && [ -n "$SET_ID" ]; then
        log_info "5.18 移动集群到目标业务"
        local move_body=$(cat <<EOF
{
    "target_business_id": "${target_biz_id}"
}
EOF
)
        response=$(make_request "POST" "/api/v1/topology/sets/${SET_ID}/move" "$move_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "POST /api/v1/topology/sets/:id/move"
        
        # 清理目标业务
        local offline_body='{"lifecycle": "offline"}'
        make_request "PUT" "/api/v1/businesses/${target_biz_id}" "$offline_body" > /dev/null 2>&1
        curl -s -X DELETE "${BASE_URL}/api/v1/businesses/${target_biz_id}" > /dev/null 2>&1
    fi
    
    # 5.19 删除集群
    if [ -n "$SET_ID" ]; then
        log_info "5.19 删除集群"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/topology/sets/${SET_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/topology/sets/:id"
    fi
    
    # 清理测试业务
    if [ -n "$test_biz_id" ]; then
        local offline_body='{"lifecycle": "offline"}'
        make_request "PUT" "/api/v1/businesses/${test_biz_id}" "$offline_body" > /dev/null 2>&1
        curl -s -X DELETE "${BASE_URL}/api/v1/businesses/${test_biz_id}" > /dev/null 2>&1
    fi
}

# ============================================
# 6. 进程模板 API
# ============================================
test_process_template_api() {
    log_section "6. 进程模板 API"
    
    # 6.1 创建进程模板 - 完整字段
    log_info "6.1 创建进程模板 (完整字段)"
    local template_body=$(cat <<EOF
{
    "name": "nginx-template-${timestamp}",
    "process_name": "nginx",
    "description": "Nginx进程模板",
    "work_path": "/usr/local/nginx",
    "start_cmd": "./sbin/nginx",
    "stop_cmd": "./sbin/nginx -s stop",
    "restart_cmd": "./sbin/nginx -s reload",
    "reload_cmd": "./sbin/nginx -s reload",
    "kill_cmd": "kill -9 {{pid}}",
    "pid_file": "/var/run/nginx.pid",
    "user": "nginx",
    "timeout": 30,
    "priority": 100,
    "startup_type": "automatic",
    "func_id": "web-server",
    "func_name": "Web服务器",
    "memo": "Nginx Web服务器进程",
    "protocol": "tcp",
    "auto_time_gap": 60,
    "bk_start_check_secs": 5,
    "is_enable": true,
    "face_stop_check": true,
    "bk_func_id": "nginx",
    "bk_func_name": "Nginx",
    "bk_process_name": "nginx-master"
}
EOF
)
    
    local response=$(make_request "POST" "/api/v1/process-templates" "$template_body")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if check_status "$http_code" "201" "POST /api/v1/process-templates"; then
        PROCESS_TEMPLATE_ID=$(echo "$body" | jq -r '.data.id // empty')
        log_info "创建的进程模板ID: $PROCESS_TEMPLATE_ID"
    fi
    
    # 6.2 列出进程模板
    log_info "6.2 列出进程模板"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/process-templates?limit=20&offset=0")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/process-templates"
    
    # 6.3 获取进程模板详情
    if [ -n "$PROCESS_TEMPLATE_ID" ]; then
        log_info "6.3 获取进程模板详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/process-templates/${PROCESS_TEMPLATE_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/process-templates/:id"
    fi
    
    # 6.4 更新进程模板
    if [ -n "$PROCESS_TEMPLATE_ID" ]; then
        log_info "6.4 更新进程模板"
        local update_body=$(cat <<EOF
{
    "name": "nginx-template-updated-${timestamp}",
    "description": "更新后的描述",
    "timeout": 60,
    "is_enable": false
}
EOF
)
        response=$(make_request "PUT" "/api/v1/process-templates/${PROCESS_TEMPLATE_ID}" "$update_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/process-templates/:id"
    fi
    
    # 6.5 删除进程模板
    if [ -n "$PROCESS_TEMPLATE_ID" ]; then
        log_info "6.5 删除进程模板"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/process-templates/${PROCESS_TEMPLATE_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/process-templates/:id"
    fi
}

# ============================================
# 7. 进程管理 API
# ============================================
test_process_api() {
    log_section "7. 进程管理 API"
    
    # 需要先创建主机和模块
    log_info "7.0 创建测试主机"
    local host_body=$(cat <<EOF
{
    "host_name": "process-test-host-${timestamp}",
    "primary_ip": "192.168.200.${random_suffix}",
    "cloud_area_id": "00000000-0000-0000-0000-000000000000"
}
EOF
)
    local response=$(make_request "POST" "/api/v1/hosts" "$host_body")
    local test_host_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
    
    # 7.1 创建进程 - 完整字段
    if [ -n "$test_host_id" ]; then
        log_info "7.1 创建进程 (完整字段)"
        local process_body=$(cat <<EOF
{
    "host_id": "${test_host_id}",
    "process_name": "test-process-${timestamp}",
    "func_name": "测试功能",
    "func_id": "test-func",
    "work_path": "/opt/test",
    "start_cmd": "./start.sh",
    "stop_cmd": "./stop.sh",
    "restart_cmd": "./restart.sh",
    "reload_cmd": "./reload.sh",
    "kill_cmd": "kill -9",
    "pid_file": "/var/run/test.pid",
    "user": "testuser",
    "timeout": 30,
    "priority": 50,
    "startup_type": "manual",
    "status": "stopped",
    "protocol": "tcp",
    "bind_info": [
        {
            "ip": "0.0.0.0",
            "port": "8080",
            "protocol": "tcp",
            "enable": true
        }
    ],
    "is_enable": true,
    "auto_time_gap": 60,
    "bk_start_check_secs": 5,
    "face_stop_check": true,
    "bk_func_id": "test",
    "bk_func_name": "Test",
    "bk_process_name": "test-process",
    "memo": "测试进程"
}
EOF
)
        response=$(make_request "POST" "/api/v1/processes" "$process_body")
        local http_code=$(echo "$response" | tail -n1)
        local body=$(echo "$response" | sed '$d')
        
        if check_status "$http_code" "201" "POST /api/v1/processes"; then
            PROCESS_ID=$(echo "$body" | jq -r '.data.id // empty')
            log_info "创建的进程ID: $PROCESS_ID"
        fi
    fi
    
    # 7.2 列出进程
    if [ -n "$test_host_id" ]; then
        log_info "7.2 列出进程"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/processes?host_id=${test_host_id}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/processes?host_id=:id"
    fi
    
    # 7.3 批量创建进程
    if [ -n "$test_host_id" ]; then
        log_info "7.3 批量创建进程"
        local batch_body=$(cat <<EOF
{
    "processes": [
        {
            "host_id": "${test_host_id}",
            "process_name": "batch-process-1-${timestamp}",
            "work_path": "/opt/app1",
            "start_cmd": "./start.sh",
            "status": "running"
        },
        {
            "host_id": "${test_host_id}",
            "process_name": "batch-process-2-${timestamp}",
            "work_path": "/opt/app2",
            "start_cmd": "./start.sh",
            "status": "stopped"
        }
    ]
}
EOF
)
        response=$(make_request "POST" "/api/v1/processes/batch" "$batch_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "201" "POST /api/v1/processes/batch"
    fi
    
    # 7.4 获取进程详情
    if [ -n "$PROCESS_ID" ]; then
        log_info "7.4 获取进程详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/processes/${PROCESS_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/processes/:id"
    fi
    
    # 7.5 更新进程
    if [ -n "$PROCESS_ID" ]; then
        log_info "7.5 更新进程"
        local update_body=$(cat <<EOF
{
    "process_name": "test-process-updated-${timestamp}",
    "status": "running",
    "priority": 100,
    "memo": "更新后的备注"
}
EOF
)
        response=$(make_request "PUT" "/api/v1/processes/${PROCESS_ID}" "$update_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/processes/:id"
    fi
    
    # 7.6 更新进程状态
    if [ -n "$PROCESS_ID" ]; then
        log_info "7.6 更新进程状态"
        local status_body=$(cat <<EOF
{
    "status": "stopped"
}
EOF
)
        response=$(make_request "POST" "/api/v1/processes/${PROCESS_ID}/status" "$status_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "POST /api/v1/processes/:id/status"
    fi
    
    # 7.7 获取主机进程列表
    if [ -n "$test_host_id" ]; then
        log_info "7.7 获取主机进程列表"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/hosts/${test_host_id}/processes")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/hosts/:id/processes"
    fi
    
    # 7.8 获取模块进程摘要 - 需要创建模块
    log_info "7.8 创建测试模块用于进程摘要"
    local test_biz_body=$(cat <<EOF
{
    "name": "进程测试业务-${timestamp}",
    "identifier": "process-biz-${timestamp}",
    "lifecycle": "testing"
}
EOF
)
    response=$(make_request "POST" "/api/v1/businesses" "$test_biz_body")
    local test_biz_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
    
    if [ -n "$test_biz_id" ]; then
        # 初始化业务拓扑
        curl -s -X POST "${BASE_URL}/api/v1/topology/businesses/${test_biz_id}/initialize" > /dev/null 2>&1
        
        # 创建集群
        local set_body=$(cat <<EOF
{
    "business_id": "${test_biz_id}",
    "name": "进程测试集群-${timestamp}",
    "env_type": "test"
}
EOF
)
        response=$(make_request "POST" "/api/v1/topology/sets" "$set_body")
        local test_set_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
        
        if [ -n "$test_set_id" ]; then
            # 创建模块
            local module_body=$(cat <<EOF
{
    "set_id": "${test_set_id}",
    "name": "进程测试模块-${timestamp}",
    "service_type": "web"
}
EOF
)
            response=$(make_request "POST" "/api/v1/topology/modules" "$module_body")
            local test_module_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
            
            if [ -n "$test_module_id" ]; then
                log_info "7.9 获取模块进程摘要"
                response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/modules/${test_module_id}/process-summary")
                http_code=$(echo "$response" | tail -n1)
                check_status "$http_code" "200" "GET /api/v1/modules/:id/process-summary"
                
                # 清理模块
                curl -s -X DELETE "${BASE_URL}/api/v1/topology/modules/${test_module_id}" > /dev/null 2>&1
            fi
            
            # 清理集群
            curl -s -X DELETE "${BASE_URL}/api/v1/topology/sets/${test_set_id}" > /dev/null 2>&1
        fi
        
        # 清理业务
        local offline_body='{"lifecycle": "offline"}'
        make_request "PUT" "/api/v1/businesses/${test_biz_id}" "$offline_body" > /dev/null 2>&1
        curl -s -X DELETE "${BASE_URL}/api/v1/businesses/${test_biz_id}" > /dev/null 2>&1
    fi
    
    # 7.10 删除进程
    if [ -n "$PROCESS_ID" ]; then
        log_info "7.10 删除进程"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/processes/${PROCESS_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/processes/:id"
    fi
    
    # 清理测试主机
    if [ -n "$test_host_id" ]; then
        curl -s -X DELETE "${BASE_URL}/api/v1/hosts/${test_host_id}" > /dev/null 2>&1
    fi
}

# ============================================
# 8. 服务模板 API
# ============================================
test_service_template_api() {
    log_section "8. 服务模板 API"
    
    # 需要先创建业务
    log_info "8.0 创建测试业务"
    local test_biz_body=$(cat <<EOF
{
    "name": "服务模板测试业务-${timestamp}",
    "identifier": "svc-tpl-biz-${timestamp}",
    "lifecycle": "testing"
}
EOF
)
    local response=$(make_request "POST" "/api/v1/businesses" "$test_biz_body")
    local test_biz_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
    
    if [ -z "$test_biz_id" ]; then
        log_error "无法创建测试业务，跳过服务模板测试"
        return
    fi
    
    # 8.1 创建服务模板 - 完整字段
    log_info "8.1 创建服务模板 (完整字段)"
    local template_body=$(cat <<EOF
{
    "name": "web-service-template-${timestamp}",
    "business_id": "${test_biz_id}",
    "description": "Web服务模板",
    "service_category": "web",
    "service_type": "http",
    "config": {
        "port": 80,
        "protocol": "http"
    }
}
EOF
)
    
    response=$(make_request "POST" "/api/v1/service-templates" "$template_body")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if check_status "$http_code" "201" "POST /api/v1/service-templates"; then
        SERVICE_TEMPLATE_ID=$(echo "$body" | jq -r '.data.id // empty')
        log_info "创建的服务模板ID: $SERVICE_TEMPLATE_ID"
    fi
    
    # 8.2 列出服务模板
    if [ -n "$test_biz_id" ]; then
        log_info "8.2 列出服务模板"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/service-templates?business_id=${test_biz_id}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/service-templates?business_id=:id"
    fi
    
    # 8.3 获取服务模板详情
    if [ -n "$SERVICE_TEMPLATE_ID" ]; then
        log_info "8.3 获取服务模板详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/service-templates/${SERVICE_TEMPLATE_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/service-templates/:id"
    fi
    
    # 8.4 更新服务模板
    if [ -n "$SERVICE_TEMPLATE_ID" ]; then
        log_info "8.4 更新服务模板"
        local update_body=$(cat <<EOF
{
    "name": "web-service-template-updated-${timestamp}",
    "description": "更新后的描述"
}
EOF
)
        response=$(make_request "PUT" "/api/v1/service-templates/${SERVICE_TEMPLATE_ID}" "$update_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/service-templates/:id"
    fi
    
    # 8.5 添加进程模板
    if [ -n "$SERVICE_TEMPLATE_ID" ]; then
        log_info "8.5 创建并添加进程模板到服务模板"
        # 先创建进程模板
        local pt_body=$(cat <<EOF
{
    "name": "nginx-svc-template-${timestamp}",
    "process_name": "nginx",
    "description": "Nginx服务进程模板"
}
EOF
)
        response=$(make_request "POST" "/api/v1/process-templates" "$pt_body")
        local pt_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
        
        if [ -n "$pt_id" ]; then
            local add_body=$(cat <<EOF
{
    "process_template_id": "${pt_id}"
}
EOF
)
            response=$(make_request "POST" "/api/v1/service-templates/${SERVICE_TEMPLATE_ID}/process-templates" "$add_body")
            http_code=$(echo "$response" | tail -n1)
            check_status "$http_code" "201" "POST /api/v1/service-templates/:id/process-templates"
            
            # 8.6 移除进程模板
            log_info "8.6 移除进程模板"
            response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/service-templates/${SERVICE_TEMPLATE_ID}/process-templates/${pt_id}")
            http_code=$(echo "$response" | tail -n1)
            check_status "$http_code" "200" "DELETE /api/v1/service-templates/:id/process-templates/:ptid"
            
            # 清理进程模板
            curl -s -X DELETE "${BASE_URL}/api/v1/process-templates/${pt_id}" > /dev/null 2>&1
        fi
    fi
    
    # 8.7 从模板创建模块
    if [ -n "$SERVICE_TEMPLATE_ID" ] && [ -n "$test_biz_id" ]; then
        log_info "8.7 初始化业务拓扑并创建模块"
        curl -s -X POST "${BASE_URL}/api/v1/topology/businesses/${test_biz_id}/initialize" > /dev/null 2>&1
        
        # 创建集群
        local set_body=$(cat <<EOF
{
    "business_id": "${test_biz_id}",
    "name": "模板测试集群-${timestamp}",
    "env_type": "test"
}
EOF
)
        response=$(make_request "POST" "/api/v1/topology/sets" "$set_body")
        local test_set_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
        
        if [ -n "$test_set_id" ]; then
            local module_body=$(cat <<EOF
{
    "set_id": "${test_set_id}",
    "module_name": "模板创建模块-${timestamp}"
}
EOF
)
            response=$(make_request "POST" "/api/v1/service-templates/${SERVICE_TEMPLATE_ID}/create-module" "$module_body")
            http_code=$(echo "$response" | tail -n1)
            check_status "$http_code" "201" "POST /api/v1/service-templates/:id/create-module"
            
            # 8.8 同步模块
            log_info "8.8 同步模块"
            response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/service-templates/${SERVICE_TEMPLATE_ID}/sync")
            http_code=$(echo "$response" | tail -n1)
            check_status "$http_code" "200" "POST /api/v1/service-templates/:id/sync"
            
            # 清理集群
            curl -s -X DELETE "${BASE_URL}/api/v1/topology/sets/${test_set_id}" > /dev/null 2>&1
        fi
    fi
    
    # 8.9 删除服务模板
    if [ -n "$SERVICE_TEMPLATE_ID" ]; then
        log_info "8.9 删除服务模板"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/service-templates/${SERVICE_TEMPLATE_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/service-templates/:id"
    fi
    
    # 清理测试业务
    if [ -n "$test_biz_id" ]; then
        local offline_body='{"lifecycle": "offline"}'
        make_request "PUT" "/api/v1/businesses/${test_biz_id}" "$offline_body" > /dev/null 2>&1
        curl -s -X DELETE "${BASE_URL}/api/v1/businesses/${test_biz_id}" > /dev/null 2>&1
    fi
}

# ============================================
# 9. 集群模板 API
# ============================================
test_set_template_api() {
    log_section "9. 集群模板 API"
    
    # 需要先创建业务
    log_info "9.0 创建测试业务"
    local test_biz_body=$(cat <<EOF
{
    "name": "集群模板测试业务-${timestamp}",
    "identifier": "set-tpl-biz-${timestamp}",
    "lifecycle": "testing"
}
EOF
)
    local response=$(make_request "POST" "/api/v1/businesses" "$test_biz_body")
    local test_biz_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
    
    if [ -z "$test_biz_id" ]; then
        log_error "无法创建测试业务，跳过集群模板测试"
        return
    fi
    
    # 9.1 创建集群模板 - 完整字段
    log_info "9.1 创建集群模板 (完整字段)"
    local template_body=$(cat <<EOF
{
    "name": "test-set-template-${timestamp}",
    "business_id": "${test_biz_id}",
    "description": "测试集群模板",
    "set_type": "普通",
    "env_type": "test",
    "capacity": 50
}
EOF
)
    
    response=$(make_request "POST" "/api/v1/set-templates" "$template_body")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if check_status "$http_code" "201" "POST /api/v1/set-templates"; then
        SET_TEMPLATE_ID=$(echo "$body" | jq -r '.data.id // empty')
        log_info "创建的集群模板ID: $SET_TEMPLATE_ID"
    fi
    
    # 9.2 列出集群模板
    if [ -n "$test_biz_id" ]; then
        log_info "9.2 列出集群模板"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/set-templates?business_id=${test_biz_id}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/set-templates?business_id=:id"
    fi
    
    # 9.3 获取集群模板详情
    if [ -n "$SET_TEMPLATE_ID" ]; then
        log_info "9.3 获取集群模板详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/set-templates/${SET_TEMPLATE_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/set-templates/:id"
    fi
    
    # 9.4 从模板创建集群
    if [ -n "$SET_TEMPLATE_ID" ] && [ -n "$test_biz_id" ]; then
        log_info "9.4 从模板创建集群"
        local create_body=$(cat <<EOF
{
    "business_id": "${test_biz_id}",
    "name": "模板创建集群-${timestamp}",
    "description": "从模板创建的集群"
}
EOF
)
        response=$(make_request "POST" "/api/v1/set-templates/${SET_TEMPLATE_ID}/create-set" "$create_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "201" "POST /api/v1/set-templates/:id/create-set"
    fi
    
    # 9.5 删除集群模板
    if [ -n "$SET_TEMPLATE_ID" ]; then
        log_info "9.5 删除集群模板"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/set-templates/${SET_TEMPLATE_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/set-templates/:id"
    fi
    
    # 清理测试业务
    if [ -n "$test_biz_id" ]; then
        local offline_body='{"lifecycle": "offline"}'
        make_request "PUT" "/api/v1/businesses/${test_biz_id}" "$offline_body" > /dev/null 2>&1
        curl -s -X DELETE "${BASE_URL}/api/v1/businesses/${test_biz_id}" > /dev/null 2>&1
    fi
}

# ============================================
# 10. 资源池 API
# ============================================
test_resource_pool_api() {
    log_section "10. 资源池 API"
    
    # 10.1 创建资源目录 - 完整字段
    log_info "10.1 创建资源目录 (完整字段)"
    local dir_body=$(cat <<EOF
{
    "name": "测试目录-${timestamp}",
    "description": "这是一个测试目录",
    "parent_id": null,
    "order": 1,
    "tags": ["test", "demo"]
}
EOF
)
    
    local response=$(make_request "POST" "/api/v1/resource-pool/directories" "$dir_body")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if check_status "$http_code" "201" "POST /api/v1/resource-pool/directories"; then
        DIRECTORY_ID=$(echo "$body" | jq -r '.data.id // empty')
        log_info "创建的目录ID: $DIRECTORY_ID"
    fi
    
    # 10.2 列出资源目录
    log_info "10.2 列出资源目录"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/resource-pool/directories")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/resource-pool/directories"
    
    # 10.3 获取目录树
    log_info "10.3 获取目录树"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/resource-pool/directories/tree")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/resource-pool/directories/tree"
    
    # 10.4 获取目录详情
    if [ -n "$DIRECTORY_ID" ]; then
        log_info "10.4 获取目录详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/resource-pool/directories/${DIRECTORY_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/resource-pool/directories/:id"
    fi
    
    # 10.5 更新目录
    if [ -n "$DIRECTORY_ID" ]; then
        log_info "10.5 更新目录"
        local update_body=$(cat <<EOF
{
    "name": "测试目录-已更新-${timestamp}",
    "description": "更新后的描述"
}
EOF
)
        response=$(make_request "PUT" "/api/v1/resource-pool/directories/${DIRECTORY_ID}" "$update_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/resource-pool/directories/:id"
    fi
    
    # 10.6 移动目录
    # 先创建子目录
    if [ -n "$DIRECTORY_ID" ]; then
        log_info "10.6 创建子目录用于移动测试"
        local child_body=$(cat <<EOF
{
    "name": "子目录-${timestamp}",
    "parent_id": "${DIRECTORY_ID}",
    "description": "子目录"
}
EOF
)
        response=$(make_request "POST" "/api/v1/resource-pool/directories" "$child_body")
        local child_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
        
        if [ -n "$child_id" ]; then
            log_info "10.7 移动目录"
            local move_body=$(cat <<EOF
{
    "target_parent_id": null
}
EOF
)
            response=$(make_request "POST" "/api/v1/resource-pool/directories/${child_id}/move" "$move_body")
            http_code=$(echo "$response" | tail -n1)
            check_status "$http_code" "200" "POST /api/v1/resource-pool/directories/:id/move"
            
            # 清理子目录
            curl -s -X DELETE "${BASE_URL}/api/v1/resource-pool/directories/${child_id}" > /dev/null 2>&1
        fi
    fi
    
    # 10.8 列出资源池主机
    log_info "10.8 列出资源池主机"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/resource-pool/hosts?directory_id=${DIRECTORY_ID}&page=1&page_size=20")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/resource-pool/hosts"
    
    # 10.9 导入主机到资源池 - 需要先创建主机
    log_info "10.9 创建测试主机用于导入"
    local host_body=$(cat <<EOF
{
    "host_name": "pool-test-host-${timestamp}",
    "primary_ip": "192.168.250.${random_suffix}",
    "cloud_area_id": "00000000-0000-0000-0000-000000000000"
}
EOF
)
    response=$(make_request "POST" "/api/v1/hosts" "$host_body")
    local pool_host_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
    
    if [ -n "$pool_host_id" ] && [ -n "$DIRECTORY_ID" ]; then
        log_info "10.10 导入主机到资源池"
        local import_body=$(cat <<EOF
{
    "directory_id": "${DIRECTORY_ID}",
    "host_ids": ["${pool_host_id}"]
}
EOF
)
        response=$(make_request "POST" "/api/v1/resource-pool/hosts/import" "$import_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "POST /api/v1/resource-pool/hosts/import"
        
        # 10.11 移动主机在资源池内
        log_info "10.11 移动主机"
        # 创建另一个目录
        local dir2_body=$(cat <<EOF
{
    "name": "目标目录-${timestamp}",
    "description": "目标目录"
}
EOF
)
        response=$(make_request "POST" "/api/v1/resource-pool/directories" "$dir2_body")
        local dir2_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
        
        if [ -n "$dir2_id" ]; then
            local move_body=$(cat <<EOF
{
    "host_ids": ["${pool_host_id}"],
    "target_directory_id": "${dir2_id}"
}
EOF
)
            response=$(make_request "POST" "/api/v1/resource-pool/hosts/move" "$move_body")
            http_code=$(echo "$response" | tail -n1)
            check_status "$http_code" "200" "POST /api/v1/resource-pool/hosts/move"
            
            # 清理目标目录
            curl -s -X DELETE "${BASE_URL}/api/v1/resource-pool/directories/${dir2_id}" > /dev/null 2>&1
        fi
        
        # 10.12 分配主机
        log_info "10.12 创建测试业务用于分配"
        local test_biz_body=$(cat <<EOF
{
    "name": "分配测试业务-${timestamp}",
    "identifier": "allocate-biz-${timestamp}",
    "lifecycle": "testing"
}
EOF
)
        response=$(make_request "POST" "/api/v1/businesses" "$test_biz_body")
        local test_biz_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
        
        if [ -n "$test_biz_id" ]; then
            log_info "10.13 分配主机到业务"
            local allocate_body=$(cat <<EOF
{
    "host_ids": ["${pool_host_id}"],
    "business_id": "${test_biz_id}"
}
EOF
)
            response=$(make_request "POST" "/api/v1/resource-pool/hosts/allocate" "$allocate_body")
            http_code=$(echo "$response" | tail -n1)
            check_status "$http_code" "200" "POST /api/v1/resource-pool/hosts/allocate"
            
            # 10.13 回收主机
            log_info "10.14 回收主机"
            local reclaim_body=$(cat <<EOF
{
    "host_ids": ["${pool_host_id}"]
}
EOF
)
            response=$(make_request "POST" "/api/v1/resource-pool/hosts/reclaim" "$reclaim_body")
            http_code=$(echo "$response" | tail -n1)
            check_status "$http_code" "200" "POST /api/v1/resource-pool/hosts/reclaim"
            
            # 清理业务
            local offline_body='{"lifecycle": "offline"}'
            make_request "PUT" "/api/v1/businesses/${test_biz_id}" "$offline_body" > /dev/null 2>&1
            curl -s -X DELETE "${BASE_URL}/api/v1/businesses/${test_biz_id}" > /dev/null 2>&1
        fi
        
        # 清理测试主机
        curl -s -X DELETE "${BASE_URL}/api/v1/hosts/${pool_host_id}" > /dev/null 2>&1
    fi
    
    # 10.14 获取资源池统计
    log_info "10.15 获取资源池统计"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/resource-pool/statistics")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/resource-pool/statistics"
    
    # 10.15 删除目录
    if [ -n "$DIRECTORY_ID" ]; then
        log_info "10.16 删除目录"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/resource-pool/directories/${DIRECTORY_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/resource-pool/directories/:id"
    fi
}

# ============================================
# 11. 动态模型 API (新)
# ============================================
test_dynamic_model_api() {
    log_section "11. 动态模型 API (新)"
    
    # 11.1 创建动态模型 - 完整字段
    log_info "11.1 创建动态模型 (完整字段)"
    local model_body=$(cat <<EOF
{
    "uid": "test_model_${timestamp}_${random_suffix}",
    "name": "测试模型-${timestamp}",
    "description": "这是一个用于API测试的动态模型",
    "icon": "server",
    "classification": "resource",
    "is_enabled": true,
    "is_builtin": false,
    "version": "1.0.0",
    "tags": ["test", "demo"],
    "config": {
        "enable_history": true,
        "enable_relation": true
    }
}
EOF
)
    
    local response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/dynamic-models" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: ${TENANT_ID}" \
        -d "$model_body")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if check_status "$http_code" "201" "POST /api/v1/dynamic-models"; then
        DYNAMIC_MODEL_UID=$(echo "$body" | jq -r '.data.uid // empty')
        log_info "创建的模型UID: $DYNAMIC_MODEL_UID"
    fi
    
    # 11.2 列出所有模型
    log_info "11.2 列出所有模型"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/dynamic-models" \
        -H "X-Tenant-ID: ${TENANT_ID}")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/dynamic-models"
    
    # 11.3 获取模型详情
    if [ -n "$DYNAMIC_MODEL_UID" ]; then
        log_info "11.3 获取模型详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}" \
            -H "X-Tenant-ID: ${TENANT_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/dynamic-models/:uid"
    fi
    
    # 11.4 更新模型
    if [ -n "$DYNAMIC_MODEL_UID" ]; then
        log_info "11.4 更新模型"
        local update_body=$(cat <<EOF
{
    "name": "测试模型-已更新-${timestamp}",
    "description": "更新后的描述",
    "version": "1.1.0",
    "is_enabled": false
}
EOF
)
        response=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: ${TENANT_ID}" \
            -d "$update_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/dynamic-models/:uid"
    fi
    
    # 11.5 创建属性 - 完整字段
    if [ -n "$DYNAMIC_MODEL_UID" ]; then
        log_info "11.5 创建属性 (完整字段)"
        local attr_body=$(cat <<EOF
{
    "field_uid": "ip_address_${timestamp}",
    "field_name": "IP地址",
    "field_type": "string",
    "category": "config",
    "is_required": true,
    "is_unique": true,
    "is_editable": true,
    "is_list_display": true,
    "is_searchable": true,
    "sort_order": 1,
    "default_value": "",
    "placeholder": "请输入IP地址",
    "description": "主机的IP地址",
    "validation": {
        "regex": "^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$",
        "error_message": "请输入有效的IP地址"
    }
}
EOF
)
        response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/attributes" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: ${TENANT_ID}" \
            -d "$attr_body")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        if check_status "$http_code" "201" "POST /api/v1/dynamic-models/:uid/attributes"; then
            FIELD_UID=$(echo "$body" | jq -r '.data.field_uid // empty')
            log_info "创建的属性UID: $FIELD_UID"
        fi
    fi
    
    # 11.6 列出属性
    if [ -n "$DYNAMIC_MODEL_UID" ]; then
        log_info "11.6 列出属性"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/attributes" \
            -H "X-Tenant-ID: ${TENANT_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/dynamic-models/:uid/attributes"
    fi
    
    # 11.7 更新属性
    if [ -n "$DYNAMIC_MODEL_UID" ] && [ -n "$FIELD_UID" ]; then
        log_info "11.7 更新属性"
        local update_attr_body=$(cat <<EOF
{
    "field_name": "IP地址-已更新",
    "is_required": false,
    "description": "更新后的描述"
}
EOF
)
        response=$(curl -s -w "\n%{http_code}" -X PUT "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/attributes/${FIELD_UID}" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: ${TENANT_ID}" \
            -d "$update_attr_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "PUT /api/v1/dynamic-models/:uid/attributes/:field_uid"
    fi
    
    # 11.8 删除属性
    if [ -n "$DYNAMIC_MODEL_UID" ] && [ -n "$FIELD_UID" ]; then
        log_info "11.8 删除属性"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/attributes/${FIELD_UID}" \
            -H "X-Tenant-ID: ${TENANT_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/dynamic-models/:uid/attributes/:field_uid"
    fi
    
    # 11.9 创建实例 - 需要先重新创建属性
    if [ -n "$DYNAMIC_MODEL_UID" ]; then
        log_info "11.9 重新创建属性用于实例测试"
        local new_attr_body=$(cat <<EOF
{
    "field_uid": "test_field_${timestamp}",
    "field_name": "测试字段",
    "field_type": "string",
    "is_required": false
}
EOF
)
        response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/attributes" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: ${TENANT_ID}" \
            -d "$new_attr_body")
        
        log_info "11.10 创建实例 (完整字段)"
        local instance_body=$(cat <<EOF
{
    "properties": {
        "test_field_${timestamp}": "测试值-${timestamp}"
    },
    "business_id": null,
    "tags": ["test", "instance"],
    "description": "测试实例"
}
EOF
)
        response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/instances" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: ${TENANT_ID}" \
            -d "$instance_body")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
        
        if check_status "$http_code" "201" "POST /api/v1/dynamic-models/:uid/instances"; then
            INSTANCE_ID=$(echo "$body" | jq -r '.data.id // empty')
            log_info "创建的实例ID: $INSTANCE_ID"
        fi
    fi
    
    # 11.11 列出实例
    if [ -n "$DYNAMIC_MODEL_UID" ]; then
        log_info "11.11 列出实例"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/instances?page=1&page_size=20" \
            -H "X-Tenant-ID: ${TENANT_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/dynamic-models/:uid/instances"
    fi
    
    # 11.12 获取实例详情
    if [ -n "$DYNAMIC_MODEL_UID" ] && [ -n "$INSTANCE_ID" ]; then
        log_info "11.12 获取实例详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/instances/${INSTANCE_ID}" \
            -H "X-Tenant-ID: ${TENANT_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/dynamic-models/:uid/instances/:id"
    fi
    
    # 11.13 获取实例关联关系
    if [ -n "$DYNAMIC_MODEL_UID" ] && [ -n "$INSTANCE_ID" ]; then
        log_info "11.13 获取实例关联关系"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/instances/${INSTANCE_ID}/relations" \
            -H "X-Tenant-ID: ${TENANT_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/dynamic-models/:uid/instances/:id/relations"
    fi
    
    # 11.14 获取实例拓扑关系
    if [ -n "$DYNAMIC_MODEL_UID" ] && [ -n "$INSTANCE_ID" ]; then
        log_info "11.14 获取实例拓扑关系"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/instances/${INSTANCE_ID}/topology" \
            -H "X-Tenant-ID: ${TENANT_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/dynamic-models/:uid/instances/:id/topology"
    fi
    
    # 11.15 获取实例变更历史
    if [ -n "$DYNAMIC_MODEL_UID" ] && [ -n "$INSTANCE_ID" ]; then
        log_info "11.15 获取实例变更历史"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/instances/${INSTANCE_ID}/history" \
            -H "X-Tenant-ID: ${TENANT_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/dynamic-models/:uid/instances/:id/history"
    fi
    
    # 11.16 删除实例
    if [ -n "$DYNAMIC_MODEL_UID" ] && [ -n "$INSTANCE_ID" ]; then
        log_info "11.16 删除实例"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/instances/${INSTANCE_ID}" \
            -H "X-Tenant-ID: ${TENANT_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/dynamic-models/:uid/instances/:id"
    fi
    
    # 11.17 创建关联关系 - 需要创建第二个实例
    if [ -n "$DYNAMIC_MODEL_UID" ]; then
        log_info "11.17 创建第二个实例用于关联测试"
        local instance2_body=$(cat <<EOF
{
    "properties": {
        "test_field_${timestamp}": "测试值-2-${timestamp}"
    }
}
EOF
)
        response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/instances" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: ${TENANT_ID}" \
            -d "$instance2_body")
        local instance2_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
        
        # 重新创建第一个实例
        local instance1_body=$(cat <<EOF
{
    "properties": {
        "test_field_${timestamp}": "测试值-1-${timestamp}"
    }
}
EOF
)
        response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/instances" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: ${TENANT_ID}" \
            -d "$instance1_body")
        local instance1_id=$(echo "$response" | sed '$d' | jq -r '.data.id // empty')
        
        if [ -n "$instance1_id" ] && [ -n "$instance2_id" ]; then
            log_info "11.18 创建关联关系"
            local relation_body=$(cat <<EOF
{
    "source_instance_id": "${instance1_id}",
    "target_instance_id": "${instance2_id}",
    "relation_type": "depends_on",
    "description": "测试关联关系"
}
EOF
)
            response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/dynamic-models/relations" \
                -H "Content-Type: application/json" \
                -H "X-Tenant-ID: ${TENANT_ID}" \
                -d "$relation_body")
            http_code=$(echo "$response" | tail -n1)
            body=$(echo "$response" | sed '$d')
            
            if check_status "$http_code" "201" "POST /api/v1/dynamic-models/relations"; then
                RELATION_ID=$(echo "$body" | jq -r '.data.id // empty')
                log_info "创建的关联ID: $RELATION_ID"
                
                # 11.19 删除关联关系
                log_info "11.19 删除关联关系"
                response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/dynamic-models/relations/${RELATION_ID}" \
                    -H "X-Tenant-ID: ${TENANT_ID}")
                http_code=$(echo "$response" | tail -n1)
                check_status "$http_code" "200" "DELETE /api/v1/dynamic-models/relations/:id"
            fi
            
            # 清理实例
            curl -s -X DELETE "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/instances/${instance1_id}" \
                -H "X-Tenant-ID: ${TENANT_ID}" > /dev/null 2>&1
            curl -s -X DELETE "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}/instances/${instance2_id}" \
                -H "X-Tenant-ID: ${TENANT_ID}" > /dev/null 2>&1
        fi
    fi
    
    # 11.20 删除动态模型
    if [ -n "$DYNAMIC_MODEL_UID" ]; then
        log_info "11.20 删除动态模型"
        response=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/api/v1/dynamic-models/${DYNAMIC_MODEL_UID}" \
            -H "X-Tenant-ID: ${TENANT_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "DELETE /api/v1/dynamic-models/:uid"
    fi
}

# ============================================
# 12. 导入导出 API
# ============================================
test_import_export_api() {
    log_section "12. 导入导出 API"
    
    # 需要先创建动态模型
    log_info "12.0 创建测试模型"
    local model_body=$(cat <<EOF
{
    "uid": "import_export_model_${timestamp}",
    "name": "导入导出测试模型",
    "description": "用于测试导入导出功能"
}
EOF
)
    local response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/dynamic-models" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: ${TENANT_ID}" \
        -d "$model_body")
    local test_model_uid=$(echo "$response" | sed '$d' | jq -r '.data.uid // empty')
    
    if [ -z "$test_model_uid" ]; then
        log_error "无法创建测试模型，跳过导入导出测试"
        return
    fi
    
    # 添加属性
    local attr_body=$(cat <<EOF
{
    "field_uid": "name",
    "field_name": "名称",
    "field_type": "string",
    "is_required": true
}
EOF
)
    curl -s -X POST "${BASE_URL}/api/v1/dynamic-models/${test_model_uid}/attributes" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: ${TENANT_ID}" \
        -d "$attr_body" > /dev/null 2>&1
    
    # 12.1 下载导入模板
    log_info "12.1 下载导入模板"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/dynamic-models/${test_model_uid}/template" \
        -H "X-Tenant-ID: ${TENANT_ID}" \
        -o "/tmp/test_template_${timestamp}.xlsx")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/dynamic-models/:uid/template"
    
    # 12.2 获取模板信息
    log_info "12.2 获取模板信息"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/dynamic-models/${test_model_uid}/template-info" \
        -H "X-Tenant-ID: ${TENANT_ID}")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/dynamic-models/:uid/template-info"
    
    # 12.3 验证模板 - 需要有文件
    log_info "12.3 验证模板"
    if [ -f "/tmp/test_template_${timestamp}.xlsx" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/dynamic-models/${test_model_uid}/validate-template" \
            -H "X-Tenant-ID: ${TENANT_ID}" \
            -F "file=@/tmp/test_template_${timestamp}.xlsx")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "POST /api/v1/dynamic-models/:uid/validate-template"
    else
        log_info "跳过验证模板：模板文件不存在"
    fi
    
    # 12.4 导出数据
    log_info "12.4 导出数据"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/dynamic-models/${test_model_uid}/export" \
        -H "X-Tenant-ID: ${TENANT_ID}" \
        -o "/tmp/test_export_${timestamp}.xlsx")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/dynamic-models/:uid/export"
    
    # 12.5 下载导入指南
    log_info "12.5 下载导入指南"
    response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/dynamic-models/${test_model_uid}/import-guide" \
        -H "X-Tenant-ID: ${TENANT_ID}" \
        -o "/tmp/test_import_guide_${timestamp}.xlsx")
    http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/dynamic-models/:uid/import-guide"
    
    # 清理测试模型
    curl -s -X DELETE "${BASE_URL}/api/v1/dynamic-models/${test_model_uid}" \
        -H "X-Tenant-ID: ${TENANT_ID}" > /dev/null 2>&1
    
    # 清理临时文件
    rm -f "/tmp/test_template_${timestamp}.xlsx" "/tmp/test_export_${timestamp}.xlsx" "/tmp/test_import_guide_${timestamp}.xlsx"
}

# ============================================
# 13. 兼容动态模型 API (旧)
# ============================================
test_legacy_model_api() {
    log_section "13. 兼容动态模型 API (旧)"
    
    # 13.1 列出模型
    log_info "13.1 列出模型"
    local response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/models")
    local http_code=$(echo "$response" | tail -n1)
    check_status "$http_code" "200" "GET /api/v1/models"
    
    # 13.2 创建模型
    log_info "13.2 创建模型"
    local model_body=$(cat <<EOF
{
    "name": "legacy_test_model_${timestamp}",
    "display_name": "兼容测试模型-${timestamp}",
    "classification": "resource",
    "icon": "server",
    "description": "用于测试兼容API"
}
EOF
)
    response=$(make_request "POST" "/api/v1/models" "$model_body")
    http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if check_status "$http_code" "201" "POST /api/v1/models"; then
        LEGACY_MODEL_NAME=$(echo "$body" | jq -r '.name // empty')
        log_info "创建的模型名称: $LEGACY_MODEL_NAME"
    fi
    
    # 13.3 获取模型详情
    if [ -n "$LEGACY_MODEL_NAME" ]; then
        log_info "13.3 获取模型详情"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/models/${LEGACY_MODEL_NAME}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/models/:name"
    fi
    
    # 13.4 创建属性
    if [ -n "$LEGACY_MODEL_NAME" ]; then
        log_info "13.4 创建属性"
        local attr_body=$(cat <<EOF
{
    "name": "legacy_hostname",
    "display_name": "主机名",
    "field_type": "string",
    "is_required": true,
    "is_unique": true,
    "sort_order": 1
}
EOF
)
        response=$(make_request "POST" "/api/v1/models/${LEGACY_MODEL_NAME}/attributes" "$attr_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "201" "POST /api/v1/models/:name/attributes"
    fi
    
    # 13.5 创建实例
    if [ -n "$LEGACY_MODEL_NAME" ]; then
        log_info "13.5 创建实例"
        local instance_body=$(cat <<EOF
{
    "properties": {
        "legacy_hostname": "legacy-host-${timestamp}"
    },
    "business_id": null
}
EOF
)
        response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/models/${LEGACY_MODEL_NAME}/instances" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: ${TENANT_ID}" \
            -d "$instance_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "201" "POST /api/v1/models/:name/instances"
    fi
    
    # 13.6 批量创建实例
    if [ -n "$LEGACY_MODEL_NAME" ]; then
        log_info "13.6 批量创建实例"
        local batch_body=$(cat <<EOF
{
    "instances": [
        {
            "properties": {
                "legacy_hostname": "legacy-batch-1-${timestamp}"
            }
        },
        {
            "properties": {
                "legacy_hostname": "legacy-batch-2-${timestamp}"
            }
        }
    ]
}
EOF
)
        response=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/v1/models/${LEGACY_MODEL_NAME}/instances/batch" \
            -H "Content-Type: application/json" \
            -H "X-Tenant-ID: ${TENANT_ID}" \
            -d "$batch_body")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "201" "POST /api/v1/models/:name/instances/batch"
    fi
    
    # 13.7 列出实例
    if [ -n "$LEGACY_MODEL_NAME" ]; then
        log_info "13.7 列出实例"
        response=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/v1/models/${LEGACY_MODEL_NAME}/instances?page=1&page_size=20" \
            -H "X-Tenant-ID: ${TENANT_ID}")
        http_code=$(echo "$response" | tail -n1)
        check_status "$http_code" "200" "GET /api/v1/models/:name/instances"
    fi
}

# ============================================
# 主函数
# ============================================
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║     WEND CMDB Backend - 完整 API 测试套件                    ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    echo "测试配置:"
    echo "  Base URL: $BASE_URL"
    echo "  Tenant ID: $TENANT_ID"
    echo "  Timestamp: $timestamp"
    echo ""
    
    # 检查依赖
    if ! command -v jq &> /dev/null; then
        echo "错误: 未找到 jq 命令，请先安装"
        echo "macOS: brew install jq"
        echo "Ubuntu/Debian: sudo apt-get install jq"
        exit 1
    fi
    
    # 检查服务是否可用
    echo "检查服务状态..."
    if ! curl -s "${BASE_URL}/health" > /dev/null 2>&1; then
        echo "错误: 无法连接到服务 ${BASE_URL}"
        echo "请确保服务已启动"
        exit 1
    fi
    echo "服务正常"
    echo ""
    
    # 运行所有测试
    test_health_check
    test_business_api
    test_business_set_api
    test_cloud_area_api
    test_host_api
    test_topology_api
    test_process_template_api
    test_process_api
    test_service_template_api
    test_set_template_api
    test_resource_pool_api
    test_dynamic_model_api
    test_import_export_api
    test_legacy_model_api
    
    # 测试结果汇总
    echo ""
    echo "════════════════════════════════════════════════════════════"
    echo "                     测试结果汇总"
    echo "════════════════════════════════════════════════════════════"
    echo -e "总测试数: $TOTAL_TESTS"
    echo -e "${GREEN}通过: $PASSED_TESTS${NC}"
    echo -e "${RED}失败: $FAILED_TESTS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}✓ 所有测试通过!${NC}"
        exit 0
    else
        echo -e "${RED}✗ 有 $FAILED_TESTS 个测试失败${NC}"
        exit 1
    fi
}

# 运行主函数
main
