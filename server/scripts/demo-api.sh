#!/bin/bash

# Wende CMDB Server - 快速演示脚本
# 演示基本的API使用流程

set -e

BASE_URL="http://localhost:8080"
TENANT_ID="ce307a3d-a1a7-4838-ab0b-23182f9851c3"

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  Wende CMDB Server 快速演示            ║${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"
echo ""

# 1. 健康检查
echo -e "${BLUE}步骤 1: 检查服务健康状态${NC}"
echo "$ curl http://localhost:8080/health"
curl -s $BASE_URL/health | jq
echo ""
read -p "按回车键继续..."
echo ""

# 2. 创建业务
echo -e "${BLUE}步骤 2: 创建业务${NC}"
echo '$ curl -X POST http://localhost:8080/api/v1/businesses \'
echo '  -H "Content-Type: application/json" \'
echo '  -d '\''{"name": "演示业务", "identifier": "demo-business"}'\'''
BUSINESS_RESPONSE=$(curl -s -X POST $BASE_URL/api/v1/businesses \
  -H "Content-Type: application/json" \
  -d '{
    "name": "演示业务",
    "identifier": "demo-business-'$(date +%s)'",
    "description": "这是一个演示业务",
    "lifecycle": "online"
  }')
echo "$BUSINESS_RESPONSE" | jq
BUSINESS_ID=$(echo "$BUSINESS_RESPONSE" | jq -r '.data.id')
echo ""
echo -e "${GREEN}✓ 业务创建成功! ID: $BUSINESS_ID${NC}"
echo ""
read -p "按回车键继续..."
echo ""

# 3. 查询业务列表
echo -e "${BLUE}步骤 3: 查询业务列表${NC}"
echo "$ curl http://localhost:8080/api/v1/businesses"
curl -s $BASE_URL/api/v1/businesses | jq '.data.items[] | {id, name, identifier, lifecycle}'
echo ""
read -p "按回车键继续..."
echo ""

# 4. 创建模型
echo -e "${BLUE}步骤 4: 创建主机模型${NC}"
MODEL_NAME="demo_host_$(date +%s)"
echo "$ curl -X POST http://localhost:8080/api/v1/models ..."
MODEL_RESPONSE=$(curl -s -X POST $BASE_URL/api/v1/models \
  -H "Content-Type: application/json" \
  -d '{
    "name": "'"$MODEL_NAME"'",
    "display_name": "演示主机",
    "classification": "resource",
    "icon": "server",
    "description": "演示用的主机模型"
  }')
echo "$MODEL_RESPONSE" | jq
echo ""
echo -e "${GREEN}✓ 模型创建成功! Name: $MODEL_NAME${NC}"
echo ""
read -p "按回车键继续..."
echo ""

# 5. 为模型添加属性
echo -e "${BLUE}步骤 5: 为模型添加属性${NC}"
echo "添加 hostname 属性..."
curl -s -X POST $BASE_URL/api/v1/models/$MODEL_NAME/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hostname",
    "display_name": "主机名",
    "field_type": "string",
    "is_required": true,
    "is_unique": true
  }' | jq

echo ""
echo "添加 ip_address 属性..."
curl -s -X POST $BASE_URL/api/v1/models/$MODEL_NAME/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ip_address",
    "display_name": "IP地址",
    "field_type": "string",
    "is_required": true
  }' | jq

echo ""
echo -e "${GREEN}✓ 属性添加成功!${NC}"
echo ""
read -p "按回车键继续..."
echo ""

# 6. 查看完整模型定义
echo -e "${BLUE}步骤 6: 查看完整模型定义${NC}"
echo "$ curl http://localhost:8080/api/v1/models/$MODEL_NAME"
curl -s $BASE_URL/api/v1/models/$MODEL_NAME | jq
echo ""
read -p "按回车键继续..."
echo ""

# 7. 创建实例
echo -e "${BLUE}步骤 7: 创建主机实例${NC}"
echo '$ curl -X POST http://localhost:8080/api/v1/models/'"$MODEL_NAME"'/instances \'
echo '  -H "X-Tenant-ID: '"$TENANT_ID"'" \'
echo '  -d '\''{"properties": {"hostname": "demo-host-01", "ip_address": "192.168.1.100"}}'\'''
INSTANCE_RESPONSE=$(curl -s -X POST $BASE_URL/api/v1/models/$MODEL_NAME/instances \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "properties": {
      "hostname": "demo-host-01",
      "ip_address": "192.168.1.100"
    },
    "business_id": "'"$BUSINESS_ID"'"
  }')
echo "$INSTANCE_RESPONSE" | jq
INSTANCE_ID=$(echo "$INSTANCE_RESPONSE" | jq -r '.id')
echo ""
echo -e "${GREEN}✓ 实例创建成功! ID: $INSTANCE_ID${NC}"
echo ""
read -p "按回车键继续..."
echo ""

# 8. 批量创建实例
echo -e "${BLUE}步骤 8: 批量创建实例${NC}"
echo "批量创建3个主机实例..."
curl -s -X POST $BASE_URL/api/v1/models/$MODEL_NAME/instances/batch \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: $TENANT_ID" \
  -d '{
    "instances": [
      {"properties": {"hostname": "demo-host-02", "ip_address": "192.168.1.101"}},
      {"properties": {"hostname": "demo-host-03", "ip_address": "192.168.1.102"}},
      {"properties": {"hostname": "demo-host-04", "ip_address": "192.168.1.103"}}
    ]
  }' | jq
echo ""
echo -e "${GREEN}✓ 批量创建成功!${NC}"
echo ""
read -p "按回车键继续..."
echo ""

# 9. 查询所有实例
echo -e "${BLUE}步骤 9: 查询所有实例${NC}"
echo "$ curl http://localhost:8080/api/v1/models/$MODEL_NAME/instances"
curl -s "$BASE_URL/api/v1/models/$MODEL_NAME/instances" \
  -H "X-Tenant-ID: $TENANT_ID" | jq
echo ""

# 完成
echo -e "${YELLOW}════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ 演示完成!${NC}"
echo ""
echo "您已经成功创建了:"
echo "  - 1个业务 (ID: $BUSINESS_ID)"
echo "  - 1个模型 ($MODEL_NAME)"
echo "  - 4个实例"
echo ""
echo "查看完整API文档: docs/API.md"
echo "查看快速开始指南: docs/QUICKSTART.md"
echo -e "${YELLOW}════════════════════════════════════════${NC}"
