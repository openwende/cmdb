---
title: 资源池与目录
sources:
  - server/internal/core/resource_directory/service.go（目录增删改移、ImportHostsToPool、MoveHostsInPool、GetHostLifecycle）
  - server/internal/core/host_membership/service.go（I1 无游离、I2 池/业务互斥）
  - server/internal/storage/process_template_migrations.go（默认目录）
  - server/internal/mcpserver/query.go（list_pool_directories）
---

# 资源池与目录

## 资源池是什么

资源池存放尚未分配给任何业务的主机，由平台统一管理。资源池里的主机不属于任何业务，也不在任何模块里；业务需要机器时从资源池分配，业务不用的机器再回收到资源池。

一台主机要么在资源池里，要么在业务的模块里，不会同时在两边：每次分配、转移、回收，后端都会在同一个事务里删掉另一边的归属。资源池里的主机只会在一个目录里。

## 资源池目录

资源池按目录树组织，目录有名称和路径（例如 /默认目录），可以多级嵌套。目录一般按用途、地域或规格划分，方便找到合适的备机。list_pool_directories 返回每个目录的 directory_id、名称、路径、是否默认目录（is_default）、主机数（host_count）和其中状态为 running 的主机数（running_count）。

## 默认目录

资源池有一个系统自带的"默认目录"，它不能修改、删除，也不能移动。通过业务拓扑页的"移出"操作或 transfer-to-pool 接口退回资源池的主机，总是进入默认目录；通过回收接口退回时，可以自己选择目录。

## 目录的删除和移动

目录下还有子目录时不能删除，目录下还有主机时也不能删除。目录可以移动到别的目录下，但不能移动到自己或自己的子目录下。

## 资源池内换目录

资源池里的主机可以从一个目录移到另一个目录（界面上的"移动"，接口 /resource-pool/hosts/move）。这在审计里记为类型"转移"，from 和 to 都是"资源池 / 目录名"。这个接口只检查目标目录是否存在，不检查主机原本是否在资源池里（见《主机流转规则》的"后端不做的校验"）。

## 资源池里的主机是否可用

资源池里的主机都没有分配给业务，但不一定都能直接使用：状态为 stopped 的主机处于停机状态，可能有故障或在维护。挑选可分配的备机时，应确认状态为 running，再按需求核对配置：CPU 核数、内存（单位 MB）、磁盘（单位 GB）、操作系统类型和版本。统计"资源池里还有多少台可用"时，要说明是否只算了 running 的主机。
