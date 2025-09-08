# GraphQL 查询示例

本文档提供了 WEND CMDB GraphQL API 的详细查询示例，涵盖了常见的使用场景和最佳实践。

## 认证示例

### 用户登录

```graphql
mutation Login {
  login(username: "admin", password: "password123") {
    token
    refreshToken
    expiresAt
    user {
      id
      username
      email
      displayName
      roles {
        name
        identifier
      }
      permissions
    }
  }
}
```

### 刷新令牌

```graphql
mutation RefreshToken {
  refreshToken(refreshToken: "refresh_token_here") {
    token
    refreshToken
    expiresAt
    user {
      id
      username
    }
  }
}
```

### 获取当前用户信息

```graphql
query Me {
  me {
    id
    username
    email
    displayName
    isActive
    roles {
      id
      name
      identifier
      permissions {
        resource
        action
      }
    }
    currentSession {
      sessionId
      ipAddress
      userAgent
      lastSeen
      expiresAt
    }
    lastLoginAt
  }
}
```

## 模型管理示例

### 创建模型

```graphql
mutation CreateModel {
  createModel(input: {
    name: "服务器"
    displayName: "服务器设备"
    identifier: "server"
    description: "物理服务器或虚拟机"
    category: "infrastructure"
    icon: "server"
    fields: [
      {
        name: "主机名"
        identifier: "hostname"
        type: STRING
        isRequired: true
        isUnique: true
        options: {
          maxLength: 255
          pattern: "^[a-zA-Z0-9-]+$"
          placeholder: "例如: web-server-01"
          helpText: "服务器的唯一标识名称"
        }
        displayOrder: 1
      }
      {
        name: "IP地址"
        identifier: "ip_address"
        type: STRING
        isRequired: true
        options: {
          pattern: "^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$"
          placeholder: "例如: 192.168.1.100"
        }
        displayOrder: 2
      }
      {
        name: "CPU核数"
        identifier: "cpu_cores"
        type: INT
        isRequired: true
        options: {
          min: 1
          max: 128
        }
        displayOrder: 3
      }
      {
        name: "内存(GB)"
        identifier: "memory_gb"
        type: INT
        isRequired: true
        options: {
          min: 1
          max: 1024
        }
        displayOrder: 4
      }
      {
        name: "操作系统"
        identifier: "os"
        type: ENUM
        isRequired: true
        options: {
          enumValues: [
            { key: "centos7", value: "CentOS 7", isDefault: true }
            { key: "centos8", value: "CentOS 8" }
            { key: "ubuntu18", value: "Ubuntu 18.04" }
            { key: "ubuntu20", value: "Ubuntu 20.04" }
            { key: "windows2019", value: "Windows Server 2019" }
          ]
        }
        displayOrder: 5
      }
      {
        name: "环境"
        identifier: "environment"
        type: ENUM
        isRequired: true
        options: {
          enumValues: [
            { key: "production", value: "生产环境" }
            { key: "staging", value: "预发布环境" }
            { key: "testing", value: "测试环境" }
            { key: "development", value: "开发环境" }
          ]
        }
        displayOrder: 6
      }
      {
        name: "描述"
        identifier: "description"
        type: LONGTEXT
        isRequired: false
        options: {
          maxLength: 1000
          placeholder: "请输入服务器描述信息"
        }
        displayOrder: 7
      }
    ]
  }) {
    id
    name
    identifier
    description
    status
    fields {
      id
      name
      identifier
      type
      isRequired
      options {
        enumValues {
          key
          value
          isDefault
        }
      }
    }
    createdAt
  }
}
```

### 查询模型列表

```graphql
query Models {
  models(page: 1, pageSize: 20, category: "infrastructure") {
    edges {
      node {
        id
        name
        displayName
        identifier
        category
        icon
        status
        isBuiltIn
        fieldCount
        instanceCount
        createdAt
        updatedAt
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

### 查询模型详情

```graphql
query ModelDetail($id: ID!) {
  model(id: $id) {
    id
    name
    displayName
    identifier
    description
    category
    icon
    status
    isBuiltIn
    fields {
      id
      name
      identifier
      type
      description
      isRequired
      isUnique
      isEditable
      defaultValue
      options {
        minLength
        maxLength
        pattern
        min
        max
        enumValues {
          key
          value
          description
          isDefault
        }
        placeholder
        helpText
      }
      displayOrder
      group {
        id
        name
      }
      createdAt
    }
    fieldGroups {
      id
      name
      identifier
      description
      displayOrder
    }
    instances(page: 1, pageSize: 5) {
      edges {
        node {
          id
          name
          status
          createdAt
        }
      }
      totalCount
    }
    instanceCount
    fieldCount
    createdAt
    updatedAt
  }
}
```

### 更新模型

```graphql
mutation UpdateModel($id: ID!) {
  updateModel(id: $id, input: {
    displayName: "物理服务器设备"
    description: "数据中心物理服务器设备管理"
    icon: "physical-server"
  }) {
    id
    name
    displayName
    description
    icon
    updatedAt
  }
}
```

### 添加字段

```graphql
mutation AddField($modelId: ID!) {
  addField(modelId: $modelId, input: {
    name: "机房位置"
    identifier: "rack_location"
    type: STRING
    description: "服务器在机房中的位置"
    isRequired: false
    options: {
      maxLength: 100
      placeholder: "例如: A区-01机柜-U10"
    }
    displayOrder: 8
  }) {
    id
    name
    identifier
    type
    description
    options {
      maxLength
      placeholder
    }
    displayOrder
    model {
      id
      name
    }
    createdAt
  }
}
```

## 实例管理示例

### 创建实例

```graphql
mutation CreateInstance {
  createInstance(input: {
    modelId: "550e8400-e29b-41d4-a716-446655440001"
    name: "web-server-01"
    data: {
      hostname: "web01.example.com"
      ip_address: "192.168.1.100"
      cpu_cores: 16
      memory_gb: 64
      os: "centos7"
      environment: "production"
      description: "主要Web服务器"
      rack_location: "A区-01机柜-U10"
    }
  }) {
    id
    name
    status
    data
    model {
      id
      name
      identifier
    }
    createdBy {
      username
      displayName
    }
    createdAt
  }
}
```

### 查询实例列表

```graphql
query Instances($modelName: String!) {
  instances(modelName: $modelName, page: 1, pageSize: 20, search: "web") {
    edges {
      node {
        id
        name
        status
        data
        model {
          id
          name
          identifier
        }
        businessAssociations {
          id
          businessNode {
            id
            name
            path
          }
          role
        }
        createdAt
        updatedAt
      }
      cursor
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}
```

### 查询实例详情

```graphql
query InstanceDetail($id: ID!) {
  instance(id: $id) {
    id
    name
    status
    data
    model {
      id
      name
      identifier
      fields {
        id
        name
        identifier
        type
        options {
          enumValues {
            key
            value
          }
        }
      }
    }
    sourceRelationships {
      id
      targetInstance {
        id
        name
        model {
          name
        }
      }
      relationship {
        name
        type
      }
      metadata
      createdAt
    }
    targetRelationships {
      id
      sourceInstance {
        id
        name
        model {
          name
        }
      }
      relationship {
        name
        type
      }
      metadata
      createdAt
    }
    businessAssociations {
      id
      businessNode {
        id
        name
        path
        level
      }
      role
      weight
      metadata
      createdAt
    }
    createdBy {
      id
      username
      displayName
    }
    updatedBy {
      id
      username
      displayName
    }
    createdAt
    updatedAt
  }
}
```

### 更新实例

```graphql
mutation UpdateInstance($id: ID!) {
  updateInstance(id: $id, input: {
    name: "web-server-01-upgraded"
    data: {
      hostname: "web01-new.example.com"
      memory_gb: 128
      description: "升级后的主要Web服务器"
    }
  }) {
    id
    name
    data
    updatedAt
    updatedBy {
      username
    }
  }
}
```

### 批量创建实例

```graphql
mutation BulkCreateInstances {
  bulkCreateInstances(inputs: [
    {
      modelId: "550e8400-e29b-41d4-a716-446655440001"
      name: "web-server-02"
      data: {
        hostname: "web02.example.com"
        ip_address: "192.168.1.101"
        cpu_cores: 16
        memory_gb: 64
        os: "centos7"
        environment: "production"
      }
    }
    {
      modelId: "550e8400-e29b-41d4-a716-446655440001"
      name: "web-server-03"
      data: {
        hostname: "web03.example.com"
        ip_address: "192.168.1.102"
        cpu_cores: 16
        memory_gb: 64
        os: "centos7"
        environment: "production"
      }
    }
  ]) {
    successCount
    errorCount
    totalCount
    errors {
      index
      message
      code
    }
  }
}
```

## 业务拓扑示例

### 创建业务节点

```graphql
mutation CreateBusinessNode {
  createBusinessNode(input: {
    name: "电商平台"
    description: "在线电商业务平台"
    metadata: {
      owner: "platform-team"
      contact: "platform@company.com"
      business_type: "e-commerce"
    }
  }) {
    id
    name
    level
    path
    description
    metadata
    createdAt
  }
}
```

### 创建子节点

```graphql
mutation CreateChildNode($parentId: ID!) {
  createBusinessNode(input: {
    name: "用户服务"
    parentId: $parentId
    description: "用户管理相关服务"
    metadata: {
      team: "user-team"
      service_type: "microservice"
    }
  }) {
    id
    name
    parentId
    level
    path
    parent {
      id
      name
    }
    createdAt
  }
}
```

### 查询业务拓扑树

```graphql
query BusinessTree {
  businessTree(maxDepth: 5) {
    rootNode {
      id
      name
    }
    nodes {
      id
      name
      parentId
      level
      path
      description
      metadata
      childrenCount
      instanceCount
      children {
        id
        name
        level
      }
      instances {
        id
        instance {
          id
          name
          model {
            name
          }
        }
        role
        weight
      }
    }
    maxDepth
    totalNodes
  }
}
```

### 关联实例到业务节点

```graphql
mutation AssociateInstance($nodeId: ID!, $instanceId: ID!) {
  associateInstance(nodeId: $nodeId, instanceId: $instanceId, role: "primary") {
    id
    businessNode {
      id
      name
    }
    instance {
      id
      name
      model {
        name
      }
    }
    role
    weight
    createdAt
  }
}
```

### 查询节点详情

```graphql
query BusinessNodeDetail($id: ID!) {
  businessNode(id: $id) {
    id
    name
    parentId
    level
    path
    description
    metadata
    parent {
      id
      name
      path
    }
    children {
      id
      name
      level
      instanceCount
      createdAt
    }
    instances {
      id
      instance {
        id
        name
        status
        model {
          id
          name
        }
        data
      }
      role
      weight
      metadata
      createdAt
    }
    childrenCount
    instanceCount
    createdAt
    updatedAt
  }
}
```

## 动态查询示例

### 复杂条件查询

```graphql
query DynamicQuery {
  executeQuery(query: {
    modelName: "server"
    fields: ["name", "data.hostname", "data.ip_address", "data.cpu_cores", "data.memory_gb", "data.environment"]
    filters: [
      {
        field: "data.environment"
        operator: EQ
        value: "production"
      }
      {
        field: "data.cpu_cores"
        operator: GTE
        value: 8
      }
      {
        field: "data.memory_gb"
        operator: GT
        value: 32
      }
      {
        field: "name"
        operator: LIKE
        value: "web%"
      }
    ]
    sort: [
      {
        field: "data.cpu_cores"
        order: DESC
      }
      {
        field: "name"
        order: ASC
      }
    ]
    pagination: {
      page: 1
      pageSize: 20
    }
  }) {
    data
    totalCount
    pageInfo {
      hasNextPage
      hasPreviousPage
    }
  }
}
```

### 聚合查询

```graphql
query AggregateQuery {
  executeQuery(query: {
    modelName: "server"
    groupBy: ["data.environment", "data.os"]
    aggregations: [
      {
        field: "data.cpu_cores"
        function: SUM
        alias: "total_cpu_cores"
      }
      {
        field: "data.memory_gb"
        function: AVG
        alias: "avg_memory"
      }
      {
        field: "id"
        function: COUNT
        alias: "server_count"
      }
    ]
    filters: [
      {
        field: "status"
        operator: EQ
        value: "active"
      }
    ]
  }) {
    data
    aggregations
    totalCount
  }
}
```

## 审计日志示例

### 查询审计日志

```graphql
query AuditLogs {
  auditLogs(
    filters: {
      startDate: "2024-01-01T00:00:00Z"
      endDate: "2024-01-31T23:59:59Z"
      actions: ["create", "update", "delete"]
      resourceTypes: ["model", "instance"]
    }
    pagination: {
      page: 1
      pageSize: 50
    }
  ) {
    edges {
      node {
        id
        username
        action
        resourceType
        resourceId
        resourceName
        requestMethod
        requestPath
        responseStatus
        ipAddress
        durationMs
        createdAt
      }
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}
```

### 查询安全事件

```graphql
query SecurityAuditLogs {
  auditLogs(
    filters: {
      actions: ["login", "logout", "change_password", "create_user", "delete_user"]
      startDate: "2024-01-01T00:00:00Z"
    }
    pagination: {
      page: 1
      pageSize: 100
    }
  ) {
    edges {
      node {
        id
        username
        action
        resourceType
        ipAddress
        userAgent
        responseStatus
        errorMessage
        metadata
        createdAt
      }
    }
    totalCount
  }
}
```

## 订阅示例

### 模型变更订阅

```graphql
subscription ModelChanges {
  modelChanges {
    type
    model {
      id
      name
      identifier
    }
    changes
    timestamp
    user {
      username
      displayName
    }
  }
}
```

### 实例变更订阅

```graphql
subscription InstanceChanges($modelId: ID) {
  instanceChanges(modelId: $modelId) {
    type
    instance {
      id
      name
      model {
        id
        name
      }
    }
    changes
    timestamp
    user {
      username
    }
  }
}
```

### 审计事件订阅

```graphql
subscription AuditEvents {
  auditEvents(filters: {
    actions: ["create", "update", "delete"]
    resourceTypes: ["model", "instance"]
  }) {
    log {
      id
      username
      action
      resourceType
      resourceName
      ipAddress
      createdAt
    }
    severity
    category
  }
}
```

### 系统通知订阅

```graphql
subscription SystemNotifications {
  systemNotifications {
    id
    type
    title
    message
    data
    severity
    timestamp
  }
}
```

## 变量使用示例

### 使用变量的查询

```graphql
query GetModelWithInstances($modelId: ID!, $page: Int = 1, $pageSize: Int = 20) {
  model(id: $modelId) {
    id
    name
    displayName
    instances(page: $page, pageSize: $pageSize) {
      edges {
        node {
          id
          name
          status
          data
          createdAt
        }
      }
      pageInfo {
        hasNextPage
        totalCount
      }
    }
  }
}
```

变量：
```json
{
  "modelId": "550e8400-e29b-41d4-a716-446655440001",
  "page": 1,
  "pageSize": 10
}
```

### 条件查询变量

```graphql
query SearchInstances(
  $modelName: String!
  $search: String
  $environment: String
  $page: Int = 1
  $pageSize: Int = 20
) {
  executeQuery(query: {
    modelName: $modelName
    fields: ["id", "name", "data.hostname", "data.ip_address", "data.environment"]
    filters: [
      {
        field: "name"
        operator: LIKE
        value: $search
      }
      {
        field: "data.environment"
        operator: EQ
        value: $environment
      }
    ]
    pagination: {
      page: $page
      pageSize: $pageSize
    }
  }) {
    data
    totalCount
    pageInfo {
      hasNextPage
    }
  }
}
```

变量：
```json
{
  "modelName": "server",
  "search": "web%",
  "environment": "production",
  "page": 1,
  "pageSize": 20
}
```

## 错误处理示例

### 处理验证错误

```graphql
mutation CreateModelWithError {
  createModel(input: {
    name: ""  # 空名称会导致验证错误
    identifier: "invalid-identifier"
  }) {
    id
    name
  }
}
```

响应：
```json
{
  "data": {
    "createModel": null
  },
  "errors": [
    {
      "message": "字段验证失败",
      "locations": [{"line": 2, "column": 3}],
      "path": ["createModel"],
      "extensions": {
        "code": "VALIDATION_ERROR",
        "field": "name",
        "details": {
          "name": ["名称不能为空"],
          "identifier": ["标识符格式不正确"]
        }
      }
    }
  ]
}
```

### 处理权限错误

```graphql
mutation UnauthorizedOperation {
  deleteModel(id: "550e8400-e29b-41d4-a716-446655440001") {
    id
  }
}
```

响应：
```json
{
  "data": {
    "deleteModel": null
  },
  "errors": [
    {
      "message": "权限不足",
      "locations": [{"line": 2, "column": 3}],
      "path": ["deleteModel"],
      "extensions": {
        "code": "UNAUTHORIZED",
        "details": {
          "required_permission": "model:delete",
          "user_permissions": ["model:read", "model:create"]
        }
      }
    }
  ]
}
```

## 最佳实践

### 1. 请求合并

```graphql
# 好的做法：一次查询获取所需的所有数据
query DashboardData {
  models(page: 1, pageSize: 10) {
    edges {
      node {
        id
        name
        instanceCount
      }
    }
    totalCount
  }
  
  recentInstances: instances(modelName: "server", page: 1, pageSize: 5) {
    edges {
      node {
        id
        name
        createdAt
      }
    }
  }
  
  me {
    username
    roles {
      name
    }
  }
}
```

### 2. 字段选择

```graphql
# 好的做法：只查询需要的字段
query ModelList {
  models {
    edges {
      node {
        id
        name
        displayName
        instanceCount  # 只查询列表显示需要的字段
      }
    }
  }
}

# 避免：查询所有字段
query ModelListBad {
  models {
    edges {
      node {
        id
        name
        displayName
        identifier
        description
        category
        icon
        status
        isBuiltIn
        fields {
          # 这会导致过多的数据传输
          id
          name
          type
          # ...
        }
        # ...
      }
    }
  }
}
```

### 3. 分页使用

```graphql
# 使用合适的分页大小
query InstancesPaginated($cursor: String) {
  instances(modelName: "server", first: 20, after: $cursor) {
    edges {
      node {
        id
        name
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### 4. 缓存友好的查询

```graphql
# 使用稳定的字段顺序和查询结构
query CacheableQuery($id: ID!) {
  model(id: $id) {
    id
    name
    displayName
    instanceCount
  }
}
```