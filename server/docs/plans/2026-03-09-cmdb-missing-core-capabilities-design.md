# CMDB缺失核心功能与业务逻辑设计文档

日期：2026-03-09

适用仓库：
- 后端：`~/Projects/wende-cmdb-backend`
- 前端：`~/Projects/wende-cmdb`
- 参考基线：`~/Projects/bk-cmdb`

## 1. 文档目标

本文档基于当前双仓源码，对照 `bk-cmdb` 的成熟能力结构，重新梳理当前系统在 `模型-拓扑-实例-关系-资源池` 五条主链路上的 P0 缺失点，并给出对应的：

- 缺失核心模块
- 后端 API 与业务逻辑设计
- 前端数据状态管理、路由流转与组件通信方案

本文档不讨论 UI/UX 视觉布局，不复刻 `bk-cmdb` 的页面结构，仅讨论抽象能力闭环和前后端协作边界。

## 2. 范围与非范围

### 2.1 本文范围

- 模型元数据中心
- 主线拓扑与节点管理
- 资源实例与拓扑挂载
- 模型关系与实例关系
- 资源池目录、库存主机、分配与回收

### 2.2 非本文范围

- RBAC / IAM / 审计平台
- 事件订阅 / Webhook
- 云资源同步
- 自动发现 / Agent 上报
- 全文搜索
- 运营统计大盘

## 3. 评估方法

本次评估只以当前源码为事实来源，历史文档仅作为参考，不作为是否“已实现”的判断依据。

### 3.1 缺失分级

- `L1 完全缺失`：模型、服务、接口、前端入口均不存在
- `L2 骨架存在但业务未闭环`：已有表结构或 API，但缺校验、状态迁移、聚合结果或跨模块联动
- `L3 后端已具备但前端未接通`：后端真实能力已存在，前端仍依赖占位、mock 或分散状态

### 3.2 对标原则

- 保留 `bk-cmdb` 的能力结构，不复刻其页面组织和对象耦合方式
- 保留主线拓扑、模型驱动、关系设计、唯一规则、资源池分离这些成熟能力
- 不继承其历史兼容包袱、隐式规则和重对象耦合实现

## 4. 设计原则

### 4.1 模型定义、拓扑挂载、资源归属三层解耦

- 模型层定义对象、字段、唯一规则、关系规则
- 拓扑层定义业务主线中的父子结构、节点动作和挂载位置
- 资源池层定义库存目录、分配状态、回收状态

### 4.2 后端负责规则闭环，前端负责状态编排

- 后端输出 schema、allowed_actions、constraints、impact_summary、conflict_details
- 前端只消费这些能力结果，不在页面组件里硬编码业务规则

### 4.3 P0 优先完成真实闭环

- 有页面不等于有能力
- 有路由不等于可落业务
- P0 只保留能串成最短业务闭环的能力

### 4.4 统一用能力声明驱动前端

前端的可创建、可编辑、可移动、可挂载、可分配、可建关系等能力，都应由后端下发，而不是由组件根据对象类型自行推断。

## 5. 当前总体判断

当前项目五大模块并非从零开始，主要状态如下：

- 模型层：已有动态模型、字段、唯一规则、关系设计底座，但尚未成为全局 schema 中心
- 拓扑层：已有固定拓扑和主线拓扑两套能力，处于双轨并存状态
- 实例层：已有动态模型实例详情、关系、历史、拓扑接口，但业务拓扑中的服务实例仍未接通
- 关系层：模型关系和实例关系接口已存在，但约束透传和场景化维护未闭环
- 资源池层：目录、库存主机、分配回收接口已存在，前端仍以 mock 驱动为主

P0 排序建议：

1. 统一拓扑内核
2. 统一实例详情闭环
3. 统一关系约束透传
4. 统一资源池生命周期状态
5. 模型元数据下沉为全局驱动源

## 6. 拓扑模块设计

### 6.1 现状判断

- 后端同时存在固定拓扑和主线模型路由
- 前端已有主线模型 store 和树适配层
- 业务拓扑主入口仍主要围绕传统 `set/module/host` 视角运行

### 6.2 核心缺失

- `L2` 缺统一拓扑节点协议
- `L2` 缺节点动作能力下发
- `L2` 缺主线节点统一表单 schema
- `L2` 缺拓扑与资源挂载的统一聚合结果

### 6.3 P0 目标

将业务拓扑收敛为一套主线驱动拓扑内核，使 `业务-集群-模块` 只是默认主线模型的一个特例。

### 6.4 后端设计

新增 `Topology Aggregate Service`，统一输出面向前端的拓扑协议。

建议接口：

- `GET /api/v1/topology/tree`
- `GET /api/v1/topology/nodes/:nodeId`
- `POST /api/v1/topology/nodes`
- `PATCH /api/v1/topology/nodes/:nodeId`
- `POST /api/v1/topology/nodes/:nodeId/move`
- `DELETE /api/v1/topology/nodes/:nodeId`

统一返回：

- 节点基础信息
- `model_uid`
- `path`
- `statistics`
- `allowed_actions`
- `form_schema_ref`
- `binding_summary`

### 6.5 前端设计

建议增加以下状态层：

- `TopologySceneStore`：树数据、当前节点、树版本号、动作上下文
- `MainlineMetaStore`：主线模型元数据与拓扑配置
- `NodeDetailStore`：节点详情、表单 schema、allowed_actions、摘要信息

推荐流转：

1. 路由进入业务拓扑页
2. `TopologySceneStore` 拉取树
3. 用户选择节点，仅更新 `selectedNodeId`
4. `NodeDetailStore` 根据 `selectedNodeId` 拉聚合详情
5. HostList / ServiceInstance / NodeInfo 只消费统一详情结果

### 6.6 验收标准

- 拓扑树只基于统一节点协议渲染
- 新增主线模型后可直接创建对应节点
- 创建、移动、删除能力全部由后端 `allowed_actions` 控制

## 7. 实例模块设计

### 7.1 现状判断

- 动态模型实例接口已经支持详情、关系列表、历史、拓扑图
- 模型页已有实例工作台
- 业务拓扑里的服务实例和进程实例仍大量依赖 mock

### 7.2 核心缺失

- `L2` 缺统一实例身份模型
- `L2` 缺统一实例详情协议
- `L2` 缺实例挂载规则
- `L3` 缺实例主视图统一入口

### 7.3 P0 目标

建立统一资源实例域，明确：

- `Resource Instance`
- `Topology-bound Instance`
- `Service Runtime Instance`

P0 先闭环前两层，第三层至少完成真实接口与空态返回。

### 7.4 后端设计

新增 `Instance Aggregate Service`。

建议接口：

- `GET /api/v1/instances`
- `GET /api/v1/instances/:instanceKey`
- `POST /api/v1/instances`
- `POST /api/v1/instances/:instanceKey/bind-topology`
- `POST /api/v1/instances/:instanceKey/unbind-topology`
- `GET /api/v1/instances/:instanceKey/workload`

统一返回：

- 基础属性
- 模型摘要
- `binding_context`
- 关系摘要
- 历史摘要
- `allowed_actions`

### 7.5 前端设计

建议增加以下状态层：

- `InstanceSceneStore`：当前实例、详情缓存、关系分页、历史分页、拓扑摘要
- `ModelInstanceStore`：模型页上下文
- `TopologyInstanceStore`：拓扑页上下文

推荐流转：

1. 从模型页或拓扑页选中实例
2. 统一进入 `instanceKey` 驱动的详情流
3. 详情区先拉主详情，再并发拉关系、历史、workload

### 7.6 验收标准

- 同一实例可从模型页和拓扑页进入同一详情协议
- 服务实例页不再依赖 mock
- 实例创建后可明确选择是否挂载拓扑节点

## 8. 关系模块设计

### 8.1 现状判断

- 后端已有关联类型、模型关系、实例关系接口
- 前端模型关系设计页已接通
- 实例工作台已有 relations tab

### 8.2 核心缺失

- `L2` 缺关系元模型统一解释
- `L2` 缺模型关系到实例关系的约束透传
- `L2` 缺方向性与角色语义
- `L2` 缺删除/解绑影响分析
- `L2` 缺关系主视图

### 8.3 P0 目标

建立三层关系闭环：

- `Association Type`
- `Model Association`
- `Instance Relation`

### 8.4 后端设计

新增 `Relation Aggregate Service`。

建议接口：

- `GET /api/v1/relation-types`
- `GET /api/v1/dynamic-models/:uid/relation-capabilities`
- `GET /api/v1/dynamic-models/:uid/instances/:id/relation-capabilities`
- `GET /api/v1/instances/:instanceKey/relation-capabilities`
- `POST /api/v1/instances/:instanceKey/relations`
- `DELETE /api/v1/instances/:instanceKey/relations/:relationId`
- `POST /api/v1/dynamic-models/:uid/relations/validate`

统一返回：

- `allowed_actions`
- `constraints`
- `candidate_targets`
- `conflict_details`
- `impact_summary`

### 8.5 前端设计

建议增加以下状态层：

- `ModelRelationStore`：模型关系设计
- `InstanceRelationStore`：实例关系维护

推荐流转：

1. 模型页加载 `relation-capabilities`
2. 实例页加载“现有关系列表 + 可创建关系能力”
3. 删除关系前先拉影响摘要

### 8.6 验收标准

- 模型页和实例页对同一关系规则的解释一致
- 实例关系创建失败时可展示结构化冲突原因
- 删除关系前可展示影响分析

## 9. 资源池模块设计

### 9.1 现状判断

- 后端已有目录 CRUD、目录树、库存主机、分配回收接口
- 前端目录树和主机列表仍以 mock 和本地状态为主

### 9.2 核心缺失

- `L2` 缺统一资源状态机
- `L2` 缺目录对象与业务挂载对象的边界
- `L2` 缺分配/回收链路标准返回
- `L3` 缺目录树与主机列表联动状态中心
- `L2` 缺资源池与拓扑联动协议

### 9.3 P0 目标

将资源池定义为库存生命周期中心，而不是另一棵业务树。

### 9.4 后端设计

新增 `Resource Pool Aggregate Service`。

建议接口：

- `GET /api/v1/resource-pool/directories/tree`
- `GET /api/v1/resource-pool/hosts`
- `POST /api/v1/resource-pool/hosts/allocate`
- `POST /api/v1/resource-pool/hosts/reclaim`
- `POST /api/v1/resource-pool/hosts/move`
- `GET /api/v1/resource-pool/hosts/:id/lifecycle`

统一状态：

- `in_pool`
- `allocating`
- `allocated`
- `bound_to_topology`
- `reclaiming`

### 9.5 前端设计

建议增加以下状态层：

- `ResourcePoolSceneStore`：当前目录、目录树、选中主机、动作上下文
- `DirectoryStore`：目录树缓存与计数
- `PoolHostStore`：主机列表、分页、生命周期详情

推荐流转：

1. 进入资源池页先拉目录树
2. 选中目录后自动刷新库存主机列表
3. 分配/回收成功后同时刷新目录计数和主机列表

### 9.6 验收标准

- 目录树和主机表来自真实 API
- 目录、分配、回收、目录内移动边界清晰
- 单台主机能明确看到库存归属、业务归属、拓扑挂载位置

## 10. 模型模块设计

### 10.1 现状判断

- 后端已有模型、字段、唯一规则、关系设计能力
- 前端已有字段设计、唯一规则、关系设计、实例页
- 模型元数据尚未真正驱动拓扑、实例、关系、资源池四类消费场景

### 10.2 核心缺失

- `L2` 缺统一模型 schema 协议
- `L2` 缺字段分类与消费边界
- `L2` 缺模型驱动下游能力
- `L2` 缺模型能力声明
- `L2` 缺模型变更影响预检

### 10.3 P0 目标

将模型层升级为全局 schema 中心，而不是单纯的模型管理后台。

### 10.4 后端设计

新增 `Model Schema Service`。

建议接口：

- `GET /api/v1/dynamic-models/:uid/schema`
- `GET /api/v1/dynamic-models/:uid/form-schema?scene=...`
- `POST /api/v1/dynamic-models/:uid/schema/validate-change`
- `GET /api/v1/dynamic-models/:uid/capabilities`
- `GET /api/v1/dynamic-models/schema-bundle`

统一字段分类：

- `base_field`
- `business_override_field`
- `state_field`
- `computed_field`
- `relation_virtual_field`

### 10.5 前端设计

建议增加以下状态层：

- `SchemaCenterStore`：统一缓存 schema、form schema、能力声明
- `ModelManageStore`：模型页编辑态

消费方式：

- 拓扑节点创建使用 `scene=topology_create`
- 实例创建/编辑使用 `scene=instance_create|instance_edit`
- 资源池列表字段和筛选项来自主机模型 schema
- 关系设计页的候选能力来自模型 schema

### 10.6 验收标准

- 拓扑节点、实例创建、实例编辑都由统一 form schema 驱动
- 模型能力声明可直接驱动前端入口展示
- 业务自定义字段可并入统一 schema 消费

## 11. P0 实施顺序建议

### 11.1 第一阶段

- 统一拓扑节点协议
- 建立统一实例详情协议

### 11.2 第二阶段

- 关系能力透传
- 资源池状态机和真实前端接入

### 11.3 第三阶段

- 构建 schema 中心
- 将拓扑、实例、关系、资源池全部切换到 schema 驱动

## 12. 设计结论

当前项目 P0 的核心问题不是“没有这些模块”，而是：

- 多条主链路已经有后端底座，但前端与聚合服务尚未收敛
- 关键能力还停留在“接口存在”而非“业务闭环成立”
- 模型层尚未上升为统一驱动源，导致拓扑、实例、关系、资源池各自建规则

P0 的正确方向不是继续增加零散页面或补单点 CRUD，而是优先完成：

1. 拓扑统一协议
2. 实例统一详情
3. 关系统一约束透传
4. 资源池统一状态机
5. 模型统一 schema 中心

这五项完成后，系统才具备一个可成立的 CMDB 主链路闭环。
