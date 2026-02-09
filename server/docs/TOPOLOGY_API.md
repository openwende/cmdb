# 业务拓扑 API 文档

## 📋 概述

业务拓扑是 CMDB 的核心功能，用于组织管理业务下的资源。

### 层级结构

```
📦 业务（Business）
├── 🗂️ 集群（Set）
│   ├── 📁 模块（Module）
│   │   ├── 💻 主机（Host）
│   │   └── 💻 主机（Host）
│   └── 📁 模块（Module）
└── 🗂️ 集群（Set）
    └── 📁 模块（Module）
```

### 典型场景

```
📦 王者荣耀（业务）
├── 🗂️ 登录集群（prod）
│   ├── 📁 Nginx 模块 (3台主机)
│   └── 📁 API 模块 (5台主机)
├── 🗂️ 游戏集群（prod）
│   ├── 📁 游戏服务器 (20台主机)
│   └── 📁 数据库 (3台主机)
└── 🗂️ 空闲机池（默认）
    └── 📁 空闲机 (未分配的主机)
```

---

## 🌳 拓扑树 API

### 1. 获取拓扑树

```http
GET /api/v1/topology/tree?business_id=xxx&include_hosts=true&max_depth=3
```

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `business_id` | uuid | 过滤指定业务（可选） |
| `include_hosts` | bool | 是否包含主机节点（默认 false） |
| `max_depth` | int | 最大深度（1=业务, 2=集群, 3=模块, 4=主机） |

**响应**：
```json
{
  "code": 0,
  "data": [
    {
      "id": "business_xxx-xxx",
      "node_id": "xxx-xxx-xxx",
      "name": "王者荣耀",
      "node_type": "business",
      "parent_id": "",
      "icon": "business",
      "is_leaf": false,
      "expandable": true,
      "child_count": 3,
      "children": [
        {
          "id": "set_1",
          "node_id": 1,
          "name": "登录集群",
          "node_type": "set",
          "parent_id": "business_xxx-xxx",
          "icon": "cluster",
          "child_count": 2,
          "extra": {
            "env_type": "prod"
          },
          "children": [
            {
              "id": "module_1",
              "node_id": 1,
              "name": "Nginx 模块",
              "node_type": "module",
              "icon": "module",
              "child_count": 3,
              "extra": {
                "service_type": "web",
                "host_count": 3
              }
            }
          ]
        }
      ]
    }
  ]
}
```

### 2. 获取节点子节点（懒加载）

```http
GET /api/v1/topology/nodes/:type/:id/children
```

**示例**：
```bash
# 获取业务下的集群
GET /api/v1/topology/nodes/business/xxx-xxx-xxx/children

# 获取集群下的模块
GET /api/v1/topology/nodes/set/1/children

# 获取模块下的主机
GET /api/v1/topology/nodes/module/1/children
```

### 3. 获取统计信息

```http
GET /api/v1/topology/statistics?business_id=xxx
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "business_count": 5,
    "set_count": 15,
    "module_count": 45,
    "host_count": 1200,
    "by_env_type": {
      "prod": 10,
      "staging": 3,
      "dev": 2
    },
    "by_service_type": {
      "web": 20,
      "api": 15,
      "db": 8,
      "cache": 2
    }
  }
}
```

---

## 🗂️ 集群（Set）API

### 创建集群

```http
POST /api/v1/topology/sets
Content-Type: application/json

{
  "business_id": "xxx-xxx-xxx",
  "name": "登录集群",
  "description": "处理用户登录相关服务",
  "env_type": "prod",
  "sort_order": 1
}
```

**env_type 可选值**：
- `prod` - 生产环境
- `staging` - 预发布环境
- `dev` - 开发环境
- `test` - 测试环境

### 列出集群

```http
GET /api/v1/topology/sets?business_id=xxx-xxx-xxx
```

### 获取集群详情

```http
GET /api/v1/topology/sets/:id
```

### 更新集群

```http
PUT /api/v1/topology/sets/:id
Content-Type: application/json

{
  "name": "登录集群-新名称",
  "env_type": "staging"
}
```

### 删除集群

```http
DELETE /api/v1/topology/sets/:id
```

**注意**：集群下有模块时无法删除。

### 移动集群到另一个业务

```http
POST /api/v1/topology/sets/:id/move
Content-Type: application/json

{
  "target_business_id": "yyy-yyy-yyy"
}
```

**注意**：会同时更新集群下所有模块和主机的业务归属。

---

## 📁 模块（Module）API

### 创建模块

```http
POST /api/v1/topology/modules
Content-Type: application/json

{
  "set_id": 1,
  "name": "Nginx 模块",
  "description": "Web 前端服务",
  "service_type": "web",
  "sort_order": 1
}
```

**service_type 可选值**：
- `web` - Web 服务
- `api` - API 服务
- `db` - 数据库
- `cache` - 缓存
- `mq` - 消息队列
- `other` - 其他

### 列出模块

```http
# 按集群查询
GET /api/v1/topology/modules?set_id=1

# 按业务查询（获取业务下所有模块）
GET /api/v1/topology/modules?business_id=xxx-xxx-xxx
```

### 获取模块详情

```http
GET /api/v1/topology/modules/:id
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "id": 1,
    "set_id": 1,
    "business_id": "xxx-xxx-xxx",
    "name": "Nginx 模块",
    "service_type": "web",
    "host_count": 5,
    "set": {
      "id": 1,
      "name": "登录集群"
    }
  }
}
```

### 更新模块

```http
PUT /api/v1/topology/modules/:id
Content-Type: application/json

{
  "name": "Nginx 模块-新名称",
  "service_type": "api"
}
```

### 删除模块

```http
DELETE /api/v1/topology/modules/:id
```

**注意**：模块下有主机时无法删除。

### 移动模块到另一个集群

```http
POST /api/v1/topology/modules/:id/move
Content-Type: application/json

{
  "target_set_id": 2
}
```

### 获取模块下的主机

```http
GET /api/v1/topology/modules/:id/hosts?page=1&page_size=20
```

---

## 💻 主机转移 API

### 转移主机到目标模块

```http
POST /api/v1/topology/hosts/transfer
Content-Type: application/json

{
  "host_ids": ["xxx-xxx-xxx", "yyy-yyy-yyy"],
  "target_module_id": 5
}
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "total": 2,
    "successful": 2,
    "failed": 0,
    "errors": []
  }
}
```

### 转移主机到资源池

```http
POST /api/v1/topology/hosts/transfer-to-pool
Content-Type: application/json

{
  "host_ids": ["xxx-xxx-xxx", "yyy-yyy-yyy"]
}
```

---

## 🚀 业务拓扑初始化

创建业务后，初始化默认拓扑结构（空闲机池）：

```http
POST /api/v1/topology/businesses/:id/initialize
```

**效果**：自动创建：
- 默认集群：「空闲机池」
- 默认模块：「空闲机」

---

## 📊 前端集成指南

### 1. 树形组件数据绑定

```javascript
// 获取拓扑树
const response = await fetch('/api/v1/topology/tree?max_depth=3');
const { data: treeData } = await response.json();

// 渲染树形组件（示例：Ant Design Tree）
<Tree
  treeData={treeData}
  fieldNames={{
    title: 'name',
    key: 'id',
    children: 'children'
  }}
  onSelect={handleNodeSelect}
/>
```

### 2. 懒加载子节点

```javascript
const loadChildren = async (node) => {
  const { node_type, node_id } = node;
  const response = await fetch(
    `/api/v1/topology/nodes/${node_type}/${node_id}/children`
  );
  const { data: children } = await response.json();
  return children;
};
```

### 3. 节点图标映射

```javascript
const iconMap = {
  business: '🏢',
  set: '📦',
  module: '📁',
  host: '💻'
};
```

### 4. 拖拽移动

```javascript
const handleDrop = async (info) => {
  const { dragNode, node } = info;

  if (dragNode.node_type === 'module') {
    await fetch(`/api/v1/topology/modules/${dragNode.node_id}/move`, {
      method: 'POST',
      body: JSON.stringify({ target_set_id: node.node_id })
    });
  }

  // 刷新树
  refreshTree();
};
```

---

## 🎯 完整使用流程

### 1. 创建业务并初始化拓扑

```bash
# 1. 创建业务
curl -X POST /api/v1/businesses \
  -d '{"name": "王者荣耀", "description": "手游业务"}'
# 返回 business_id

# 2. 初始化拓扑（创建默认空闲机池）
curl -X POST /api/v1/topology/businesses/{business_id}/initialize
```

### 2. 创建集群和模块

```bash
# 创建登录集群
curl -X POST /api/v1/topology/sets \
  -d '{"business_id": "xxx", "name": "登录集群", "env_type": "prod"}'
# 返回 set_id

# 创建 Nginx 模块
curl -X POST /api/v1/topology/modules \
  -d '{"set_id": 1, "name": "Nginx 模块", "service_type": "web"}'
```

### 3. 将主机分配到模块

```bash
# 转移主机
curl -X POST /api/v1/topology/hosts/transfer \
  -d '{"host_ids": ["host-1", "host-2"], "target_module_id": 1}'
```

### 4. 查看拓扑

```bash
# 获取完整拓扑树
curl /api/v1/topology/tree?business_id=xxx&max_depth=4&include_hosts=true
```

---

## ✅ API 完整清单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/topology/tree` | 获取拓扑树 |
| GET | `/topology/nodes/:type/:id/children` | 懒加载子节点 |
| GET | `/topology/statistics` | 获取统计信息 |
| POST | `/topology/sets` | 创建集群 |
| GET | `/topology/sets` | 列出集群 |
| GET | `/topology/sets/:id` | 获取集群详情 |
| PUT | `/topology/sets/:id` | 更新集群 |
| DELETE | `/topology/sets/:id` | 删除集群 |
| POST | `/topology/sets/:id/move` | 移动集群 |
| POST | `/topology/modules` | 创建模块 |
| GET | `/topology/modules` | 列出模块 |
| GET | `/topology/modules/:id` | 获取模块详情 |
| PUT | `/topology/modules/:id` | 更新模块 |
| DELETE | `/topology/modules/:id` | 删除模块 |
| POST | `/topology/modules/:id/move` | 移动模块 |
| GET | `/topology/modules/:id/hosts` | 获取模块下主机 |
| POST | `/topology/hosts/transfer` | 转移主机到模块 |
| POST | `/topology/hosts/transfer-to-pool` | 转移主机到资源池 |
| POST | `/topology/businesses/:id/initialize` | 初始化业务拓扑 |

---

**祝你的 CMDB 系统开发顺利！** 🚀
