# 主线模型改造方案

## 背景

当前仓库里同时存在两套能力：

1. 通用动态模型引擎
   - 模型、属性、实例、关系、通用拓扑查询
   - 适合表达任意资源图谱
2. 业务拓扑专用实现
   - `business -> set -> module -> host`
   - 当前由 `sets/modules` 和专用 Topology API 驱动

这两套能力都能工作，但长期并行会带来三个问题：

1. 业务拓扑和动态模型重复建模
2. 前端无法复用统一的元数据能力
3. 后续支持自定义拓扑层级时，需要在专用拓扑代码里继续打补丁

蓝鲸的做法不是“只有普通动态模型”，而是：

1. 有通用模型系统
2. 在其上增加一层主线模型（Mainline）约束
3. 业务拓扑是内置主线模型的一种实例化结果

因此，建议将当前系统演进为：

`通用动态模型引擎 + 主线模型引擎 + 业务拓扑作为内置主线`

## 目标

### 产品目标

1. 业务拓扑继续保持一等公民，不退化为普通关系图
2. 支持未来增加自定义主线层级
3. 前端树、节点信息、主机列表、迁移操作都基于统一元数据运行

### 技术目标

1. 不再长期维护独立的 `sets/modules` 业务语义
2. 主线的父子关系、排序、默认节点、路径、统计由统一引擎保证
3. 保留现有动态模型的开放性，用于非主线模型和实例关系图

## 当前架构判断

### 已有能力

动态模型引擎已经具备这些基础：

1. 模型定义
2. 字段定义
3. 通用实例存储
4. 关联定义
5. 实例关系
6. 递归拓扑查询

但它缺少“主线”专属约束：

1. 哪些模型属于主线
2. 主线模型的唯一父模型
3. 主线层级顺序
4. 主线实例的唯一父实例
5. 默认节点语义
6. 主线树 API
7. 面向拓扑页面的统计和局部刷新语义

### 当前专用拓扑的价值

现有 `Topology API` 已经把前端真正需要的能力定义得比较清楚：

1. 树查询
2. 子节点懒加载
3. 统计
4. 节点创建、更新、删除、移动
5. 主机转移
6. 初始化默认空闲机池

因此不建议直接废掉 Topology API，而是建议：

`保留 Topology API 作为业务语义接口，底层改为 mainline 引擎实现`

## 目标架构

分成三层。

### 第一层：通用动态模型层

职责：

1. 维护模型元数据
2. 维护属性元数据
3. 维护实例数据
4. 维护通用关联关系
5. 提供通用实例检索和关系图查询

适用对象：

1. 主机
2. 网络设备
3. 中间件
4. 数据库
5. 任意自定义资源模型

### 第二层：主线模型层

职责：

1. 定义主线模型集合
2. 定义主线模型父子关系
3. 定义主线层级顺序
4. 维护主线实例树
5. 提供主线树、子节点、路径、移动、排序、统计

适用对象：

1. 业务
2. 集群
3. 模块
4. 未来的自定义拓扑层级

### 第三层：业务拓扑层

职责：

1. 对外暴露 `/api/v1/topology/*`
2. 提供默认空闲机池语义
3. 管理主机与主线节点的关系
4. 为前端输出稳定树结构

适用对象：

1. 业务拓扑页面
2. 主机转移流程
3. 节点详情和编辑页

## 数据模型设计

### 1. 扩展模型定义

建议在现有 `models` 表上增加主线相关字段。

新增字段：

1. `is_mainline bool not null default false`
2. `mainline_parent_model_id uuid null`
3. `mainline_level int null`
4. `mainline_scope varchar(20) not null default 'none'`
5. `is_topology_builtin bool not null default false`

字段语义：

1. `is_mainline`
   - 是否属于主线模型
2. `mainline_parent_model_id`
   - 主线父模型
   - 如 `set -> business`, `module -> set`
3. `mainline_level`
   - 主线深度
   - 业务通常为 0
4. `mainline_scope`
   - `global` / `business` / `none`
   - `business` 表示主线实例天然处于某个业务域下
5. `is_topology_builtin`
   - 标记业务、集群、模块这类系统内置主线模型

约束：

1. 非主线模型的 `mainline_parent_model_id/mainline_level` 必须为空
2. 主线模型最多只能有一个父主线模型
3. `mainline_level` 在主线内唯一

### 2. 新增主线实例表

不建议直接把主线树完全压在通用 `relations` 上。

原因：

1. 主线是树，不是任意图
2. 查询模式固定且高频
3. 需要局部刷新、排序、路径、懒加载、统计

建议新增 `mainline_instances`：

```sql
CREATE TABLE mainline_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES models(id),
    tenant_id UUID NOT NULL,
    business_id UUID NULL,
    parent_instance_id UUID NULL REFERENCES mainline_instances(id),
    instance_id UUID NULL,
    instance_name VARCHAR(200) NOT NULL,
    path LTREE NOT NULL,
    level INT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    extra JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);
```

字段说明：

1. `model_id`
   - 主线节点对应的模型
2. `business_id`
   - 便于按业务隔离查询
3. `parent_instance_id`
   - 主线父节点
4. `instance_id`
   - 可选，指向通用实例层的资源实例
   - 对于“业务/集群/模块”也可以直接用同一个实例 ID
5. `path`
   - 用于快速取子树、路径、祖先
6. `is_default`
   - 空闲机池、空闲模块等系统默认节点
7. `extra`
   - 环境类型、服务类型、描述等拓扑树额外字段

关键约束：

1. 每个非根主线实例必须有 `parent_instance_id`
2. `level` 必须和模型定义的 `mainline_level` 一致
3. 默认节点在同一父节点下不可重复

### 3. 主机与主线节点关系

主机不建议直接当作主线层级的一部分管理。

更合理的做法：

1. 主机是普通动态模型实例
2. 模块是主线叶子节点
3. 主机通过关系表挂到模块

建议保留一张专门关系表：

```sql
CREATE TABLE mainline_node_resources (
    id BIGSERIAL PRIMARY KEY,
    node_id UUID NOT NULL REFERENCES mainline_instances(id),
    resource_id UUID NOT NULL,
    resource_model_id UUID NOT NULL REFERENCES models(id),
    relation_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (node_id, resource_id, relation_type)
);
```

默认 `relation_type` 可以先只支持：

1. `member_of`

如果未来一个主机可属于多个模块，就由这张表自然承载，不需要在树模型里做特殊妥协。

## API 设计

### 保留现有 Topology API 外壳

建议继续保留：

1. `GET /api/v1/topology/tree`
2. `GET /api/v1/topology/nodes/:type/:id/children`
3. `GET /api/v1/topology/statistics`
4. `POST /api/v1/topology/sets`
5. `POST /api/v1/topology/modules`
6. `POST /api/v1/topology/hosts/transfer`
7. `POST /api/v1/topology/businesses/:id/initialize`

原因：

1. 前端已经围绕这些接口建页
2. 这些接口是业务语义，不应强迫前端直接理解主线元模型

### 新增 Mainline API

同时增加底层 API，供未来模型管理页或高级拓扑页使用：

1. `GET /api/v1/mainline/models`
2. `POST /api/v1/mainline/models`
3. `PUT /api/v1/mainline/models/:id`
4. `GET /api/v1/mainline/trees/:business_id`
5. `GET /api/v1/mainline/nodes/:id/children`
6. `GET /api/v1/mainline/nodes/:id/path`
7. `POST /api/v1/mainline/nodes`
8. `PUT /api/v1/mainline/nodes/:id`
9. `DELETE /api/v1/mainline/nodes/:id`
10. `POST /api/v1/mainline/nodes/:id/move`

### 责任边界

1. `dynamic-models`
   - 面向模型和实例通用能力
2. `mainline`
   - 面向主线定义和主线实例
3. `topology`
   - 面向业务拓扑产品能力

## 服务实现建议

### 1. 新增 `internal/core/mainline`

职责：

1. 校验主线模型合法性
2. 创建主线实例
3. 移动主线实例
4. 构建树
5. 计算路径
6. 批量统计子节点资源数量

### 2. `topology.Service` 改为依赖 `mainline.Service`

演进方向：

1. `CreateSet` 不再直接写 `sets`
2. `CreateModule` 不再直接写 `modules`
3. `GetTopologyTree` 由 `mainline` 树构建
4. `TransferHosts` 改写 `mainline_node_resources`

### 3. 动态模型服务不直接承载主线业务规则

原因：

1. 通用动态模型服务不应该知道“业务必须在根层”“模块不能再有模块”这种产品规则
2. 这些规则属于主线引擎

## 初始化策略

系统启动时自动保证存在这些内置模型：

1. `business`
2. `set`
3. `module`
4. `host`

并为前 3 个模型写入主线定义：

1. `business`
   - `is_mainline = true`
   - `mainline_level = 0`
   - `mainline_parent_model_id = null`
2. `set`
   - `is_mainline = true`
   - `mainline_level = 1`
   - `mainline_parent_model_id = business`
3. `module`
   - `is_mainline = true`
   - `mainline_level = 2`
   - `mainline_parent_model_id = set`

`/api/v1/topology/businesses/:id/initialize` 的行为改成：

1. 为业务创建主线根节点
2. 创建默认空闲机池 `set`
3. 创建默认空闲模块 `module`

## 与前端的关系

前端树不应该直接绑定 `set/module` 固化类型表，而应该绑定稳定树节点协议：

1. `node_type`
2. `node_id`
3. `name`
4. `is_default`
5. `expandable`
6. `child_count`
7. `extra`

这样未来新增自定义主线层级时：

1. 树组件不需要重写
2. 只需要扩展节点图标、详情面板和创建表单

## 迁移策略

### 阶段 1：并存

1. 保留现有 `sets/modules` 表
2. 新增 `mainline` 元数据和实例表
3. 新业务优先写 `mainline`
4. `topology/tree` 先支持从 `mainline` 读

### 阶段 2：兼容写

1. `CreateSet/CreateModule` 双写旧表和 `mainline`
2. `TransferHosts` 双写旧关系和新关系
3. 验证前端全链路

### 阶段 3：切主

1. 读路径全面切到 `mainline`
2. 旧表只保留兼容期查询
3. 新增自定义主线层级能力

### 阶段 4：收口

1. 移除 `sets/modules` 专用存储
2. 将 `topology.Service` 完全变成 `mainline.Service` 的产品包装层

## 优先级建议

### P0

1. 定义主线元模型字段
2. 落地 `mainline_instances`
3. 初始化内置 `business/set/module`
4. 让 `GET /api/v1/topology/tree` 改读 `mainline`

### P1

1. 主机与模块关系切到 `mainline_node_resources`
2. 支持 `children/path/move/statistics`
3. 前端树改为保留完整节点元数据

### P2

1. 自定义主线层级
2. 主线模型管理页
3. 更细粒度权限与模板联动

## 最终结论

正确的演进方向不是：

1. 继续把业务拓扑长期固化在 `sets/modules`
2. 也不是直接把业务拓扑退化成普通动态关系图

而是：

**以动态模型为底座，引入主线模型层，让业务拓扑成为内置默认主线。**

这条路既能保留业务拓扑的稳定产品语义，也能和你原来设计的动态模型引擎合流。
