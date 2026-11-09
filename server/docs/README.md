# Wende CMDB Server 文档中心

欢迎查阅 Wende CMDB Server 的完整文档。本文档中心帮助你快速找到所需的信息。

## 📚 入门指南

### 新用户必读
- **[快速开始](QUICKSTART.md)** - 5 分钟快速部署和测试服务
  - 一键启动服务
  - API 快速测试
  - 完整使用示例
  - 故障排查指南

### API 使用
- **[API 文档](API.md)** - 完整的 API 接口参考
  - 健康检查
  - 业务管理 API
  - 主机管理 API
  - 云区域管理 API
  - 业务集管理 API
  - 动态模型引擎 API
  - 完整的请求/响应示例
  - 错误码参考

---

## 🏗️ 架构和设计

### 系统架构
- **[系统架构文档](ARCHITECTURE.md)** - 完整的系统架构和核心设计决策
  - 三层架构设计（Handler → Service → Repository）
  - 云区域隔离设计（基于蓝鲸 CMDB 理念）
  - 主机标识策略（三级标识体系）
  - 资源池管理
  - 动态模型引擎
  - 性能优化（N+1 查询修复：50-500 倍提升）
  - 安全性设计
  - 数据模型设计
  - 部署架构

### 测试文档
- **[测试指南](TESTING.md)** - 测试框架和最佳实践
  - 测试覆盖率统计（当前 20%+，目标 40%）
  - 测试框架使用（testify/assert, testify/mock）
  - 如何运行测试
  - 如何编写测试
  - Mock 对象使用
  - 性能测试
  - 测试最佳实践

---

## 📖 功能文档

### 核心功能
- **[动态模型 API](DYNAMIC_MODEL_API.md)** - 动态模型引擎详解
- **[拓扑管理 API](TOPOLOGY_API.md)** - 拓扑结构管理
- **[导入导出指南](IMPORT_EXPORT_GUIDE.md)** - 数据导入导出功能
- **[主机导入指南](HOST_IMPORT_GUIDE.md)** - 主机批量导入
- **[前端集成指南](FRONTEND_INTEGRATION_GUIDE.md)** - 前端对接说明

---

## 🔧 开发相关

### 贡献指南
- **[贡献指南](../../CONTRIBUTING.md)** - 如何参与项目开发
  - 开发环境设置
  - 代码规范（Go 代码风格、命名规范、架构模式）
  - 提交规范（Conventional Commits）
  - 测试要求（覆盖率要求：Service 70%、Repository 50%、Handler 60%）
  - Pull Request 流程
  - Bug 报告和功能请求

### 项目管理
- **[更新日志](CHANGELOG.md)** - 版本历史和变更记录
  - 最新改进（测试框架、性能优化、新功能）
  - 版本历史
  - 项目里程碑
- **[产品路线图](ROADMAP.md)** - 未来规划和目标
  - 近期目标
  - 长期规划
  - 技术债务

---

## 🚀 快速链接

### 我想...

#### ...快速体验服务
👉 查看 [快速开始指南](QUICKSTART.md) 的快速部署章节

#### ...了解如何调用 API
👉 查看 [API 文档](API.md)

#### ...理解系统架构
👉 查看 [系统架构文档](ARCHITECTURE.md)

#### ...参与代码贡献
👉 查看 [贡献指南](../../CONTRIBUTING.md)

#### ...运行测试
👉 查看 [测试指南](TESTING.md)

#### ...了解最新变化
👉 查看 [更新日志](CHANGELOG.md)

#### ...测试所有 API 接口
👉 运行自动化测试:
```bash
./scripts/test-api.sh
```

#### ...部署到生产环境
👉 查看 [部署文档](../deploy/README.md)

---

## 📖 按角色推荐阅读

### 🎯 后端开发者
1. **[快速开始指南](QUICKSTART.md)** - 了解如何启动服务
2. **[系统架构文档](ARCHITECTURE.md)** - 理解系统设计
3. **[API 文档](API.md)** - 熟悉所有接口
4. **[贡献指南](../../CONTRIBUTING.md)** - 开始贡献代码
5. **[测试指南](TESTING.md)** - 编写和运行测试

### 🎨 前端开发者
1. **[API 文档](API.md)** - 接口文档和示例
2. **[快速开始指南](QUICKSTART.md)** - 本地启动后端服务
3. **[前端集成指南](FRONTEND_INTEGRATION_GUIDE.md)** - 前端对接
4. 使用 `scripts/demo-api.sh` 了解 API 调用流程

### 🏗️ 架构师
1. **[系统架构文档](ARCHITECTURE.md)** - 完整架构设计
2. **[产品路线图](ROADMAP.md)** - 技术规划
3. **[更新日志](CHANGELOG.md)** - 技术演进历史

### 🔧 运维工程师
1. **[快速开始指南](QUICKSTART.md)** - 部署和维护
2. **[部署文档](../deploy/README.md)** - 生产环境配置
3. `docker-compose.yml` - 容器编排配置
4. `Makefile` - 常用运维命令

### 🧪 测试工程师
1. **[API 文档](API.md)** - 接口规范
2. **[测试指南](TESTING.md)** - 测试框架和策略
3. `scripts/test-api.sh` - 自动化测试脚本
4. **[快速开始指南](QUICKSTART.md)** - 测试环境搭建

### 📝 技术写作者
1. **[贡献指南](../../CONTRIBUTING.md)** - 文档贡献规范
2. **[更新日志](CHANGELOG.md)** - 版本发布说明
3. **[系统架构文档](ARCHITECTURE.md)** - 技术文档参考

---

## 🛠️ 可用工具和脚本

### 测试脚本
```bash
# 自动化测试所有 API 端点
./scripts/test-api.sh

# 交互式演示 API 使用流程
./scripts/demo-api.sh
```

### Makefile 命令
```bash
# 开发相关
make dev-db          # 启动数据库
make dev             # 启动开发服务器
make dev-all         # 启动完整环境

# 数据库迁移
make db-migrate-up   # 运行迁移
make db-migrate-down # 回滚迁移

# 测试和构建
make test            # 运行单元测试
make build           # 构建二进制文件
```

---

## 📊 功能概览

### 业务管理（Business Management）
管理业务实体和业务集

- ✅ 创建/查询/更新/删除业务
- ✅ 业务生命周期管理（测试中、已上线、已下线、已归档）
- ✅ 业务集管理
- ✅ 业务集成员管理
- ✅ 业务人员角色管理
- ✅ 业务删除保护（仅允许删除归档状态的业务）

### 主机管理（Host Management）
主机资源管理和云区域隔离

- ✅ 主机创建/查询/更新/删除
- ✅ 批量导入主机
- ✅ 主机分配到业务
- ✅ 主机回收到资源池
- ✅ 云区域管理（IP 冲突解决方案）
- ✅ 主机状态管理

### 拓扑管理（Topology Management）
业务拓扑和资源目录

- ✅ 资源目录管理
- ✅ 服务模板管理
- ✅ 进程模板管理
- ✅ 业务拓扑关联

### 动态模型引擎（Dynamic Model Engine）
类似 Kubernetes CRD 的动态资源定义系统

- ✅ 自定义模型（资源类型）
- ✅ 动态属性定义
- ✅ 实例 CRUD 操作
- ✅ 批量操作支持
- ✅ 灵活的查询过滤
- ✅ JSONB 动态字段存储

---

## ⚡ 性能指标

### N+1 查询优化

| 业务数量 | 优化前查询次数 | 优化后查询次数 | 性能提升 |
|---------|--------------|--------------|---------|
| 10      | 11 (1+10)    | 2            | **5.5x** |
| 100     | 101 (1+100)  | 2            | **50x** |
| 1000    | 1001         | 2            | **500x** |

详见 [系统架构文档 - 性能优化](ARCHITECTURE.md#性能优化)

### 测试覆盖率

- `internal/core/business`: 23.5%
- `internal/core/host`: 16.8%
- `internal/storage`: 14.0%
- **总体**: 20%+ (目标: 40%)

详见 [测试指南](TESTING.md)

---

## 🔗 相关资源

### 项目文件
- [项目 README](../README.md)
- [Docker Compose 配置](../docker-compose.yml)
- [Makefile](../Makefile)
- [配置示例](../config/config.example.yaml)

### 外部资源
- [蓝鲸 CMDB (BK-CMDB)](https://github.com/TencentBlueKing/bk-cmdb) - 设计参考
- [Go 官方文档](https://go.dev/doc/)
- [PostgreSQL 文档](https://www.postgresql.org/docs/)
- [Gin Web 框架](https://gin-gonic.com/)

---

## 💡 获取帮助

### 常见问题

**Q: 如何快速测试 API？**
A: 运行 `./scripts/demo-api.sh` 查看交互式演示

**Q: 如何验证所有 API 都正常工作？**
A: 运行 `./scripts/test-api.sh` 执行自动化测试

**Q: 服务启动失败怎么办？**
A: 查看 [快速开始指南](QUICKSTART.md) 的**故障排查**章节

**Q: 如何连接数据库调试？**
A: 使用 `docker exec -it cmdb-db psql -U cmdb -d cmdb`

**Q: 如何贡献代码？**
A: 查看 [贡献指南](../../CONTRIBUTING.md)

**Q: 如何运行测试？**
A: 查看 [测试指南](TESTING.md)

**Q: 性能优化做了哪些工作？**
A: 查看 [系统架构文档 - 性能优化](ARCHITECTURE.md#性能优化)

### 获取支持

- **GitHub Issues**: [项目 Issues](https://github.com/openwende/cmdb/server/issues)
- **文档反馈**: 如发现文档问题，请提交 Issue 或 PR

---

## 📝 文档贡献

文档也是项目的重要组成部分！如果你发现：
- 文档有错误或过时信息
- 某个功能缺少文档
- 文档可以写得更清楚

发现文档问题请提交 Issue。暂不接受外部 Pull Request，详见[贡献指南](../../CONTRIBUTING.md)。

---

**文档版本**: v2.0
**最后更新**: 2026-02-09
**维护者**: Wende CMDB Team
