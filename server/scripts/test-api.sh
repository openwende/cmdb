#!/bin/bash

# WEND CMDB Backend API 自动化测试脚本
# 验证所有API端点是否正常工作

set -e  # 遇到错误立即退出

BASE_URL="${BASE_URL:-http://localhost:8080}"
TENANT_ID="ce307a3d-a1a7-4838-ab0b-23182f9851c3"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 存储创建的资源ID
BUSINESS_ID=""
BUSINESS_SET_ID=""
MODEL_ID=""
INSTANCE_ID=""

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
    ((PASSED_TESTS++))
    ((TOTAL_TESTS++))
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((FAILED_TESTS++))
    ((TOTAL_TESTS++))
}

log_section() {
    echo ""
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${YELLOW}========================================${NC}"
}

# 测试健康检查
test_health_check() {
    log_section "测试健康检查"

    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/health")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        status=$(echo "$body" | jq -r '.status')
        if [ "$status" = "healthy" ]; then
            log_success "健康检查通过"
        else
            log_error "健康检查失败: status=$status"
        fi
    else
        log_error "健康检查请求失败: HTTP $http_code"
    fi
}

# 测试创建业务
test_create_business() {
    log_section "测试业务管理API"

    log_info "创建业务..."
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/businesses" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "自动化测试业务",
            "identifier": "auto-test-business-'$(date +%s)'",
            "description": "API自动化测试创建的业务",
            "lifecycle": "testing",
            "sres": ["alice@test.com"],
            "developers": ["bob@test.com"]
        }')

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "201" ]; then
        BUSINESS_ID=$(echo "$body" | jq -r '.data.id')
        if [ -n "$BUSINESS_ID" ] && [ "$BUSINESS_ID" != "null" ]; then
            log_success "创建业务成功: ID=$BUSINESS_ID"
        else
            log_error "创建业务失败: 未返回ID"
        fi
    else
        log_error "创建业务失败: HTTP $http_code"
        echo "$body" | jq .
    fi
}

# 测试列出业务
test_list_businesses() {
    log_info "列出业务..."
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/businesses?limit=10&offset=0")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        total=$(echo "$body" | jq -r '.data.total')
        if [ "$total" -ge 1 ]; then
            log_success "列出业务成功: 共 $total 条记录"
        else
            log_error "列出业务失败: 没有数据"
        fi
    else
        log_error "列出业务失败: HTTP $http_code"
    fi
}

# 测试获取单个业务
test_get_business() {
    if [ -z "$BUSINESS_ID" ]; then
        log_error "获取业务失败: 未找到业务ID"
        return
    fi

    log_info "获取业务详情..."
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/businesses/$BUSINESS_ID")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        name=$(echo "$body" | jq -r '.data.name')
        if [ -n "$name" ] && [ "$name" != "null" ]; then
            log_success "获取业务详情成功: name=$name"
        else
            log_error "获取业务详情失败: 数据格式错误"
        fi
    else
        log_error "获取业务详情失败: HTTP $http_code"
    fi
}

# 测试更新业务
test_update_business() {
    if [ -z "$BUSINESS_ID" ]; then
        log_error "更新业务失败: 未找到业务ID"
        return
    fi

    log_info "更新业务..."
    response=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/api/v1/businesses/$BUSINESS_ID" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "自动化测试业务(已更新)",
            "description": "更新后的描述"
        }')

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        log_success "更新业务成功"
    else
        log_error "更新业务失败: HTTP $http_code"
    fi
}

# 测试创建业务集
test_create_business_set() {
    if [ -z "$BUSINESS_ID" ]; then
        log_error "创建业务集失败: 未找到业务ID"
        return
    fi

    log_section "测试业务集管理API"

    log_info "创建业务集..."
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/business-sets" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "自动化测试业务集",
            "identifier": "auto-test-set-'$(date +%s)'",
            "description": "API自动化测试创建的业务集",
            "business_id": "'"$BUSINESS_ID"'"
        }')

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "201" ]; then
        BUSINESS_SET_ID=$(echo "$body" | jq -r '.data.id')
        if [ -n "$BUSINESS_SET_ID" ] && [ "$BUSINESS_SET_ID" != "null" ]; then
            log_success "创建业务集成功: ID=$BUSINESS_SET_ID"
        else
            log_error "创建业务集失败: 未返回ID"
        fi
    else
        log_error "创建业务集失败: HTTP $http_code"
        echo "$body" | jq .
    fi
}

# 测试列出业务集
test_list_business_sets() {
    log_info "列出业务集..."
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/business-sets")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        total=$(echo "$body" | jq -r '.data.total')
        if [ "$total" -ge 1 ]; then
            log_success "列出业务集成功: 共 $total 条记录"
        else
            log_error "列出业务集失败: 没有数据"
        fi
    else
        log_error "列出业务集失败: HTTP $http_code"
    fi
}

# 测试获取业务集成员
test_list_business_set_members() {
    if [ -z "$BUSINESS_SET_ID" ]; then
        log_error "获取业务集成员失败: 未找到业务集ID"
        return
    fi

    log_info "获取业务集成员..."
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/business-sets/$BUSINESS_SET_ID/members")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        count=$(echo "$body" | jq -r '.data.count')
        log_success "获取业务集成员成功: 共 $count 个成员"
    else
        log_error "获取业务集成员失败: HTTP $http_code"
    fi
}

# 测试创建模型
test_create_model() {
    log_section "测试动态模型引擎API"

    log_info "创建模型..."
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/models" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "test_server_'$(date +%s)'",
            "display_name": "测试服务器",
            "classification": "resource",
            "icon": "server",
            "description": "自动化测试服务器模型"
        }')

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "201" ]; then
        MODEL_NAME=$(echo "$body" | jq -r '.name')
        MODEL_ID=$(echo "$body" | jq -r '.id')
        if [ -n "$MODEL_NAME" ] && [ "$MODEL_NAME" != "null" ]; then
            log_success "创建模型成功: name=$MODEL_NAME"
        else
            log_error "创建模型失败: 未返回模型名称"
        fi
    else
        log_error "创建模型失败: HTTP $http_code"
        echo "$body" | jq .
    fi
}

# 测试列出模型
test_list_models() {
    log_info "列出模型..."
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/models")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        count=$(echo "$body" | jq '. | length')
        if [ "$count" -ge 1 ]; then
            log_success "列出模型成功: 共 $count 个模型"
        else
            log_error "列出模型失败: 没有数据"
        fi
    else
        log_error "列出模型失败: HTTP $http_code"
    fi
}

# 测试创建模型属性
test_create_attribute() {
    if [ -z "$MODEL_NAME" ]; then
        log_error "创建属性失败: 未找到模型名称"
        return
    fi

    log_info "创建模型属性 (hostname)..."
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/models/$MODEL_NAME/attributes" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "hostname",
            "display_name": "主机名",
            "field_type": "string",
            "is_required": true,
            "is_unique": true,
            "sort_order": 1
        }')

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "201" ]; then
        log_success "创建属性 hostname 成功"
    else
        log_error "创建属性 hostname 失败: HTTP $http_code"
        echo "$body" | jq .
    fi

    log_info "创建模型属性 (ip_address)..."
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/models/$MODEL_NAME/attributes" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "ip_address",
            "display_name": "IP地址",
            "field_type": "string",
            "is_required": true,
            "sort_order": 2
        }')

    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "201" ]; then
        log_success "创建属性 ip_address 成功"
    else
        log_error "创建属性 ip_address 失败: HTTP $http_code"
    fi

    log_info "创建模型属性 (cpu_cores)..."
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/models/$MODEL_NAME/attributes" \
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
        }')

    http_code=$(echo "$response" | tail -n1)

    if [ "$http_code" = "201" ]; then
        log_success "创建属性 cpu_cores 成功"
    else
        log_error "创建属性 cpu_cores 失败: HTTP $http_code"
    fi
}

# 测试获取模型详情
test_get_model() {
    if [ -z "$MODEL_NAME" ]; then
        log_error "获取模型详情失败: 未找到模型名称"
        return
    fi

    log_info "获取模型详情..."
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/models/$MODEL_NAME")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        attr_count=$(echo "$body" | jq '.attributes | length')
        log_success "获取模型详情成功: 包含 $attr_count 个属性"
    else
        log_error "获取模型详情失败: HTTP $http_code"
    fi
}

# 测试创建实例
test_create_instance() {
    if [ -z "$MODEL_NAME" ]; then
        log_error "创建实例失败: 未找到模型名称"
        return
    fi

    log_info "创建实例..."
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/models/$MODEL_NAME/instances" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: $TENANT_ID" \
        -d '{
            "properties": {
                "hostname": "test-host-'$(date +%s)'",
                "ip_address": "192.168.1.100",
                "cpu_cores": 8
            },
            "business_id": "'"$BUSINESS_ID"'"
        }')

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "201" ]; then
        INSTANCE_ID=$(echo "$body" | jq -r '.id')
        if [ -n "$INSTANCE_ID" ] && [ "$INSTANCE_ID" != "null" ]; then
            log_success "创建实例成功: ID=$INSTANCE_ID"
        else
            log_error "创建实例失败: 未返回ID"
        fi
    else
        log_error "创建实例失败: HTTP $http_code"
        echo "$body" | jq .
    fi
}

# 测试批量创建实例
test_batch_create_instances() {
    if [ -z "$MODEL_NAME" ]; then
        log_error "批量创建实例失败: 未找到模型名称"
        return
    fi

    log_info "批量创建实例..."
    timestamp=$(date +%s)
    response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/models/$MODEL_NAME/instances/batch" \
        -H "Content-Type: application/json" \
        -H "X-Tenant-ID: $TENANT_ID" \
        -d '{
            "instances": [
                {
                    "properties": {
                        "hostname": "batch-host-1-'$timestamp'",
                        "ip_address": "192.168.2.101",
                        "cpu_cores": 4
                    }
                },
                {
                    "properties": {
                        "hostname": "batch-host-2-'$timestamp'",
                        "ip_address": "192.168.2.102",
                        "cpu_cores": 8
                    }
                },
                {
                    "properties": {
                        "hostname": "batch-host-3-'$timestamp'",
                        "ip_address": "192.168.2.103",
                        "cpu_cores": 16
                    }
                }
            ]
        }')

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "201" ]; then
        count=$(echo "$body" | jq -r '.count')
        if [ "$count" = "3" ]; then
            log_success "批量创建实例成功: 创建了 $count 个实例"
        else
            log_error "批量创建实例失败: 预期3个，实际 $count 个"
        fi
    else
        log_error "批量创建实例失败: HTTP $http_code"
        echo "$body" | jq .
    fi
}

# 测试列出实例
test_list_instances() {
    if [ -z "$MODEL_NAME" ]; then
        log_error "列出实例失败: 未找到模型名称"
        return
    fi

    log_info "列出实例..."
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/models/$MODEL_NAME/instances?page=1&page_size=20" \
        -H "X-Tenant-ID: $TENANT_ID")

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$http_code" = "200" ]; then
        total=$(echo "$body" | jq -r '.meta.total')
        if [ "$total" -ge 1 ]; then
            log_success "列出实例成功: 共 $total 个实例"
        else
            log_error "列出实例失败: 没有数据"
        fi
    else
        log_error "列出实例失败: HTTP $http_code"
    fi
}

# 清理测试数据
cleanup() {
    log_section "清理测试数据"

    # 删除业务集
    if [ -n "$BUSINESS_SET_ID" ]; then
        log_info "删除业务集..."
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/v1/business-sets/$BUSINESS_SET_ID")
        http_code=$(echo "$response" | tail -n1)
        if [ "$http_code" = "200" ]; then
            log_success "删除业务集成功"
        else
            log_error "删除业务集失败: HTTP $http_code"
        fi
    fi

    # 删除业务
    if [ -n "$BUSINESS_ID" ]; then
        log_info "删除业务..."
        response=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/v1/businesses/$BUSINESS_ID")
        http_code=$(echo "$response" | tail -n1)
        if [ "$http_code" = "200" ]; then
            log_success "删除业务成功"
        else
            log_error "删除业务失败: HTTP $http_code"
        fi
    fi

    log_info "注意: 模型和实例未删除(当前API不支持删除操作)"
}

# 显示测试结果
show_summary() {
    log_section "测试结果汇总"

    echo -e "${BLUE}总测试数:${NC} $TOTAL_TESTS"
    echo -e "${GREEN}通过:${NC} $PASSED_TESTS"
    echo -e "${RED}失败:${NC} $FAILED_TESTS"

    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "\n${GREEN}✓ 所有测试通过!${NC}"
        exit 0
    else
        echo -e "\n${RED}✗ 部分测试失败${NC}"
        exit 1
    fi
}

# 主函数
main() {
    echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║  WEND CMDB Backend API 自动化测试      ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Base URL:${NC} $BASE_URL"
    echo -e "${BLUE}Tenant ID:${NC} $TENANT_ID"
    echo ""

    # 检查依赖
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}错误: 未找到 jq 命令，请先安装 jq${NC}"
        echo "macOS: brew install jq"
        echo "Ubuntu: sudo apt-get install jq"
        exit 1
    fi

    # 运行测试
    test_health_check
    test_create_business
    test_list_businesses
    test_get_business
    test_update_business
    test_create_business_set
    test_list_business_sets
    test_list_business_set_members
    test_create_model
    test_list_models
    test_create_attribute
    test_get_model
    test_create_instance
    test_batch_create_instances
    test_list_instances

    # 清理
    cleanup

    # 显示结果
    show_summary
}

# 运行主函数
main
