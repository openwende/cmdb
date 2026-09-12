# CMDB P0 规划与研发任务单

## 1. 背景

本文档用于沉淀当前 `wende-cmdb` 在对标 bk-cmdb 核心能力后的 P0 建设规划，目标是让系统具备一个可成立的 CMDB 核心闭环，而不是停留在业务列表、固定拓扑和基础录入阶段。

本轮 P0 只覆盖最核心的 6 个能力：

1. 可配置业务拓扑 / 主线层级
2. 模型关系 + 关联类型
3. 唯一校验规则
4. 动态分组规则引擎
5. 业务自定义字段
6. 实例关系 / 实例历史闭环

## 2. 现状判断

当前项目已经有一部分底座，但核心能力仍未闭环：

- 后端已有动态模型、实例、关系、历史、主线实例、拓扑、模板、资源池等基础结构。
- 前端已有业务拓扑、模型管理、资源管理、分析页等入口。
- 但很多关键页面仍是占位或 mock，尤其是：
  - 模型关系、唯一校验、历史、导入导出
  - 动态分组
  - 资源池目录与主机运营
  - 审计与统计

P0 的目标不是一次补齐全部 bk-cmdb 能力，而是先把 “拓扑 + 模型 + 规则 + 实例” 这条主链路打通。

## 3. P0 范围

### 3.1 P0 能力目标

| 模块                      | P0 目标                                                      |
| ------------------------- | ------------------------------------------------------------ |
| 可配置业务拓扑 / 主线层级 | 业务拓扑不再写死为固定层级，支持主线模型驱动树结构和节点管理 |
| 模型关系 + 关联类型       | 支持定义模型之间允许建立什么关系、约束是什么、实例如何建关系 |
| 唯一校验规则              | 支持默认唯一、联合唯一、辅助唯一，实例写入前能够校验冲突     |
| 动态分组规则引擎          | 支持按主机/集群/模块等条件预览、保存、编辑动态分组           |
| 业务自定义字段            | 支持在业务维度为集群/模块/主机扩展字段和字段组               |
| 实例关系 / 实例历史闭环   | 实例详情中能看到关系和变更历史，并支持维护关系               |

### 3.2 非 P0 范围

以下能力不进入本轮 P0：

- 服务模板 / 集群模板 / 服务分类完整闭环
- 主机自动应用
- 资源池完整运营闭环
- 业务集动态范围
- 审计统计大盘
- 云资源同步
- 全局配置完整平台化
- 字段组合模板
- 事件订阅 / Webhook
- 全局搜索

## 4. P0 模块规划

### 4.1 可配置业务拓扑 / 主线层级

#### 目标

- 业务拓扑按主线模型元数据驱动，不再只支持固定 `业务 -> 集群 -> 模块`
- 支持创建、编辑、移动、删除主线节点
- 支持拓扑最大层级限制

#### 数据库

- 新建 `platform_settings`
- 改造 `models`
- 改造 `mainline_instances`

#### API

- `GET /api/v1/mainline/models`
- `POST /api/v1/mainline/models`
- `PUT /api/v1/mainline/models/:uid`
- `GET /api/v1/mainline/tree?business_id=:id`
- `POST /api/v1/mainline/nodes`
- `PUT /api/v1/mainline/nodes/:id`
- `DELETE /api/v1/mainline/nodes/:id`
- `POST /api/v1/mainline/nodes/:id/move`
- `GET /api/v1/platform-settings/topology`

#### 前端

- 新增“拓扑层级配置”页面
- 改造业务拓扑树为元数据驱动渲染
- 节点创建/编辑表单按模型 schema 动态生成

#### 验收

- 可以新增一个自定义层级模型
- 可以在业务拓扑中创建该层级的节点
- 节点可移动、编辑、删除

### 4.2 模型关系 + 关联类型

#### 目标

- 支持定义模型之间的关系类型、方向、约束
- 支持实例基于模型关系创建具体关联

#### 数据库

- 改造 `association_types`
- 改造 `model_associations`
- 改造 `relations`

#### API

- `GET /api/v1/association-types`
- `POST /api/v1/association-types`
- `PUT /api/v1/association-types/:uid`
- `DELETE /api/v1/association-types/:uid`
- `GET /api/v1/dynamic-models/:uid/associations`
- `POST /api/v1/dynamic-models/:uid/associations`
- `PUT /api/v1/dynamic-models/:uid/associations/:id`
- `DELETE /api/v1/dynamic-models/:uid/associations/:id`
- `GET /api/v1/dynamic-models/:uid/available-relations`
- `POST /api/v1/dynamic-models/relations`
- `DELETE /api/v1/dynamic-models/relations/:id`

#### 前端

- 新增“关联类型管理”页
- 模型详情页接入“关系设计”
- 实例详情页接入关系查看和关系维护

#### 验收

- 能定义 “服务 runs_on 主机”
- 能在实例详情中新增和删除对应关系

### 4.3 唯一校验规则

#### 目标

- 支持默认唯一
- 支持联合唯一
- 支持辅助唯一
- 实例写入前能明确返回冲突信息

#### 数据库

- 新建 `model_unique_rules`
- 新建 `model_unique_rule_fields`
- 改造 `resources` 查询索引

#### API

- `GET /api/v1/dynamic-models/:uid/unique-rules`
- `POST /api/v1/dynamic-models/:uid/unique-rules`
- `PUT /api/v1/dynamic-models/:uid/unique-rules/:id`
- `DELETE /api/v1/dynamic-models/:uid/unique-rules/:id`
- `POST /api/v1/dynamic-models/:uid/validate-unique`

#### 前端

- 模型详情页接入“唯一校验”页签
- 实例保存前接预校验
- 冲突实例展示冲突规则和冲突对象

#### 验收

- 能为模型新增联合唯一规则
- 冲突实例保存时被拒绝并返回冲突明细

### 4.4 动态分组规则引擎

#### 目标

- 支持按主机/集群/模块动态圈选资源
- 支持预览、保存、编辑、删除
- 分组结果基于条件动态变化

#### 数据库

- 新建 `dynamic_groups`

#### API

- `GET /api/v1/businesses/:bizId/dynamic-groups`
- `POST /api/v1/businesses/:bizId/dynamic-groups`
- `GET /api/v1/businesses/:bizId/dynamic-groups/:id`
- `PUT /api/v1/businesses/:bizId/dynamic-groups/:id`
- `DELETE /api/v1/businesses/:bizId/dynamic-groups/:id`
- `POST /api/v1/businesses/:bizId/dynamic-groups/preview`
- `GET /api/v1/businesses/:bizId/dynamic-groups/meta`

#### 前端

- 现有动态分组页面去 mock 化
- 条件编辑器改用后端返回元数据
- 补齐预览、保存、详情、编辑、删除

#### 验收

- 能按主机属性和模块属性组合条件保存动态分组
- 保存前能预览命中的实例列表

### 4.5 业务自定义字段

#### 目标

- 支持业务维度为 `set/module/host` 配置字段组和字段
- 支持默认折叠和排序
- 节点表单动态感知业务字段

#### 数据库

- 新建 `business_custom_field_groups`
- 新建 `business_custom_fields`

#### API

- `GET /api/v1/businesses/:bizId/custom-fields?object_type=`
- `POST /api/v1/businesses/:bizId/custom-field-groups`
- `PUT /api/v1/businesses/:bizId/custom-field-groups/:id`
- `DELETE /api/v1/businesses/:bizId/custom-field-groups/:id`
- `POST /api/v1/businesses/:bizId/custom-fields`
- `PUT /api/v1/businesses/:bizId/custom-fields/:id`
- `DELETE /api/v1/businesses/:bizId/custom-fields/:id`
- `GET /api/v1/businesses/:bizId/form-schema/:objectType`

#### 前端

- 新增“业务自定义字段”页面
- 集群/模块/主机表单改为读取聚合 schema

#### 验收

- 某业务下新增的模块字段，仅对该业务的模块生效
- 表单能按字段组顺序和折叠规则展示

### 4.6 实例关系 / 实例历史闭环

#### 目标

- 实例详情可查看关系
- 实例详情可查看变更历史
- 实例关系维护与模型关系规则联动

#### 数据库

- 改造 `relations`
- 改造 `resource_histories`

#### API

- `GET /api/v1/dynamic-models/:uid/instances/:id`
- `GET /api/v1/dynamic-models/:uid/instances/:id/relations`
- `GET /api/v1/dynamic-models/:uid/instances/:id/topology`
- `GET /api/v1/dynamic-models/:uid/instances/:id/history`
- `POST /api/v1/dynamic-models/relations`
- `DELETE /api/v1/dynamic-models/relations/:id`

#### 前端

- 实例详情页接入“关联”和“历史”页签
- 展示 before/after 变更内容

#### 验收

- 任意实例更新后可查询历史记录
- 任意实例可新增和解除符合规则的关联

## 5. P0 数据库设计

### 5.1 新增表

| 表名                           | 用途               |
| ------------------------------ | ------------------ |
| `platform_settings`            | 存平台级拓扑配置   |
| `model_unique_rules`           | 模型唯一规则定义   |
| `model_unique_rule_fields`     | 唯一规则字段明细   |
| `dynamic_groups`               | 动态分组定义和 DSL |
| `business_custom_field_groups` | 业务字段组         |
| `business_custom_fields`       | 业务字段定义       |

### 5.2 改造表

| 表名                 | 改造点                                                                   |
| -------------------- | ------------------------------------------------------------------------ |
| `models`             | 增加拓扑行为字段，如 `allow_manual_create`、`allow_move`、`max_children` |
| `mainline_instances` | 增加业务内唯一映射索引、父子查询索引                                     |
| `association_types`  | 增加 `is_directed`、排序、软删除                                         |
| `model_associations` | 增加 `is_builtin`、`is_disabled`、排序、软删除                           |
| `relations`          | 增加实例关系唯一索引                                                     |
| `resource_histories` | 增加按资源、模型、时间维度索引                                           |
| `resources`          | 保持 JSONB 存储，补查询索引                                              |

### 5.3 必须落的约束

| 约束                                   | 目的                           |
| -------------------------------------- | ------------------------------ |
| `uk_mainline_business_model_ref`       | 防止同一业务下节点重复映射     |
| `uk_model_associations_active`         | 防止重复定义模型关系           |
| `uk_relations_unique_edge`             | 防止重复创建实例关系           |
| `uk_model_unique_rules_default_active` | 每个模型只能有一条默认唯一规则 |
| `uk_dynamic_groups_biz_name_active`    | 同一业务下动态分组名唯一       |
| `uk_business_custom_fields_uid_active` | 同一业务对象类型字段标识唯一   |

## 6. P0 API 规划

### 6.1 统一响应格式

成功：

```json
{
  "success": true,
  "data": {},
  "message": "ok"
}
```

失败：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "参数错误",
    "details": {}
  }
}
```

### 6.2 错误码

| code                         | 含义                |
| ---------------------------- | ------------------- |
| `VALIDATION_ERROR`           | 参数错误            |
| `NOT_FOUND`                  | 资源不存在          |
| `CONFLICT`                   | 唯一冲突 / 状态冲突 |
| `FORBIDDEN_OPERATION`        | 禁止的操作          |
| `RELATION_CONSTRAINT_FAILED` | 关系约束不满足      |
| `UNIQUE_RULE_VIOLATION`      | 唯一规则校验失败    |
| `TOPOLOGY_LIMIT_EXCEEDED`    | 超出拓扑最大层级    |
| `INTERNAL_ERROR`             | 服务内部错误        |

### 6.3 接口开发优先顺序

先读后写：

1. `GET /api/v1/mainline/models`
2. `GET /api/v1/mainline/tree`
3. `GET /api/v1/association-types`
4. `GET /api/v1/dynamic-models/:uid/associations`
5. `GET /api/v1/dynamic-models/:uid/unique-rules`
6. `GET /api/v1/businesses/:bizId/dynamic-groups/meta`
7. `POST /api/v1/businesses/:bizId/dynamic-groups/preview`
8. `GET /api/v1/businesses/:bizId/form-schema/:objectType`
9. `GET /api/v1/dynamic-models/:uid/instances/:id/history`
10. 再补所有写接口

这样前端可以先切真实读接口，再逐步接写操作。

## 7. P0 研发任务拆解

### 7.1 后端任务

| 任务 ID    | 任务名称               | 说明                                           |
| ---------- | ---------------------- | ---------------------------------------------- |
| `BE-P0-01` | 主线模型与拓扑树 API   | 主线模型 CRUD、拓扑树查询、节点 CRUD、节点移动 |
| `BE-P0-02` | 关联类型与模型关系 API | 关联类型 CRUD、模型关系 CRUD、规则校验         |
| `BE-P0-03` | 唯一规则与实例校验     | 唯一规则表、实例写入校验、预校验接口           |
| `BE-P0-04` | 动态分组规则引擎       | 元数据接口、预览接口、分组 CRUD                |
| `BE-P0-05` | 业务自定义字段         | 字段组、字段、业务表单 schema 聚合接口         |
| `BE-P0-06` | 实例关系与实例历史     | 详情、关系、拓扑、历史查询补齐                 |

### 7.2 前端任务

| 任务 ID    | 任务名称                   | 说明                                          |
| ---------- | -------------------------- | --------------------------------------------- |
| `FE-P0-01` | 拓扑树改造为主线元数据驱动 | 业务拓扑不再写死集群/模块层级                 |
| `FE-P0-02` | 模型关系设计页             | 模型详情页接入关系设计能力                    |
| `FE-P0-03` | 唯一规则配置页             | 模型唯一校验管理和实例冲突提示                |
| `FE-P0-04` | 动态分组真实联调           | 去 mock、接 meta/preview/create/update/delete |
| `FE-P0-05` | 业务动态 schema 表单       | 业务级字段配置页和节点编辑表单联动            |
| `FE-P0-06` | 实例详情关联/历史页        | 模型实例详情接入关系和历史                    |

### 7.3 联调顺序

1. 后端先完成所有读接口
2. 前端切换到真实读接口
3. 后端补单对象写接口
4. 前端接创建/编辑/删除
5. 后端补移动、预览、约束校验
6. 前端补复杂流程和错误提示
7. 统一做端到端回归

## 8. 迭代建议

### Sprint 1：元数据层

- 主线模型与拓扑树查询
- 关联类型 CRUD
- 模型关系 CRUD
- 唯一规则表与校验逻辑

### Sprint 2：业务配置层

- 动态分组 `meta / preview / create`
- 业务自定义字段管理
- 业务拓扑表单按 schema 动态渲染

### Sprint 3：实例运行层

- 实例关系
- 实例历史
- 动态分组编辑/删除
- 拓扑节点移动/删除
- 前后端联调回归

## 9. 验收清单

| 模块           | 验收标准                                               |
| -------------- | ------------------------------------------------------ |
| 业务拓扑       | 新增自定义层级节点并在拓扑中完成创建、编辑、移动、删除 |
| 模型关系       | 定义一条模型关系并在实例详情中建立具体关系             |
| 唯一校验       | 联合唯一冲突时接口明确拒绝并返回冲突实例               |
| 动态分组       | 使用多模型字段条件预览并保存动态分组                   |
| 业务自定义字段 | 新增业务模块字段后仅在该业务模块表单中生效             |
| 实例历史       | 实例更新后能查询到 before / after 历史记录             |

## 10. 实施原则

1. 复用现有 `dynamic_models / resources / relations / mainline_instances` 底座，不推翻重建
2. 规则优先走应用层执行，避免过早为动态规则设计复杂数据库约束
3. 前端统一消费后端元数据，不在前端写死拓扑层级、字段、关系、动态分组条件定义
4. 先读后写，先单对象后批量，先规则正确再优化性能

## 11. 后续工作

P0 完成后，下一阶段进入 P1：

- 服务模板 / 集群模板 / 服务分类
- 主机自动应用
- 资源池完整运营闭环
- 业务集动态范围
- 审计与运营统计
