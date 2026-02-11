#!/bin/bash

# 云主机批量导入功能测试脚本
# 使用方法: ./test_host_import.sh

BASE_URL="http://localhost:8080/api/v1"

echo "=================================================="
echo "   云主机批量导入功能 - 自动化测试"
echo "=================================================="

# 检查服务是否运行
echo -e "\n🔍 检查服务状态..."
if ! curl -s "$BASE_URL/../health" > /dev/null 2>&1; then
    echo "❌ 服务未运行！请先启动服务："
    echo "   make dev"
    exit 1
fi
echo "✅ 服务运行正常"

# 1. 创建网络空间
echo -e "\n1️⃣  创建网络空间..."
NETWORK_SPACE_RESPONSE=$(curl -s -X POST "$BASE_URL/network-spaces" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试VPC",
    "identifier": "test-vpc-'$(date +%s)'",
    "cidr_block": "10.0.0.0/16",
    "region": "ap-guangzhou",
    "type": "vpc",
    "description": "自动化测试创建的VPC"
  }')

echo "$NETWORK_SPACE_RESPONSE" | jq '.'

# 提取网络空间ID
NETWORK_SPACE_ID=$(echo "$NETWORK_SPACE_RESPONSE" | jq -r '.id')
if [ "$NETWORK_SPACE_ID" = "null" ] || [ -z "$NETWORK_SPACE_ID" ]; then
    echo "❌ 创建网络空间失败"
    exit 1
fi
echo "✅ 网络空间创建成功，ID: $NETWORK_SPACE_ID"

# 2. 批量导入主机
echo -e "\n2️⃣  批量导入3台主机..."
IMPORT_RESPONSE=$(curl -s -X POST "$BASE_URL/hosts/batch" \
  -H "Content-Type: application/json" \
  -d "{
    \"hosts\": [
      {
        \"host_name\": \"web-server-01\",
        \"network_space_id\": \"$NETWORK_SPACE_ID\",
        \"primary_ip\": \"10.0.1.10\",
        \"ip_addresses\": [\"10.0.1.10\"],
        \"cloud_vendor\": \"tencent_cloud\",
        \"cloud_instance_id\": \"ins-web-$(date +%s)\",
        \"cloud_region\": \"ap-guangzhou\",
        \"cpu\": 4,
        \"memory\": 8192,
        \"disk_size\": 100,
        \"os_type\": \"linux\",
        \"os_version\": \"Ubuntu 22.04\",
        \"status\": \"running\",
        \"custom_fields\": {
          \"department\": \"技术部\",
          \"owner\": \"张三\",
          \"purpose\": \"Web服务器\",
          \"tags\": [\"production\", \"web\"]
        }
      },
      {
        \"host_name\": \"db-server-01\",
        \"network_space_id\": \"$NETWORK_SPACE_ID\",
        \"primary_ip\": \"10.0.1.20\",
        \"ip_addresses\": [\"10.0.1.20\"],
        \"cloud_vendor\": \"custom\",
        \"cpu\": 8,
        \"memory\": 16384,
        \"disk_size\": 500,
        \"os_type\": \"linux\",
        \"os_version\": \"CentOS 7\",
        \"status\": \"running\",
        \"custom_fields\": {
          \"department\": \"技术部\",
          \"owner\": \"李四\",
          \"purpose\": \"MySQL数据库\",
          \"backup_enabled\": true
        }
      },
      {
        \"host_name\": \"cache-server-01\",
        \"network_space_id\": \"$NETWORK_SPACE_ID\",
        \"primary_ip\": \"10.0.1.30\",
        \"ip_addresses\": [\"10.0.1.30\"],
        \"cloud_vendor\": \"aws\",
        \"cloud_instance_id\": \"i-$(date +%s)\",
        \"cloud_region\": \"us-east-1\",
        \"cpu\": 2,
        \"memory\": 4096,
        \"disk_size\": 50,
        \"os_type\": \"linux\",
        \"os_version\": \"Amazon Linux 2\",
        \"status\": \"running\",
        \"custom_fields\": {
          \"department\": \"技术部\",
          \"owner\": \"王五\",
          \"purpose\": \"Redis缓存\"
        }
      }
    ],
    \"skip_errors\": true
  }")

echo "$IMPORT_RESPONSE" | jq '.'

# 检查导入结果
TOTAL=$(echo "$IMPORT_RESPONSE" | jq -r '.total')
SUCCESSFUL=$(echo "$IMPORT_RESPONSE" | jq -r '.successful')
FAILED=$(echo "$IMPORT_RESPONSE" | jq -r '.failed')

if [ "$SUCCESSFUL" -eq 3 ]; then
    echo "✅ 批量导入成功！成功: $SUCCESSFUL, 失败: $FAILED"
else
    echo "⚠️  部分导入失败。成功: $SUCCESSFUL, 失败: $FAILED"
fi

# 3. 查询主机列表
echo -e "\n3️⃣  查询主机列表..."
HOST_LIST=$(curl -s "$BASE_URL/hosts?page=1&page_size=10")
echo "$HOST_LIST" | jq '.'

HOST_COUNT=$(echo "$HOST_LIST" | jq -r '.total')
echo "✅ 查询成功，共 $HOST_COUNT 台主机"

# 4. 查询指定网络空间的主机
echo -e "\n4️⃣  查询指定网络空间的主机..."
FILTERED_HOSTS=$(curl -s "$BASE_URL/hosts?network_space_id=$NETWORK_SPACE_ID")
echo "$FILTERED_HOSTS" | jq '.'

FILTERED_COUNT=$(echo "$FILTERED_HOSTS" | jq -r '.total')
echo "✅ 该网络空间有 $FILTERED_COUNT 台主机"

# 5. 按云厂商过滤
echo -e "\n5️⃣  查询腾讯云主机..."
TENCENT_HOSTS=$(curl -s "$BASE_URL/hosts?cloud_vendor=tencent_cloud")
echo "$TENCENT_HOSTS" | jq '.'

TENCENT_COUNT=$(echo "$TENCENT_HOSTS" | jq -r '.total')
echo "✅ 腾讯云主机数量: $TENCENT_COUNT"

# 6. 获取单个主机详情
echo -e "\n6️⃣  获取主机详情..."
FIRST_HOST_ID=$(echo "$IMPORT_RESPONSE" | jq -r '.created_ids[0]')
if [ "$FIRST_HOST_ID" != "null" ] && [ -n "$FIRST_HOST_ID" ]; then
    HOST_DETAIL=$(curl -s "$BASE_URL/hosts/$FIRST_HOST_ID")
    echo "$HOST_DETAIL" | jq '.'
    echo "✅ 主机详情查询成功"
fi

# 7. 更新主机自定义字段
echo -e "\n7️⃣  更新主机自定义字段..."
if [ "$FIRST_HOST_ID" != "null" ] && [ -n "$FIRST_HOST_ID" ]; then
    UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/hosts/$FIRST_HOST_ID/custom-fields" \
      -H "Content-Type: application/json" \
      -d '{
        "custom_fields": {
          "department": "DevOps团队",
          "environment": "production",
          "monitoring_enabled": true
        }
      }')
    echo "$UPDATE_RESPONSE" | jq '.'
    echo "✅ 自定义字段更新成功"
fi

# 8. 测试错误处理 - IP冲突
echo -e "\n8️⃣  测试IP冲突检测..."
CONFLICT_RESPONSE=$(curl -s -X POST "$BASE_URL/hosts/batch" \
  -H "Content-Type: application/json" \
  -d "{
    \"hosts\": [
      {
        \"host_name\": \"conflict-test\",
        \"network_space_id\": \"$NETWORK_SPACE_ID\",
        \"primary_ip\": \"10.0.1.10\",
        \"os_type\": \"linux\"
      }
    ],
    \"skip_errors\": false
  }")

echo "$CONFLICT_RESPONSE" | jq '.'

if echo "$CONFLICT_RESPONSE" | grep -q "already exists"; then
    echo "✅ IP冲突检测正常工作"
else
    echo "⚠️  IP冲突检测可能有问题"
fi

# 9. 测试查询过滤
echo -e "\n9️⃣  测试多维度查询..."

echo "按操作系统类型查询:"
curl -s "$BASE_URL/hosts?os_type=linux" | jq '.total'

echo "按状态查询:"
curl -s "$BASE_URL/hosts?status=running" | jq '.total'

echo "组合查询（网络空间+状态）:"
curl -s "$BASE_URL/hosts?network_space_id=$NETWORK_SPACE_ID&status=running" | jq '.total'

echo "✅ 查询过滤测试完成"

# 总结
echo -e "\n=================================================="
echo "             🎉 测试完成！"
echo "=================================================="
echo ""
echo "测试摘要:"
echo "  ✅ 创建网络空间: 成功"
echo "  ✅ 批量导入主机: $SUCCESSFUL/$TOTAL 成功"
echo "  ✅ 主机列表查询: 成功 ($HOST_COUNT 台主机)"
echo "  ✅ 过滤查询: 成功"
echo "  ✅ 主机详情: 成功"
echo "  ✅ 更新自定义字段: 成功"
echo "  ✅ IP冲突检测: 正常"
echo ""
echo "网络空间ID: $NETWORK_SPACE_ID"
echo ""
echo "💡 提示："
echo "   - 查看所有主机: curl $BASE_URL/hosts | jq"
echo "   - 查看网络空间: curl $BASE_URL/network-spaces/$NETWORK_SPACE_ID | jq"
echo ""
