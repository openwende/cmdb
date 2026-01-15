# WEND CMDB Backend 文档中心

欢迎查阅 WEND CMDB Backend 的完整文档。

## 📚 文档导航

### 快速开始
- **[快速开始指南](QUICKSTART.md)** - 5分钟快速部署和测试服务
  - 一键启动服务
  - API快速测试
  - 完整使用示例
  - 故障排查指南

### API 参考
- **[API 完整文档](API.md)** - 所有接口的详细说明
  - 健康检查
  - 业务管理 API (CRUD)
  - 业务集管理 API
  - 动态模型引擎 API
  - 完整的请求/响应示例
  - 错误码参考

### 架构设计
- **[模型设计文档](../deploy/model-design.md)** - 动态模型引擎设计
- **[认证设计文档](../deploy/auth-design.md)** - 认证授权设计

### 部署指南
- **[部署文档](../deploy/README.md)** - 生产环境部署指南

---

## 🚀 快速链接

### 我想...

#### ...快速体验服务
👉 查看 [快速开始指南](QUICKSTART.md) 的**快速部署**章节

#### ...了解如何调用 API
👉 查看 [API 文档](API.md)

#### ...运行示例代码
👉 运行交互式演示脚本:
```bash
./scripts/demo-api.sh
```

#### ...测试所有API接口
👉 运行自动化测试:
```bash
./scripts/test-api.sh
```

#### ...部署到生产环境
👉 查看 [部署文档](../deploy/README.md)

---

## 📖 按角色推荐阅读

### 🎯 后端开发者
1. [快速开始指南](QUICKSTART.md) - 了解如何启动服务
2. [API 文档](API.md) - 熟悉所有接口
3. [模型设计文档](../deploy/model-design.md) - 理解系统架构
4. 项目 [README.md](../README.md) - 了解项目结构

### 🎨 前端开发者
1. [API 文档](API.md) - 接口文档和示例
2. [快速开始指南](QUICKSTART.md) - 本地启动后端服务
3. 使用 `scripts/demo-api.sh` 了解API调用流程

### 🔧 运维工程师
1. [快速开始指南](QUICKSTART.md) - 部署和维护
2. [部署文档](../deploy/README.md) - 生产环境配置
3. `docker-compose.yml` - 容器编排配置
4. `Makefile` - 常用运维命令

### 🧪 测试工程师
1. [API 文档](API.md) - 接口规范
2. `scripts/test-api.sh` - 自动化测试脚本
3. [快速开始指南](QUICKSTART.md) - 测试环境搭建

---

## 🛠️ 可用工具和脚本

### 测试脚本
```bash
# 自动化测试所有API端点
./scripts/test-api.sh

# 交互式演示API使用流程
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

## 📊 API 概览

### 业务管理 (Business Management)
管理业务实体和业务集

- ✅ 创建/查询/更新/删除业务
- ✅ 业务集管理
- ✅ 业务集成员管理
- ✅ 业务人员角色管理

### 动态模型引擎 (Dynamic Model Engine)
类似 Kubernetes CRD 的动态资源定义系统

- ✅ 自定义模型(资源类型)
- ✅ 动态属性定义
- ✅ 实例 CRUD 操作
- ✅ 批量操作支持
- ✅ 灵活的查询过滤

---

## 🔗 相关资源

- [项目 README](../README.md)
- [Docker Compose 配置](../docker-compose.yml)
- [Makefile](../Makefile)
- [配置示例](../config/config.example.yaml)

---

## 💡 获取帮助

### 常见问题

**Q: 如何快速测试API？**
A: 运行 `./scripts/demo-api.sh` 查看交互式演示

**Q: 如何验证所有API都正常工作？**
A: 运行 `./scripts/test-api.sh` 执行自动化测试

**Q: 服务启动失败怎么办？**
A: 查看 [快速开始指南](QUICKSTART.md) 的**故障排查**章节

**Q: 如何连接数据库调试？**
A: 使用 `docker exec -it cmdb-db psql -U cmdb -d cmdb`

---

**文档版本**: v1.0
**最后更新**: 2026-01-15
**维护者**: WEND CMDB Team
