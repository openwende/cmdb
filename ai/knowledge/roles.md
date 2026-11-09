---
title: 角色与权限
sources:
  - server/internal/types/auth.go、internal/auth/middleware.go（ProtectAPI）
  - server/internal/api/server/server.go（/auth/users 仅管理员、/mcp 挂载位置）
  - server/internal/core/auth/service.go（管理员不能停用或降级自己）
  - server/internal/core/business/service.go（业务人员角色）
  - server/internal/mcpserver/server.go、tools.go（只读工具）
  - web/src/store/AuthStore.ts、src/locales/zh-CN.json
---

# 角色与权限

## 系统角色

CMDB 的登录用户有三种固定角色：

- 管理员（admin）：可以做所有操作，包括管理用户账号。管理员不能停用自己，也不能取消自己的管理员角色。
- 编辑者（editor）：可以查看和修改所有数据，包括新建、编辑、删除业务、集群、模块和主机，以及分配、转移、回收主机；但不能管理用户账号。
- 只读用户（viewer）：只能查看，不能做任何修改；界面上的修改按钮会被隐藏或置灰，提示"权限不足，无法操作"。

权限只按角色区分，没有按业务划分：编辑者可以修改任何业务的数据，不只是自己负责的业务。

## 业务人员角色

业务人员角色和系统角色是两回事。业务人员是登记在每个业务上的联系人，角色有四种：sre（运维）、developer（开发）、tester（测试）、bizops（业务运营）。它只用来记录"这个业务找谁"，不控制任何权限：登记为某业务的 sre，并不代表能修改这个业务，能不能修改只看系统角色。search_businesses 的结果里 contacts 按"角色: 联系人"列出业务人员。

## 调查助手的权限

调查助手（AI）只能查询，不能修改任何数据：它能用的 CMDB 工具全部是只读的。助手用提问者本人的登录身份查询 CMDB，所以只读用户也能使用助手，助手看到的范围和提问者本人在界面上能看到的一致。需要转移、回收、修改配置时，应由有编辑权限的人在 CMDB 界面上操作；助手可以说明应该怎么做和有什么风险，但不会替用户执行。

## 权限和审计的关系

只读用户不能修改数据，所以审计里任何变更记录的操作人，都只会是编辑者、管理员，或者没有登录用户的系统操作（记为 system）。一个人能做某个操作（有编辑权限），不代表这个操作经过了审批：系统没有审批流程，编辑者可以直接回收、转移任何业务的主机，审计只记录事后的结果。
