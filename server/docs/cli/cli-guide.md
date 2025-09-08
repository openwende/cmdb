# CLI 使用指南

WEND CMDB CLI 工具提供了命令行界面来管理和操作 CMDB 系统，支持模型管理、实例操作、业务拓扑管理等功能。

## 安装和配置

### 安装

```bash
# 从源码构建
go build -o bin/cmdb cmd/cli/main.go

# 安装到系统路径
sudo cp bin/cmdb /usr/local/bin/

# 验证安装
cmdb version
```

### 初始配置

```bash
# 初始化配置文件
cmdb config init

# 设置服务器地址
cmdb config set server.url "http://localhost:8080"

# 设置默认租户
cmdb config set tenant.id "550e8400-e29b-41d4-a716-446655440000"

# 查看配置
cmdb config list
```

### 认证登录

```bash
# 用户登录
cmdb auth login --username admin --password password123

# 或使用交互式登录
cmdb auth login

# 查看当前用户信息
cmdb auth whoami

# 登出
cmdb auth logout
```

## 命令结构

CLI 采用层级命令结构：

```
cmdb [global-flags] <command> <subcommand> [flags] [arguments]
```

### 全局参数

- `--config, -c`: 指定配置文件路径
- `--server, -s`: 服务器地址
- `--token, -t`: 认证令牌
- `--tenant`: 租户ID
- `--output, -o`: 输出格式 (json, yaml, table)
- `--verbose, -v`: 详细输出
- `--help, -h`: 显示帮助信息

## 模型管理命令

### 查看模型列表

```bash
# 基本列表
cmdb model list

# 带分页
cmdb model list --page 1 --page-size 20

# 按分类过滤
cmdb model list --category infrastructure

# 搜索模型
cmdb model list --search server

# JSON 输出
cmdb model list --output json

# 表格输出（默认）
cmdb model list --output table
```

### 创建模型

```bash
# 基本创建
cmdb model create \
  --name "服务器" \
  --identifier "server" \
  --description "物理服务器或虚拟机" \
  --category "infrastructure"

# 从文件创建
cmdb model create --file model.yaml

# 交互式创建
cmdb model create --interactive
```

模型文件示例 (`model.yaml`):

```yaml
name: "服务器"
identifier: "server"
description: "物理服务器或虚拟机"
category: "infrastructure"
icon: "server"
fields:
  - name: "主机名"
    identifier: "hostname"
    type: "string"
    required: true
    unique: true
    options:
      max_length: 255
      pattern: "^[a-zA-Z0-9-]+$"
    display_order: 1
  - name: "IP地址"
    identifier: "ip_address"
    type: "string"
    required: true
    options:
      pattern: "^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$"
    display_order: 2
  - name: "CPU核数"
    identifier: "cpu_cores"
    type: "int"
    required: true
    options:
      min: 1
      max: 128
    display_order: 3
```

### 查看模型详情

```bash
# 按ID查看
cmdb model show 550e8400-e29b-41d4-a716-446655440001

# 按名称查看
cmdb model show --name "服务器"

# 包含字段信息
cmdb model show --name "服务器" --include-fields

# JSON 格式输出
cmdb model show --name "服务器" --output json
```

### 更新模型

```bash
# 更新基本信息
cmdb model update 550e8400-e29b-41d4-a716-446655440001 \
  --description "数据中心物理服务器设备"

# 从文件更新
cmdb model update 550e8400-e29b-41d4-a716-446655440001 --file model-update.yaml

# 交互式更新
cmdb model update 550e8400-e29b-41d4-a716-446655440001 --interactive
```

### 删除模型

```bash
# 删除模型
cmdb model delete 550e8400-e29b-41d4-a716-446655440001

# 强制删除（忽略依赖检查）
cmdb model delete 550e8400-e29b-41d4-a716-446655440001 --force

# 确认删除
cmdb model delete 550e8400-e29b-41d4-a716-446655440001 --confirm
```

### 字段管理

```bash
# 添加字段
cmdb model field add 550e8400-e29b-41d4-a716-446655440001 \
  --name "机房位置" \
  --identifier "rack_location" \
  --type "string" \
  --description "服务器在机房中的位置"

# 列出字段
cmdb model field list 550e8400-e29b-41d4-a716-446655440001

# 更新字段
cmdb model field update 550e8400-e29b-41d4-a716-446655440002 \
  --description "服务器在数据中心机房中的具体位置"

# 删除字段
cmdb model field delete 550e8400-e29b-41d4-a716-446655440002
```

## 实例管理命令

### 查看实例列表

```bash
# 查看指定模型的实例
cmdb instance list --model server

# 带分页
cmdb instance list --model server --page 1 --page-size 20

# 搜索实例
cmdb instance list --model server --search web

# 按状态过滤
cmdb instance list --model server --status active

# 多种输出格式
cmdb instance list --model server --output table
cmdb instance list --model server --output json
cmdb instance list --model server --output yaml
```

### 创建实例

```bash
# 命令行创建
cmdb instance create \
  --model server \
  --name "web-server-01" \
  --data '{"hostname":"web01.example.com","ip_address":"192.168.1.100","cpu_cores":16,"memory_gb":64}'

# 从文件创建
cmdb instance create --file instance.yaml

# 交互式创建
cmdb instance create --model server --interactive
```

实例文件示例 (`instance.yaml`):

```yaml
model: "server"
name: "web-server-01"
data:
  hostname: "web01.example.com"
  ip_address: "192.168.1.100"
  cpu_cores: 16
  memory_gb: 64
  os: "centos7"
  environment: "production"
  description: "主要Web服务器"
```

### 批量创建实例

```bash
# 从CSV文件批量创建
cmdb instance import --model server --file instances.csv --format csv

# 从JSON文件批量创建
cmdb instance import --model server --file instances.json --format json

# 从YAML文件批量创建
cmdb instance import --model server --file instances.yaml --format yaml

# 验证模式（不实际创建）
cmdb instance import --model server --file instances.csv --validate-only

# 更新已存在的实例
cmdb instance import --model server --file instances.csv --update-existing
```

CSV 文件示例 (`instances.csv`):

```csv
name,hostname,ip_address,cpu_cores,memory_gb,os,environment
web-server-01,web01.example.com,192.168.1.100,16,64,centos7,production
web-server-02,web02.example.com,192.168.1.101,16,64,centos7,production
web-server-03,web03.example.com,192.168.1.102,16,64,centos7,production
```

### 查看实例详情

```bash
# 按ID查看
cmdb instance show 550e8400-e29b-41d4-a716-446655440010

# 按名称和模型查看
cmdb instance show --model server --name "web-server-01"

# 包含关系信息
cmdb instance show 550e8400-e29b-41d4-a716-446655440010 --include-relationships

# 包含业务拓扑信息
cmdb instance show 550e8400-e29b-41d4-a716-446655440010 --include-business

# JSON 格式输出
cmdb instance show 550e8400-e29b-41d4-a716-446655440010 --output json
```

### 更新实例

```bash
# 更新单个字段
cmdb instance update 550e8400-e29b-41d4-a716-446655440010 \
  --data '{"memory_gb":128}'

# 部分更新（合并）
cmdb instance update 550e8400-e29b-41d4-a716-446655440010 \
  --data '{"description":"升级后的Web服务器"}' \
  --partial

# 从文件更新
cmdb instance update 550e8400-e29b-41d4-a716-446655440010 --file update.yaml

# 交互式更新
cmdb instance update 550e8400-e29b-41d4-a716-446655440010 --interactive
```

### 搜索实例

```bash
# 基本搜索
cmdb instance search --model server --query "web"

# 复杂条件搜索
cmdb instance search \
  --model server \
  --filter 'environment=production' \
  --filter 'cpu_cores>=8' \
  --filter 'memory_gb>32'

# 使用查询文件
cmdb instance search --file search.yaml
```

搜索配置文件示例 (`search.yaml`):

```yaml
model: "server"
query: "web"
filters:
  - field: "environment"
    operator: "eq"
    value: "production"
  - field: "cpu_cores"
    operator: "gte"
    value: 8
  - field: "memory_gb"
    operator: "gt"
    value: 32
sort:
  - field: "name"
    order: "asc"
pagination:
  page: 1
  page_size: 20
```

### 删除实例

```bash
# 删除单个实例
cmdb instance delete 550e8400-e29b-41d4-a716-446655440010

# 批量删除
cmdb instance delete \
  550e8400-e29b-41d4-a716-446655440010 \
  550e8400-e29b-41d4-a716-446655440011 \
  550e8400-e29b-41d4-a716-446655440012

# 按条件删除
cmdb instance delete --model server --filter 'status=inactive'

# 确认删除
cmdb instance delete 550e8400-e29b-41d4-a716-446655440010 --confirm
```

### 导出实例

```bash
# 导出所有实例
cmdb instance export --model server --output instances.json

# 导出特定实例
cmdb instance export \
  --model server \
  --ids 550e8400-e29b-41d4-a716-446655440010,550e8400-e29b-41d4-a716-446655440011 \
  --output instances.json

# 导出为CSV
cmdb instance export --model server --format csv --output instances.csv

# 包含关系信息
cmdb instance export --model server --include-relationships --output instances.json
```

## 业务拓扑命令

### 查看业务拓扑

```bash
# 查看完整拓扑树
cmdb business tree

# 指定根节点
cmdb business tree --root 550e8400-e29b-41d4-a716-446655440100

# 限制深度
cmdb business tree --max-depth 3

# 包含实例信息
cmdb business tree --include-instances

# 树形显示
cmdb business tree --format tree

# JSON 输出
cmdb business tree --output json
```

### 创建业务节点

```bash
# 创建根节点
cmdb business create \
  --name "电商平台" \
  --description "在线电商业务平台"

# 创建子节点
cmdb business create \
  --name "用户服务" \
  --parent 550e8400-e29b-41d4-a716-446655440100 \
  --description "用户管理相关服务"

# 从文件创建
cmdb business create --file business.yaml

# 交互式创建
cmdb business create --interactive
```

业务节点文件示例 (`business.yaml`):

```yaml
name: "电商平台"
description: "在线电商业务平台"
metadata:
  owner: "platform-team"
  contact: "platform@company.com"
  business_type: "e-commerce"
children:
  - name: "用户服务"
    description: "用户管理相关服务"
    metadata:
      team: "user-team"
      service_type: "microservice"
  - name: "订单服务"
    description: "订单处理服务"
    metadata:
      team: "order-team"
      service_type: "microservice"
```

### 管理业务节点

```bash
# 查看节点详情
cmdb business show 550e8400-e29b-41d4-a716-446655440100

# 更新节点信息
cmdb business update 550e8400-e29b-41d4-a716-446655440101 \
  --name "用户管理服务" \
  --description "用户管理和认证相关服务"

# 移动节点
cmdb business move 550e8400-e29b-41d4-a716-446655440101 \
  --new-parent 550e8400-e29b-41d4-a716-446655440105

# 删除节点
cmdb business delete 550e8400-e29b-41d4-a716-446655440101

# 强制删除（包含子节点）
cmdb business delete 550e8400-e29b-41d4-a716-446655440101 --force
```

### 实例关联管理

```bash
# 关联实例到业务节点
cmdb business associate \
  --node 550e8400-e29b-41d4-a716-446655440101 \
  --instance 550e8400-e29b-41d4-a716-446655440201 \
  --role primary

# 批量关联
cmdb business associate \
  --node 550e8400-e29b-41d4-a716-446655440101 \
  --instances 550e8400-e29b-41d4-a716-446655440201,550e8400-e29b-41d4-a716-446655440202 \
  --role backup

# 查看节点实例
cmdb business instances 550e8400-e29b-41d4-a716-446655440101

# 取消关联
cmdb business disassociate \
  --node 550e8400-e29b-41d4-a716-446655440101 \
  --instance 550e8400-e29b-41d4-a716-446655440201
```

## 查询和分析命令

### 动态查询

```bash
# 简单查询
cmdb query \
  --model server \
  --fields "name,data.hostname,data.ip_address" \
  --filter "data.environment=production"

# 复杂查询
cmdb query \
  --model server \
  --fields "name,data.hostname,data.cpu_cores,data.memory_gb" \
  --filter "data.environment=production" \
  --filter "data.cpu_cores>=8" \
  --sort "data.cpu_cores:desc,name:asc" \
  --page 1 \
  --page-size 20

# 聚合查询
cmdb query \
  --model server \
  --group-by "data.environment,data.os" \
  --aggregate "data.cpu_cores:sum" \
  --aggregate "data.memory_gb:avg" \
  --aggregate "id:count"

# 从文件查询
cmdb query --file query.yaml

# 输出到文件
cmdb query --model server --output-file result.json
```

查询配置文件示例 (`query.yaml`):

```yaml
model: "server"
fields:
  - "name"
  - "data.hostname"
  - "data.ip_address"
  - "data.cpu_cores"
  - "data.memory_gb"
  - "data.environment"
filters:
  - field: "data.environment"
    operator: "eq"
    value: "production"
  - field: "data.cpu_cores"
    operator: "gte"
    value: 8
sort:
  - field: "data.cpu_cores"
    order: "desc"
  - field: "name"
    order: "asc"
pagination:
  page: 1
  page_size: 20
```

### 统计分析

```bash
# 模型统计
cmdb stats models

# 实例统计
cmdb stats instances

# 业务拓扑统计
cmdb stats business

# 用户活动统计
cmdb stats users --start-date 2024-01-01 --end-date 2024-01-31

# 详细统计报告
cmdb stats report --output report.json
```

### 拓扑分析

```bash
# 实例拓扑
cmdb topology instance 550e8400-e29b-41d4-a716-446655440010 \
  --max-depth 3 \
  --direction both

# 业务拓扑路径
cmdb topology path \
  --from 550e8400-e29b-41d4-a716-446655440100 \
  --to 550e8400-e29b-41d4-a716-446655440102

# 影响分析
cmdb topology impact 550e8400-e29b-41d4-a716-446655440010 \
  --analysis-type dependency

# 导出拓扑图
cmdb topology export 550e8400-e29b-41d4-a716-446655440010 \
  --format graphviz \
  --output topology.dot
```

## 审计和日志命令

### 查看审计日志

```bash
# 基本日志查询
cmdb audit logs --start-date 2024-01-01 --end-date 2024-01-31

# 按用户过滤
cmdb audit logs --user admin --start-date 2024-01-01

# 按操作类型过滤
cmdb audit logs --actions create,update,delete --start-date 2024-01-01

# 按资源类型过滤
cmdb audit logs --resource-types model,instance --start-date 2024-01-01

# 详细输出
cmdb audit logs --start-date 2024-01-01 --include-details

# 导出审计日志
cmdb audit logs --start-date 2024-01-01 --output audit.json
```

### 审计统计

```bash
# 操作统计
cmdb audit stats --period week --start-date 2024-01-01

# 用户活动统计
cmdb audit users --start-date 2024-01-01 --end-date 2024-01-31

# 安全事件
cmdb audit security --start-date 2024-01-01

# 生成审计报告
cmdb audit report --period month --start-date 2024-01-01 --output audit-report.pdf
```

### 监控和告警

```bash
# 实时监控
cmdb monitor --type live

# 性能监控
cmdb monitor --type performance --duration 1h

# 错误监控
cmdb monitor --type errors --level error

# 系统健康检查
cmdb health check

# 连接测试
cmdb health ping
```

## 配置和管理命令

### 配置管理

```bash
# 查看所有配置
cmdb config list

# 查看特定配置
cmdb config get server.url

# 设置配置
cmdb config set server.url "https://cmdb.company.com"

# 删除配置
cmdb config unset server.timeout

# 重置配置
cmdb config reset

# 配置文件位置
cmdb config path
```

### 用户管理

```bash
# 查看用户列表
cmdb user list

# 创建用户
cmdb user create \
  --username operator \
  --email operator@company.com \
  --display-name "系统操作员" \
  --roles user,operator

# 更新用户
cmdb user update operator --display-name "高级操作员"

# 重置密码
cmdb user reset-password operator

# 删除用户
cmdb user delete operator

# 查看当前用户权限
cmdb user permissions
```

### 角色和权限管理

```bash
# 查看角色列表
cmdb role list

# 创建角色
cmdb role create \
  --name "数据分析师" \
  --identifier "data_analyst" \
  --description "数据分析和报表权限"

# 分配权限
cmdb role assign-permission data_analyst instance:read,instance:export

# 撤销权限
cmdb role revoke-permission data_analyst instance:export

# 查看权限列表
cmdb permission list

# 检查权限
cmdb permission check --resource instance --action create
```

## 工具和实用命令

### 数据验证

```bash
# 验证模型定义
cmdb validate model --file model.yaml

# 验证实例数据
cmdb validate instance --file instances.json

# 验证拓扑结构
cmdb validate topology --file topology.yaml

# 数据完整性检查
cmdb validate integrity --models server,application

# 关系一致性检查
cmdb validate relationships
```

### 数据迁移

```bash
# 导出所有数据
cmdb export all --output backup.tar.gz

# 导入数据
cmdb import --file backup.tar.gz --strategy merge

# 模型迁移
cmdb migrate models --from v1.0 --to v2.0

# 数据同步
cmdb sync --source source-server --target target-server

# 增量同步
cmdb sync --source source-server --target target-server --incremental
```

### 性能工具

```bash
# 性能测试
cmdb benchmark --operation create --model server --count 1000

# 数据库优化
cmdb optimize database --vacuum

# 缓存清理
cmdb cache clear --type all

# 索引重建
cmdb index rebuild --models server,application

# 磁盘清理
cmdb cleanup --remove-archived --remove-logs --days 90
```

### 调试工具

```bash
# 调试模式
cmdb --debug instance list --model server

# 详细日志
cmdb --verbose instance create --file instance.yaml

# 请求跟踪
cmdb --trace instance show 550e8400-e29b-41d4-a716-446655440010

# 性能分析
cmdb --profile query --model server --filter "status=active"

# 生成调试报告
cmdb debug report --output debug.txt
```

## 配置文件

### 主配置文件

默认配置文件位置：`~/.cmdb/config.yaml`

```yaml
server:
  url: "http://localhost:8080"
  timeout: 30s
  retry_count: 3

auth:
  token_file: "~/.cmdb/token"
  auto_refresh: true

tenant:
  id: "550e8400-e29b-41d4-a716-446655440000"
  name: "default"

output:
  format: "table"  # table, json, yaml
  color: true
  pager: "less"

logging:
  level: "info"  # debug, info, warn, error
  file: "~/.cmdb/cli.log"

cache:
  enabled: true
  ttl: "5m"
  directory: "~/.cmdb/cache"
```

### 认证配置

认证令牌文件：`~/.cmdb/token`

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2024-01-01T01:00:00Z"
}
```

## 环境变量

常用环境变量：

```bash
# 服务器配置
export CMDB_SERVER_URL="http://localhost:8080"
export CMDB_TENANT_ID="550e8400-e29b-41d4-a716-446655440000"

# 认证配置
export CMDB_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
export CMDB_USERNAME="admin"
export CMDB_PASSWORD="password123"

# 输出配置
export CMDB_OUTPUT_FORMAT="json"
export CMDB_NO_COLOR="true"

# 调试配置
export CMDB_DEBUG="true"
export CMDB_LOG_LEVEL="debug"
```

## Shell 完成

### Bash 完成

```bash
# 生成并安装 bash 完成脚本
cmdb completion bash > /etc/bash_completion.d/cmdb

# 或者临时启用
source <(cmdb completion bash)
```

### Zsh 完成

```bash
# 生成并安装 zsh 完成脚本
cmdb completion zsh > "${fpath[1]}/_cmdb"

# 或者临时启用
source <(cmdb completion zsh)
```

### Fish 完成

```bash
# 生成并安装 fish 完成脚本
cmdb completion fish > ~/.config/fish/completions/cmdb.fish
```

## 常见使用场景

### 日常运维

```bash
# 1. 查看服务器状态
cmdb instance list --model server --filter "status=active" --output table

# 2. 搜索特定服务器
cmdb instance search --model server --query "web" --filter "environment=production"

# 3. 更新服务器信息
cmdb instance update web-server-01 --data '{"memory_gb":128,"description":"内存升级"}'

# 4. 查看业务拓扑
cmdb business tree --include-instances --format tree
```

### 批量操作

```bash
# 1. 批量导入服务器
cmdb instance import --model server --file servers.csv --update-existing

# 2. 批量更新环境标签
cmdb instance update --model server --filter "name like 'prod-%'" --data '{"environment":"production"}'

# 3. 批量导出数据
cmdb instance export --model server --filter "environment=production" --output prod-servers.json
```

### 报告生成

```bash
# 1. 生成资产报告
cmdb stats report --models server,application --output asset-report.json

# 2. 生成审计报告
cmdb audit report --period month --start-date 2024-01-01 --output audit-report.pdf

# 3. 生成拓扑图
cmdb topology export --root business-root --format graphviz --output topology.dot
```

### 监控和告警

```bash
# 1. 实时监控系统活动
cmdb monitor --type live

# 2. 检查系统健康状态
cmdb health check --verbose

# 3. 查看错误日志
cmdb audit logs --level error --start-date today
```

## 故障排除

### 常见问题

1. **连接问题**
```bash
# 检查服务器连接
cmdb health ping

# 检查配置
cmdb config list

# 测试认证
cmdb auth whoami
```

2. **权限问题**
```bash
# 检查当前权限
cmdb user permissions

# 重新登录
cmdb auth logout
cmdb auth login
```

3. **性能问题**
```bash
# 清理缓存
cmdb cache clear

# 检查性能
cmdb --profile instance list --model server
```

### 调试技巧

```bash
# 启用详细输出
cmdb --verbose --debug instance create --file instance.yaml

# 查看请求详情
cmdb --trace instance show 550e8400-e29b-41d4-a716-446655440010

# 生成调试报告
cmdb debug report --include-config --include-logs --output debug-report.txt
```

## 最佳实践

### 配置管理

1. 使用配置文件而不是命令行参数
2. 设置合适的默认输出格式
3. 启用缓存以提高性能
4. 定期更新认证令牌

### 脚本编写

1. 使用 JSON 输出便于脚本处理
2. 检查命令执行结果
3. 使用变量存储常用ID
4. 添加错误处理逻辑

### 安全考虑

1. 不要在脚本中硬编码密码
2. 使用环境变量或配置文件
3. 定期轮换认证令牌
4. 限制CLI工具的访问权限