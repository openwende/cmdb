# CMDB 动态引擎 API 参考文档

## 🌐 概览
CMDB 暴露了一套基于动态引擎构建的 **RESTful API**。
- **基础 URL**: `/api/v1`
- **认证方式**: Bearer Token (Authorization: Bearer <token>)
- **响应格式**: JSON

---

## 📚 1. 元数据 API (模型定义)
管理 CMDB 的 Schema（模型和属性）。

### 获取模型列表 (List Models)
获取所有已注册的模型（例如：主机、业务、交换机）。
- **GET** `/models`
- **响应示例**:
```json
[
  {
    "id": "uuid",
    "name": "host",
    "display_name": "主机",
    "classification": "resource",
    "icon": "server",
    "is_builtin": true
  }
]
```

### 创建模型 (Create Model)
定义一个新的资源类型。
- **POST** `/models`
- **请求体**:
```json
{
  "name": "firewall",
  "display_name": "防火墙",
  "classification": "network",
  "icon": "shield"
}
```

### 获取模型详情 (Get Model Details)
获取特定模型的详细信息（包含属性定义）。
- **GET** `/models/:name` (例如: `/models/host`)

### 为模型添加属性 (Add Attribute to Model)
为现有模型添加一个新字段。
- **POST** `/models/:model_name/attributes`
- **请求体**:
```json
{
  "name": "rack_position",
  "display_name": "机柜位置",
  "field_type": "string",  // 支持: string, int, bool, enum
  "is_required": false,
  "options": {
    "pattern": "^[A-Z0-9]+$"
  }
}
```

---

## 📦 2. 通用实例 API (实例数据)
针对系统中定义的**任意模型**进行增删改查。URL 路径中的模型名称决定了操作的对象。

### 创建实例 (Create Instance)
创建一个新对象。`properties` 中的字段将根据模型的属性定义进行校验。
- **POST** `/models/:model_name/instances` (例如: `/models/host/instances`)
- **请求体**:
```json
{
  "properties": {
    "inner_ip": "10.0.0.1",
    "hostname": "nginx-01",
    "cpu_cores": 8,
    "os_name": "CentOS 7"
  },
  "business_id": "uuid-optional"
}
```
- **错误处理**: 如果必填字段缺失或类型不匹配，返回 `400 Bad Request`。

### 批量创建实例 (Batch Create Instances)
一次性创建多个实例。
- **POST** `/models/:model_name/instances/batch`
- **请求体**:
```json
{
  "instances": [
    {
      "properties": {"inner_ip": "10.0.0.2", "hostname": "web-02"},
      "business_id": "optional-uuid"
    },
    {
      "properties": {"inner_ip": "10.0.0.3", "hostname": "web-03"}
    }
  ]
}
```
- **响应**: `201 Created`
```json
{
  "count": 2,
  "ids": ["uuid-1", "uuid-2"]
}
```

### 列表查询 / 搜索实例 (List / Search Instances)
使用 JSONB 进行动态过滤查询。
- **GET** `/models/:model_name/instances`
- **查询参数**:
    - `page`: int (默认 1)
    - `page_size`: int (默认 20)
    - `q`: JSON 格式的过滤字符串。
        - **精确匹配**: `{"inner_ip": "10.0.0.1"}`
        - **部分匹配 (TODO)**: 未来支持更多操作符。
- **示例**: `GET /models/host/instances?q={"os_name":"Ubuntu"}`

### 获取实例详情 (Get Instance)
- **GET** `/models/:model_name/instances/:id`
- **响应示例**:
```json
{
  "id": "uuid",
  "model_id": "uuid",
  "properties": {
    "inner_ip": "10.0.0.1",
    "hostname": "nginx-01",
    ...
  },
  "created_at": "timestamp"
}
```

### 更新实例 (Update Instance)
更新字段。将与现有属性进行合并（目前实现为顶层字段覆盖）。
- **PUT** `/models/:model_name/instances/:id`
- **请求体**:
```json
{
  "properties": {
    "hostname": "nginx-01-updated"
  }
}
```

### 删除实例 (Delete Instance)
软删除实例。
- **DELETE** `/models/:model_name/instances/:id`

---

## 🌲 3. 拓扑 API (已规划)

### 获取业务拓扑 (Get Business Topology)
获取业务的树状结构 (业务 -> 集群 -> 模块 -> 主机)。
- **GET** `/topology/:business_id`
- **响应示例**:
```json
{
  "id": "biz-uuid",
  "name": "支付中心",
  "children": [
    {
      "id": "cluster-uuid",
      "name": "生产环境",
      "type": "cluster",
      "children": [...]
    }
  ]
}
```
