#!/bin/bash

# CMDB API 测试脚本
# 使用方法: ./scripts/api_test.sh [base_url]
# 默认: http://localhost:8080

BASE_URL="${1:-http://localhost:8080}"
API_V1="$BASE_URL/api/v1"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试计数
PASSED=0
FAILED=0

# 辅助函数
log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAILED++))
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

# 检查 HTTP 响应
check_response() {
    local response="$1"
    local expected_code="$2"
    local test_name="$3"

    http_code=$(echo "$response" | tail -1)
    body=$(echo "$response" | head -n -1)

    if [ "$http_code" == "$expected_code" ]; then
        log_pass "$test_name (HTTP $http_code)"
        echo "$body" | jq -r '.data // .message // .' 2>/dev/null | head -5
    else
        log_fail "$test_name (Expected: $expected_code, Got: $http_code)"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    fi
    echo ""
}

echo "========================================"
echo "   CMDB Backend API 测试"
echo "   Base URL: $BASE_URL"
echo "========================================"
echo ""

# ========================================
# 1. 健康检查
# ========================================
log_info "=== 1. 健康检查 ==="

log_test "GET /health"
response=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
check_response "$response" "200" "健康检查"

# ========================================
# 2. 业务管理 API
# ========================================
log_info "=== 2. 业务管理 API ==="

# 创建业务
log_test "POST /api/v1/businesses - 创建业务"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_V1/businesses" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "测试业务-API测试",
        "description": "API自动化测试创建的业务",
        "maintainers": ["admin", "test"]
    }')
check_response "$response" "201" "创建业务"

# 提取业务ID
BUSINESS_ID=$(echo "$response" | head -n -1 | jq -r '.data.id // empty')
if [ -n "$BUSINESS_ID" ]; then
    log_info "创建的业务ID: $BUSINESS_ID"
else
    log_info "使用模拟业务ID进行后续测试"
    BUSINESS_ID="00000000-0000-0000-0000-000000000001"
fi

# 获取业务列表
log_test "GET /api/v1/businesses - 获取业务列表"
response=$(curl -s -w "\n%{http_code}" "$API_V1/businesses")
check_response "$response" "200" "获取业务列表"

# 获取单个业务
log_test "GET /api/v1/businesses/:id - 获取业务详情"
response=$(curl -s -w "\n%{http_code}" "$API_V1/businesses/$BUSINESS_ID")
check_response "$response" "200" "获取业务详情"

# 更新业务
log_test "PUT /api/v1/businesses/:id - 更新业务"
response=$(curl -s -w "\n%{http_code}" -X PUT "$API_V1/businesses/$BUSINESS_ID" \
    -H "Content-Type: application/json" \
    -d '{
        "description": "更新后的描述"
    }')
check_response "$response" "200" "更新业务"

# ========================================
# 3. 动态模型 API
# ========================================
log_info "=== 3. 动态模型 API ==="

# 创建模型
log_test "POST /api/v1/dynamic-models - 创建模型"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_V1/dynamic-models" \
    -H "Content-Type: application/json" \
    -d '{
        "uid": "test_server",
        "name": "测试服务器",
        "description": "API测试创建的服务器模型",
        "icon": "server"
    }')
check_response "$response" "201" "创建模型"

# 获取模型列表
log_test "GET /api/v1/dynamic-models - 获取模型列表"
response=$(curl -s -w "\n%{http_code}" "$API_V1/dynamic-models")
check_response "$response" "200" "获取模型列表"

# 获取单个模型
log_test "GET /api/v1/dynamic-models/:uid - 获取模型详情"
response=$(curl -s -w "\n%{http_code}" "$API_V1/dynamic-models/test_server")
check_response "$response" "200" "获取模型详情"

# 创建属性
log_test "POST /api/v1/dynamic-models/:uid/attributes - 创建属性"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_V1/dynamic-models/test_server/attributes" \
    -H "Content-Type: application/json" \
    -d '{
        "field_uid": "server_ip",
        "field_name": "服务器IP",
        "field_type": "string",
        "category": "config",
        "is_required": true
    }')
check_response "$response" "201" "创建属性"

# 获取属性列表
log_test "GET /api/v1/dynamic-models/:uid/attributes - 获取属性列表"
response=$(curl -s -w "\n%{http_code}" "$API_V1/dynamic-models/test_server/attributes")
check_response "$response" "200" "获取属性列表"

# ========================================
# 4. 资源实例 API
# ========================================
log_info "=== 4. 资源实例 API ==="

# 创建资源实例
log_test "POST /api/v1/dynamic-models/:uid/instances - 创建资源实例"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_V1/dynamic-models/test_server/instances" \
    -H "Content-Type: application/json" \
    -d '{
        "name": "测试服务器-01",
        "data": {
            "server_ip": "192.168.1.100"
        }
    }')
check_response "$response" "201" "创建资源实例"

# 提取资源ID
RESOURCE_ID=$(echo "$response" | head -n -1 | jq -r '.data.id // empty')
if [ -n "$RESOURCE_ID" ]; then
    log_info "创建的资源ID: $RESOURCE_ID"
fi

# 获取资源列表
log_test "GET /api/v1/dynamic-models/:uid/instances - 获取资源列表"
response=$(curl -s -w "\n%{http_code}" "$API_V1/dynamic-models/test_server/instances?page=1&page_size=10")
check_response "$response" "200" "获取资源列表"

# ========================================
# 5. 业务拓扑 API
# ========================================
log_info "=== 5. 业务拓扑 API ==="

# 创建集群
log_test "POST /api/v1/topology/sets - 创建集群"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_V1/topology/sets" \
    -H "Content-Type: application/json" \
    -d "{
        \"business_id\": \"$BUSINESS_ID\",
        \"name\": \"测试集群\",
        \"description\": \"API测试创建的集群\",
        \"env_type\": \"test\"
    }")
check_response "$response" "201" "创建集群"

# 提取集群ID
SET_ID=$(echo "$response" | head -n -1 | jq -r '.data.id // empty')
if [ -n "$SET_ID" ]; then
    log_info "创建的集群ID: $SET_ID"
else
    SET_ID="1"
fi

# 获取集群列表
log_test "GET /api/v1/topology/sets?business_id=:id - 获取集群列表"
response=$(curl -s -w "\n%{http_code}" "$API_V1/topology/sets?business_id=$BUSINESS_ID")
check_response "$response" "200" "获取集群列表"

# 创建模块
log_test "POST /api/v1/topology/modules - 创建模块"
response=$(curl -s -w "\n%{http_code}" -X POST "$API_V1/topology/modules" \
    -H "Content-Type: application/json" \
    -d "{
        \"set_id\": $SET_ID,
        \"name\": \"Web模块\",
        \"description\": \"Web服务模块\",
        \"service_type\": \"web\"
    }")
check_response "$response" "201" "创建模块"

# 提取模块ID
MODULE_ID=$(echo "$response" | head -n -1 | jq -r '.data.id // empty')
if [ -n "$MODULE_ID" ]; then
    log_info "创建的模块ID: $MODULE_ID"
fi

# 获取模块列表
log_test "GET /api/v1/topology/modules?set_id=:id - 获取模块列表"
response=$(curl -s -w "\n%{http_code}" "$API_V1/topology/modules?set_id=$SET_ID")
check_response "$response" "200" "获取模块列表"

# 获取拓扑树
log_test "GET /api/v1/topology/tree - 获取拓扑树"
response=$(curl -s -w "\n%{http_code}" "$API_V1/topology/tree?business_id=$BUSINESS_ID&max_depth=3")
check_response "$response" "200" "获取拓扑树"

# 获取拓扑统计
log_test "GET /api/v1/topology/statistics - 获取拓扑统计"
response=$(curl -s -w "\n%{http_code}" "$API_V1/topology/statistics")
check_response "$response" "200" "获取拓扑统计"

# ========================================
# 6. 导入导出 API
# ========================================
log_info "=== 6. 导入导出 API ==="

# 下载导入模板
log_test "GET /api/v1/dynamic-models/:uid/template - 下载导入模板"
response=$(curl -s -w "\n%{http_code}" -o /tmp/test_template.xlsx "$API_V1/dynamic-models/test_server/template")
if [ -f /tmp/test_template.xlsx ]; then
    log_pass "下载导入模板"
    log_info "模板已保存到: /tmp/test_template.xlsx"
else
    log_fail "下载导入模板"
fi
echo ""

# 获取模板信息
log_test "GET /api/v1/dynamic-models/:uid/template-info - 获取模板信息"
response=$(curl -s -w "\n%{http_code}" "$API_V1/dynamic-models/test_server/template-info")
check_response "$response" "200" "获取模板信息"

# ========================================
# 7. 清理测试数据（可选）
# ========================================
log_info "=== 7. 清理测试数据 ==="

# 删除模型
log_test "DELETE /api/v1/dynamic-models/:uid - 删除模型"
response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_V1/dynamic-models/test_server")
check_response "$response" "200" "删除模型"

# 删除业务（如果创建成功）
if [ "$BUSINESS_ID" != "00000000-0000-0000-0000-000000000001" ]; then
    log_test "DELETE /api/v1/businesses/:id - 删除业务"
    response=$(curl -s -w "\n%{http_code}" -X DELETE "$API_V1/businesses/$BUSINESS_ID")
    check_response "$response" "200" "删除业务"
fi

# ========================================
# 测试结果汇总
# ========================================
echo ""
echo "========================================"
echo "   测试结果汇总"
echo "========================================"
echo -e "通过: ${GREEN}$PASSED${NC}"
echo -e "失败: ${RED}$FAILED${NC}"
echo "总计: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}所有测试通过!${NC}"
    exit 0
else
    echo -e "${RED}有 $FAILED 个测试失败${NC}"
    exit 1
fi
