# Wende CMDB Web

[English](README.md) | 简体中文

[Wende CMDB](../README.zh-CN.md) 的 Web 界面，基于 React、TypeScript、Vite 和 Ant Design 构建。要运行完整产品，请看[快速开始](../README.zh-CN.md#快速开始)。

> **状态：** 早期开发阶段。统计页面的部分图表仍在展示示例数据，并已标明。

## 功能

- **业务拓扑：** 浏览和管理业务 → 集群 → 模块 → 主机的层级。
- **主机管理：** 从 Excel 导入，分配、转移、回收主机，搜索资源池。
- **模型：** 管理资源类型、属性和唯一规则。
- **审计：** 按对象、操作、时间和账号筛选变更记录。
- **AI 助手：** 可选的 [AI 服务](../ai/README.zh-CN.md)的对话面板，回答可以跳转到对应的依据。
- **语言：** 英文和简体中文。

## 本地开发

需要 Node.js 22 或更高版本，并通过 [Corepack](https://nodejs.org/api/corepack.html) 使用 pnpm。先启动[服务端](../server/README.zh-CN.md)，然后运行：

```bash
corepack enable
pnpm install
pnpm dev              # http://localhost:5173
```

开发时，界面调用 `http://localhost:8080/api` 上的 API 和 `http://localhost:8090` 上的 AI 服务。

| 命令                   | 用途                   |
| ---------------------- | ---------------------- |
| `pnpm build`           | 类型检查并构建生产版本 |
| `pnpm lint`            | 运行 ESLint            |
| `pnpm typecheck`       | 运行 TypeScript 编译器 |
| `pnpm format:check`    | 用 Prettier 检查格式   |
| `pnpm exec vitest run` | 运行一次测试           |

## 配置

这些变量在构建时读取：

| 变量              | 生产环境默认值 | 说明                                                           |
| ----------------- | -------------- | -------------------------------------------------------------- |
| `VITE_API_URL`    | `/api`         | API 的基础地址                                                 |
| `VITE_AI_API_URL` | `/ai-api`      | AI 服务的基础地址                                              |
| `VITE_DEMO_LOGIN` | 关闭           | 设为 `true` 时，登录页显示演示账号和一键登录。仅用于公开演示站 |

[Dockerfile](Dockerfile) 构建的镜像用 nginx 提供界面，并把这些路径代理到 `server` 和 `ai` 容器，见 [deploy/nginx.conf](deploy/nginx.conf)。
