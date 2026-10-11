---
title: 主机内置字段
sources:
  - wende-cmdb-backend/internal/types/host.go
  - wende-cmdb-backend/migrations/20260530130000_canonical_init.up.sql（hosts 表、CHECK 约束、唯一索引）
  - wende-cmdb-backend/internal/storage/host_repository.go（自定义字段合并更新、软删除）
  - wende-cmdb-backend/internal/api/handlers/host_handler.go（mark_destroyed）
  - wende-cmdb-backend/internal/mcpserver/query.go、tools.go（search_hosts / get_host 输出字段）
  - wende-cmdb-backend/docs/HOST_IMPORT_GUIDE.md（字段说明，已按代码修正）
---

# 主机内置字段

## 主机标识

每台主机有两个 ID：内部的 UUID 和对外展示的整数 ID（display_id）。MCP 工具里的 host_id、审计记录里的主机 ID 都是这个整数展示 ID，引用主机时用它；UUID 只在 get_host 的 uuid 字段里出现，一般不需要。主机名（host_name）和主 IP（primary_ip）是人最常用的识别方式，但主机名不保证唯一。

## IP 和管控区域

主机有一个主 IP（primary_ip），还可以有多个 IP（ip_addresses）。管控区域（cloud_area）用来隔离网络：不同管控区域里可以有相同的 IP，同一个管控区域里，未删除、未销毁的主机主 IP 不能重复。所以只凭 IP 定位主机时，理论上可能命中不同管控区域的多台主机，需要结合管控区域区分。

## 云厂商和云主机信息

cloud_vendor 表示主机来源，取值为 aws、tencent_cloud（腾讯云）、aliyun（阿里云）、custom（自建机房）。云主机还可以有云实例 ID（cloud_instance_id）、地域（cloud_region）、VPC 和子网。同一云厂商下，云实例 ID 不能重复。手动录入的主机这些字段可以为空。

## 硬件配置字段和单位

- cpu：CPU 核数。
- memory：内存，单位是 MB。例如 16G 内存存的是 16384，32G 是 32768。MCP 的 search_hosts、get_host 里字段名是 memory_mb；审计配置变更里字段名是 memory，值同样是 MB。
- disk_size：磁盘容量，单位是 GB。MCP 里字段名是 disk_gb。
- os_type：操作系统类型，只有 linux 和 windows 两种。
- os_version：操作系统版本，自由文本，例如某个 Ubuntu 或 CentOS 版本号。

## 主机状态

主机状态（status）只有三种取值：running（运行中）、stopped（已停止）、terminated（已终止），新录入的主机默认是 running。状态需要人工修改，系统不会因为主机进了故障机或资源池而自动改状态；状态变化在审计里是一条配置变更（字段 status）。约定上，主机出故障时改为 stopped，修好后改回 running（见《拓扑与空闲机池》的"故障机模块"）。

## 删除和销毁主机

删除主机有两种方式：默认是标记为已销毁（is_destroyed），记录保留，表示这台机器已经不存在（例如云主机已释放）；也可以软删除，记录从正常查询里消失。两种方式都会写一条 delete 审计记录，config 里是删除前的配置。

标记为已销毁的主机仍会出现在 search_hosts、get_host 的结果里，而且结果里没有"是否已销毁"这个字段，看起来和正常主机一样；要判断一台主机是否已被删除或销毁，可以查它的审计里有没有 delete 记录。删除也不会去掉主机的模块归属，这会影响业务和模块的主机数（见《拓扑与空闲机池》的"主机数的统计口径"）。

## 自定义字段的存储方式

除了内置字段，每台主机还有一组自定义字段（custom_fields），是自由的键值对，没有统一的字段定义或格式校验：同一个字段名在不同主机上的值类型理论上可以不一样。更新自定义字段是"合并"：只修改提交的字段，其他字段保持原样，所以通过这个接口删不掉一个字段，只能改它的值。自定义字段变化在审计里显示为 custom_fields.<字段名>，例如 custom_fields.备份。各字段的含义见《自定义字段约定》。
