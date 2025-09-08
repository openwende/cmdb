# GraphQL Schema 文档

WEND CMDB GraphQL API 提供了一个现代化的查询接口，支持精确的数据获取、实时订阅和类型安全的操作。

## 基础信息

- **GraphQL Endpoint**: `http://localhost:8080/api/v1/graphql`
- **GraphQL Playground**: `http://localhost:8080/api/v1/graphql/playground`
- **WebSocket Subscriptions**: `ws://localhost:8080/api/v1/graphql/subscriptions`
- **认证方式**: JWT Bearer Token (Header: `Authorization: Bearer <token>`)

## Schema 概览

```graphql
# 根查询类型
type Query {
  # 模型查询
  models(page: Int, pageSize: Int, category: String, search: String): ModelConnection
  model(id: ID!): Model
  modelByName(name: String!): Model
  
  # 实例查询
  instances(modelName: String!, page: Int, pageSize: Int, search: String): InstanceConnection
  instance(id: ID!): Instance
  
  # 业务拓扑查询
  businessNodes(parentId: ID, level: Int): [BusinessNode!]!
  businessNode(id: ID!): BusinessNode
  businessTree(rootId: ID, maxDepth: Int): BusinessTree
  
  # 用户查询
  me: User
  users(page: Int, pageSize: Int): UserConnection
  
  # 审计查询
  auditLogs(filters: AuditFilters, pagination: PaginationInput): AuditLogConnection
  
  # 动态查询
  executeQuery(query: DynamicQueryInput!): DynamicQueryResult
}

# 根变更类型
type Mutation {
  # 认证相关
  login(username: String!, password: String!): AuthPayload!
  logout: Boolean!
  refreshToken(refreshToken: String!): AuthPayload!
  
  # 模型管理
  createModel(input: ModelInput!): Model!
  updateModel(id: ID!, input: ModelUpdateInput!): Model!
  deleteModel(id: ID!): Boolean!
  
  # 字段管理
  addField(modelId: ID!, input: FieldInput!): Field!
  updateField(id: ID!, input: FieldUpdateInput!): Field!
  removeField(id: ID!): Boolean!
  
  # 实例管理
  createInstance(input: InstanceInput!): Instance!
  updateInstance(id: ID!, input: InstanceUpdateInput!): Instance!
  deleteInstance(id: ID!): Boolean!
  
  # 批量操作
  bulkCreateInstances(inputs: [InstanceInput!]!): BulkOperationResult!
  bulkUpdateInstances(updates: [BulkUpdateInput!]!): BulkOperationResult!
  bulkDeleteInstances(ids: [ID!]!): BulkOperationResult!
  
  # 关系管理
  createRelationship(input: RelationshipInput!): Relationship!
  deleteRelationship(id: ID!): Boolean!
  
  # 业务拓扑管理
  createBusinessNode(input: BusinessNodeInput!): BusinessNode!
  updateBusinessNode(id: ID!, input: BusinessNodeUpdateInput!): BusinessNode!
  deleteBusinessNode(id: ID!): Boolean!
  moveBusinessNode(id: ID!, newParentId: ID): Boolean!
  
  # 实例关联
  associateInstance(nodeId: ID!, instanceId: ID!, role: String): BusinessInstance!
  disassociateInstance(nodeId: ID!, instanceId: ID!): Boolean!
}

# 订阅类型
type Subscription {
  # 模型变更通知
  modelChanges(modelId: ID): ModelChangeEvent!
  
  # 实例变更通知
  instanceChanges(modelId: ID, instanceId: ID): InstanceChangeEvent!
  
  # 业务拓扑变更通知
  businessChanges(nodeId: ID): BusinessChangeEvent!
  
  # 审计事件通知
  auditEvents(filters: AuditEventFilters): AuditEvent!
  
  # 系统通知
  systemNotifications: SystemNotification!
}
```

## 核心类型定义

### 模型相关类型

```graphql
# 模型类型
type Model {
  id: ID!
  name: String!
  displayName: String
  identifier: String!
  description: String
  category: String
  icon: String
  status: ModelStatus!
  isBuiltIn: Boolean!
  
  # 关联数据
  fields: [Field!]!
  fieldGroups: [FieldGroup!]!
  instances(page: Int, pageSize: Int): InstanceConnection
  
  # 统计信息
  instanceCount: Int!
  fieldCount: Int!
  
  # 时间戳
  createdAt: DateTime!
  updatedAt: DateTime!
}

# 字段类型
type Field {
  id: ID!
  name: String!
  identifier: String!
  type: FieldType!
  description: String
  isRequired: Boolean!
  isUnique: Boolean!
  isEditable: Boolean!
  isBuiltIn: Boolean!
  defaultValue: String
  options: FieldOptions
  displayOrder: Int!
  
  # 关联
  model: Model!
  group: FieldGroup
  
  # 时间戳
  createdAt: DateTime!
  updatedAt: DateTime!
}

# 字段选项
type FieldOptions {
  minLength: Int
  maxLength: Int
  pattern: String
  min: Float
  max: Float
  enumValues: [EnumValue!]
  listItemType: FieldType
  listMinItems: Int
  listMaxItems: Int
  tableColumns: [TableColumn!]
  placeholder: String
  helpText: String
}

# 枚举值
type EnumValue {
  key: String!
  value: String!
  description: String
  isDefault: Boolean!
}

# 字段类型枚举
enum FieldType {
  STRING
  LONGTEXT
  INT
  FLOAT
  BOOL
  DATE
  DATETIME
  ENUM
  MULTI_ENUM
  USER
  TIMEZONE
  LIST
  TABLE
}

# 模型状态枚举
enum ModelStatus {
  ACTIVE
  INACTIVE
  ARCHIVED
}

# 模型输入类型
input ModelInput {
  name: String!
  displayName: String
  identifier: String
  description: String
  category: String
  icon: String
  fields: [FieldInput!]
}

# 字段输入类型
input FieldInput {
  name: String!
  identifier: String
  type: FieldType!
  description: String
  isRequired: Boolean = false
  isUnique: Boolean = false
  defaultValue: String
  options: FieldOptionsInput
  displayOrder: Int
  groupId: ID
}
```

### 实例相关类型

```graphql
# 实例类型
type Instance {
  id: ID!
  name: String!
  status: InstanceStatus!
  data: JSON!
  
  # 关联
  model: Model!
  sourceRelationships: [InstanceRelationship!]!
  targetRelationships: [InstanceRelationship!]!
  businessAssociations: [BusinessInstance!]!
  
  # 元数据
  createdBy: User
  updatedBy: User
  createdAt: DateTime!
  updatedAt: DateTime!
}

# 实例关系
type InstanceRelationship {
  id: ID!
  sourceInstance: Instance!
  targetInstance: Instance!
  relationship: Relationship!
  metadata: JSON
  createdAt: DateTime!
}

# 关系定义
type Relationship {
  id: ID!
  name: String!
  sourceModel: Model!
  targetModel: Model!
  type: RelationshipType!
  isRequired: Boolean!
  description: String
}

# 实例状态枚举
enum InstanceStatus {
  ACTIVE
  INACTIVE
  DELETED
}

# 关系类型枚举
enum RelationshipType {
  ONE_TO_ONE
  ONE_TO_MANY
  MANY_TO_MANY
}

# 实例输入类型
input InstanceInput {
  modelId: ID!
  name: String!
  data: JSON!
  status: InstanceStatus = ACTIVE
}

# 实例连接类型
type InstanceConnection {
  edges: [InstanceEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}

type InstanceEdge {
  node: Instance!
  cursor: String!
}
```

### 业务拓扑类型

```graphql
# 业务节点
type BusinessNode {
  id: ID!
  name: String!
  parentId: ID
  level: Int!
  path: String!
  description: String
  metadata: JSON
  
  # 关联
  parent: BusinessNode
  children: [BusinessNode!]!
  instances: [BusinessInstance!]!
  
  # 统计
  childrenCount: Int!
  instanceCount: Int!
  
  # 时间戳
  createdAt: DateTime!
  updatedAt: DateTime!
}

# 业务实例关联
type BusinessInstance {
  id: ID!
  businessNode: BusinessNode!
  instance: Instance!
  role: String
  weight: Int
  metadata: JSON
  createdAt: DateTime!
}

# 业务拓扑树
type BusinessTree {
  rootNode: BusinessNode
  nodes: [BusinessNode!]!
  relationships: [BusinessNodeRelation!]!
  maxDepth: Int!
  totalNodes: Int!
}

# 业务节点输入
input BusinessNodeInput {
  name: String!
  parentId: ID
  description: String
  metadata: JSON
}
```

### 用户和认证类型

```graphql
# 用户类型
type User {
  id: ID!
  username: String!
  email: String!
  displayName: String!
  isActive: Boolean!
  
  # 权限相关
  roles: [Role!]!
  permissions: [String!]!
  
  # 会话信息
  lastLoginAt: DateTime
  currentSession: UserSession
  
  # 时间戳
  createdAt: DateTime!
  updatedAt: DateTime!
}

# 角色类型
type Role {
  id: ID!
  name: String!
  identifier: String!
  description: String
  isBuiltIn: Boolean!
  permissions: [Permission!]!
  userCount: Int!
}

# 权限类型
type Permission {
  id: ID!
  name: String!
  resource: String!
  action: String!
  description: String
  isBuiltIn: Boolean!
}

# 认证载荷
type AuthPayload {
  token: String!
  refreshToken: String!
  expiresAt: DateTime!
  user: User!
}

# 用户会话
type UserSession {
  sessionId: String!
  ipAddress: String!
  userAgent: String!
  createdAt: DateTime!
  lastSeen: DateTime!
  expiresAt: DateTime!
  isActive: Boolean!
}
```

### 审计日志类型

```graphql
# 审计日志
type AuditLog {
  id: ID!
  userId: ID
  username: String!
  action: String!
  resourceType: String!
  resourceId: String
  resourceName: String
  requestMethod: String!
  requestPath: String!
  requestBody: JSON
  responseStatus: Int!
  responseBody: JSON
  ipAddress: String!
  userAgent: String!
  sessionId: String
  durationMs: Int!
  errorMessage: String
  metadata: JSON
  createdAt: DateTime!
}

# 审计过滤器
input AuditFilters {
  startDate: DateTime
  endDate: DateTime
  userIds: [ID!]
  actions: [String!]
  resourceTypes: [String!]
  resourceIds: [String!]
  ipAddresses: [String!]
  statusCodes: [Int!]
  search: String
}

# 审计日志连接
type AuditLogConnection {
  edges: [AuditLogEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

### 动态查询类型

```graphql
# 动态查询输入
input DynamicQueryInput {
  modelName: String!
  fields: [String!]
  filters: [FilterInput!]
  sort: [SortInput!]
  pagination: PaginationInput
  groupBy: [String!]
  aggregations: [AggregationInput!]
}

# 过滤器输入
input FilterInput {
  field: String!
  operator: FilterOperator!
  value: JSON!
}

# 过滤操作符
enum FilterOperator {
  EQ
  NE
  GT
  GTE
  LT
  LTE
  IN
  NOT_IN
  LIKE
  NOT_LIKE
  IS_NULL
  IS_NOT_NULL
  BETWEEN
}

# 排序输入
input SortInput {
  field: String!
  order: SortOrder!
}

enum SortOrder {
  ASC
  DESC
}

# 聚合输入
input AggregationInput {
  field: String!
  function: AggregationFunction!
  alias: String
}

enum AggregationFunction {
  COUNT
  SUM
  AVG
  MIN
  MAX
  DISTINCT_COUNT
}

# 动态查询结果
type DynamicQueryResult {
  data: [JSON!]!
  aggregations: JSON
  totalCount: Int!
  pageInfo: PageInfo
}
```

### 通用类型

```graphql
# 分页信息
type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
}

# 分页输入
input PaginationInput {
  page: Int = 1
  pageSize: Int = 20
}

# 批量操作结果
type BulkOperationResult {
  successCount: Int!
  errorCount: Int!
  totalCount: Int!
  errors: [BulkOperationError!]!
}

type BulkOperationError {
  index: Int!
  message: String!
  code: String
}

# JSON 标量类型
scalar JSON

# 日期时间标量类型
scalar DateTime

# 上传文件类型
scalar Upload
```

### 订阅事件类型

```graphql
# 模型变更事件
type ModelChangeEvent {
  type: ChangeEventType!
  model: Model!
  changes: JSON
  timestamp: DateTime!
  user: User
}

# 实例变更事件
type InstanceChangeEvent {
  type: ChangeEventType!
  instance: Instance!
  changes: JSON
  timestamp: DateTime!
  user: User
}

# 业务变更事件
type BusinessChangeEvent {
  type: ChangeEventType!
  node: BusinessNode
  association: BusinessInstance
  changes: JSON
  timestamp: DateTime!
  user: User
}

# 审计事件
type AuditEvent {
  log: AuditLog!
  severity: AuditSeverity!
  category: String!
}

# 系统通知
type SystemNotification {
  id: ID!
  type: NotificationType!
  title: String!
  message: String!
  data: JSON
  severity: NotificationSeverity!
  timestamp: DateTime!
}

# 变更事件类型
enum ChangeEventType {
  CREATED
  UPDATED
  DELETED
  MOVED
  ASSOCIATED
  DISASSOCIATED
}

# 审计严重程度
enum AuditSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

# 通知类型
enum NotificationType {
  INFO
  WARNING
  ERROR
  SUCCESS
}

# 通知严重程度
enum NotificationSeverity {
  LOW
  NORMAL
  HIGH
  URGENT
}
```

## 指令定义

```graphql
# 权限检查指令
directive @hasPermission(
  resource: String!
  action: String!
) on FIELD_DEFINITION

# 认证要求指令
directive @authenticated on FIELD_DEFINITION

# 限流指令
directive @rateLimit(
  max: Int!
  window: Int!
) on FIELD_DEFINITION

# 缓存指令
directive @cache(
  maxAge: Int!
  scope: CacheScope = PRIVATE
) on FIELD_DEFINITION

enum CacheScope {
  PUBLIC
  PRIVATE
}
```

## 错误处理

```graphql
# GraphQL 错误扩展
type ErrorExtensions {
  code: String!
  field: String
  details: JSON
}

# 常见错误码
enum ErrorCode {
  UNAUTHENTICATED
  UNAUTHORIZED
  VALIDATION_ERROR
  NOT_FOUND
  CONFLICT
  INTERNAL_ERROR
  RATE_LIMITED
  BAD_USER_INPUT
}
```

## 使用说明

### 认证

所有需要认证的操作都需要在 HTTP 头中提供 JWT token：

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 分页

大多数列表查询都支持基于游标的分页：

```graphql
query {
  models(page: 1, pageSize: 20) {
    edges {
      node {
        id
        name
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

### 错误处理

GraphQL 错误将包含在响应的 `errors` 字段中：

```json
{
  "data": null,
  "errors": [
    {
      "message": "权限不足",
      "locations": [{"line": 2, "column": 3}],
      "path": ["createModel"],
      "extensions": {
        "code": "UNAUTHORIZED",
        "details": {
          "required_permission": "model:create"
        }
      }
    }
  ]
}
```

### 订阅连接

WebSocket 订阅需要在连接时提供认证信息：

```javascript
const wsClient = new WebSocketImpl('ws://localhost:8080/api/v1/graphql/subscriptions', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
});
```