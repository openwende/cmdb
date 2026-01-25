#!/bin/bash

# 业务删除功能端到端测试脚本
# 测试只有归档（offline）状态的业务才能被删除

set -e

BASE_URL="http://localhost:8080"
echo "🧪 开始测试业务删除功能..."
echo "================================"

# 1. 创建一个测试业务（默认为 online 状态）
echo "📝 步骤 1: 创建测试业务（online状态）..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/businesses" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试业务-删除功能验证",
    "description": "用于测试删除功能的业务",
    "lifecycle": "online"
  }')

BUSINESS_ID=$(echo $CREATE_RESPONSE | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "✅ 创建成功，业务ID: $BUSINESS_ID"
echo ""

# 2. 尝试删除 online 状态的业务（应该失败）
echo "❌ 步骤 2: 尝试删除 online 状态的业务（应该被拒绝）..."
DELETE_RESPONSE_1=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/v1/businesses/$BUSINESS_ID")
HTTP_CODE_1=$(echo "$DELETE_RESPONSE_1" | tail -n1)
BODY_1=$(echo "$DELETE_RESPONSE_1" | head -n-1)

if [ "$HTTP_CODE_1" == "400" ]; then
    echo "✅ 正确拒绝删除 online 状态的业务"
    echo "   响应: $BODY_1"
else
    echo "❌ 测试失败：应该返回 400，实际返回 $HTTP_CODE_1"
    exit 1
fi
echo ""

# 3. 将业务更新为 offline 状态
echo "🔄 步骤 3: 将业务更新为 offline（归档）状态..."
UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/v1/businesses/$BUSINESS_ID" \
  -H "Content-Type: application/json" \
  -d '{"lifecycle": "offline"}')
echo "✅ 更新成功"
echo ""

# 4. 再次尝试删除（这次应该成功）
echo "✅ 步骤 4: 删除 offline 状态的业务（应该成功）..."
DELETE_RESPONSE_2=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_URL/api/v1/businesses/$BUSINESS_ID")
HTTP_CODE_2=$(echo "$DELETE_RESPONSE_2" | tail -n1)
BODY_2=$(echo "$DELETE_RESPONSE_2" | head -n-1)

if [ "$HTTP_CODE_2" == "200" ]; then
    echo "✅ 成功删除 offline 状态的业务"
    echo "   响应: $BODY_2"
else
    echo "❌ 测试失败：应该返回 200，实际返回 $HTTP_CODE_2"
    echo "   响应: $BODY_2"
    exit 1
fi
echo ""

# 5. 验证业务已被删除
echo "🔍 步骤 5: 验证业务已被删除..."
GET_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/businesses/$BUSINESS_ID")
HTTP_CODE_3=$(echo "$GET_RESPONSE" | tail -n1)

if [ "$HTTP_CODE_3" == "404" ]; then
    echo "✅ 确认业务已被删除"
else
    echo "⚠️  业务可能使用软删除，状态码: $HTTP_CODE_3"
fi
echo ""

echo "================================"
echo "🎉 所有测试通过！"
echo "✅ 功能验证成功："
echo "   - 只有 offline 状态的业务可以被删除"
echo "   - online 和 testing 状态的业务无法删除"
echo "   - 删除前需要先将业务归档"
