# CMDB Configuration Management Platform (Frontend)

> A React + TypeScript CMDB frontend for business topology management, host/resource operations, and operational analytics.

[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-purple.svg)](https://vitejs.dev/)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5.x-blue.svg)](https://ant.design/)

## Overview

Enterprise CMDB frontend focusing on **business topology**, **host/resource management**, and **operational analytics**.  
Built with React + TypeScript + Vite + Ant Design, emphasizing **layered architecture, type safety, engineering standards, and maintainability**.

> **Interview Positioning**: This project demonstrates capabilities in medium-to-large-scale frontend engineering (architecture, reusable components, state management, i18n, testing toolchain), suitable for enterprise/banking/operation support systems.

---

## 项目简介

配置管理平台（CMDB），聚焦常见的配置管理场景：**业务拓扑**、**主机资源管理**、**运营分析/审计** 等。  
采用 React + TypeScript + Vite + Ant Design 构建，强调 **分层架构、类型安全、工程化规范、可维护性**。

---

## 📋 目录

- [项目简介](#项目简介)
- [功能概览](#功能概览)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [开发与测试](#开发与测试)
- [架构与规范](#架构与规范)
- [常见问题](#常见问题)
- [贡献指南](#贡献指南)

---

## ✨ 功能概览

### 业务管理（Business）

- 🏢 **业务生命周期管理**：创建、编辑、归档业务
- 🌳 **业务拓扑**：业务 → 集群/集合 → 模块 → 主机 的层级管理与可视化
- 🔄 **主机转移**：跨业务/跨模块的主机迁移流程（含权限/校验/提示）
- 📋 **服务模板**：基于模板快速创建服务实例
- 👥 **动态分组**：灵活的主机分组条件配置

### 资源管理（Resource / Host）

- 💻 **主机管理**：主机导入、分配、转移、删除
- 📁 **资源目录**：主机池分组管理
- 📥 **批量导入**：支持 Excel 批量导入主机
- 🗑️ **删除历史**：可追溯的删除记录查询

### 运营分析（Analysis）

- 📊 **操作审计**：完整的操作日志记录（主机、业务、资源）
- 📈 **运营统计**：业务总数、主机总数、实例统计
- 📉 **可视化图表**：支持饼图、柱状图、折线图等多种展示方式
- 🔍 **多维度查询**：按操作对象、动作、时间、账号等条件筛选

### 系统能力

- 🌍 **国际化支持**：中英文无缝切换（i18next）
- 🎨 **响应式设计**：适配多种屏幕尺寸
- 🔐 **权限控制**：基于后端返回的鉴权状态进行前端引导（401/403 等）

---

## 🛠 技术栈

### 核心框架

- **React 18.2** - UI 框架
- **TypeScript 5.x** - 类型安全
- **Vite 6.x** - 构建工具
- **React Router 7.x** - 路由管理

### UI & 可视化

- **Ant Design 5.x** - 企业级 UI 组件库
- **@ant-design/icons** - 图标库
- **@antv/g2** - 数据可视化

### 状态管理 & HTTP

- **Zustand 5.0** - 轻量级状态管理
- **Axios 1.9** - HTTP 客户端（统一实例 + 拦截器）

### 国际化 & 工具

- **i18next 25.1** - 国际化方案
- **react-i18next 15.5** - React 绑定
- **dayjs** - 日期处理

### 代码质量 & 测试

- **ESLint** - 代码检查
- **Prettier** - 代码格式化
- **TypeScript** - 类型检查
- **Vitest 4.0** - 单元测试框架

---

## 🚀 快速开始

### 环境要求

```bash
Node.js >= 18.0.0
pnpm >= 8.0.0
```

### 安装与启动

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
# 访问地址：http://localhost:5173
```

---

## 💻 开发与测试

### 常用命令

```bash
# 开发与构建
pnpm dev              # 启动开发服务器
pnpm build            # 构建生产代码
pnpm preview          # 预览生产构建

# 代码质量
pnpm lint             # 运行 ESLint
pnpm typecheck        # TypeScript 类型检查
pnpm format           # 格式化代码 (Prettier)
pnpm format:check     ## 检查格式

# 测试
pnpm test             # 运行所有测试
pnpm test:coverage    # 生成覆盖率报告
pnpm test:ui          # 测试 UI 界面
```

### 测试

项目采用 **Vitest + Testing Library** 进行单元测试，重点覆盖核心工具函数。

---

## 🏗 架构与规范

### 项目结构

```
wende-cmdb/
├── public/                      # 静态资源
├── src/
│   ├── api/                     # API 层
│   │   ├── axiosInstance.ts    # Axios 实例配置
│   │   ├── services/           # 业务 API 服务
│   │   │   ├── business.ts     # 业务相关接口
│   │   │   └── resource.ts     # 资源相关接口
│   │   └── types/              # API 类型定义
│   ├── assets/                  # 静态资源
│   │   ├── icons/              # 图标
│   │   ├── images/             # 图片
│   │   └── templates/          # 模板文件
│   ├── components/              # 组件库
│   │   ├── Business/           # 业务组件
│   │   ├── common/             # 通用组件
│   │   ├── DeleteHistory/      # 删除历史
│   │   └── Layout/             # 布局组件
│   ├── constants/               # 常量配置
│   ├── locales/                 # 国际化配置
│   │   ├── zh-CN.json          # 中文
│   │   └── en-US.json          # 英文
│   ├── pages/                   # 页面
│   │   ├── Analysis/           # 运营分析
│   │   ├── Business/           # 业务管理
│   │   ├── Home/               # 首页
│   │   ├── Resource/           # 资源管理
│   │   └── NotFound/           # 404 页面
│   ├── routes/                  # 路由配置
│   ├── store/                   # 状态管理
│   ├── utils/                   # 工具函数
│   │   ├── __tests__/          # 单元测试
│   │   ├── routes.ts           # 路由工具
│   │   └── performance.ts      # 性能优化
│   ├── App.tsx                  # 根组件
│   ├── main.tsx                 # 入口文件
│   └── i18n.js                  # i18n 配置
├── eslint.config.js             # ESLint 配置
├── tsconfig.json                # TypeScript 配置
├── vite.config.ts               # Vite 配置
├── vitest.config.ts             # Vitest 配置
└── package.json                 # 项目依赖
```

### 架构亮点

#### 1. 分层架构

- **展示层**：React 组件 + Ant Design
- **业务层**：Store (Zustand) + Hooks
- **数据层**：API Services + Axios

#### 2. 类型安全

- 全面的 TypeScript 类型定义
- API 接口类型与后端对齐
- 严格的编译检查

#### 3. 工程化

- Vite 快速构建
- ESLint + Prettier 代码规范
- Vitest 单元测试
- i18next 国际化

#### 4. 可维护性

- 清晰的目录结构
- 组件化、模块化设计
- 统一的错误处理
- 完善的类型注释

### 命名规范

- **组件文件**：PascalCase (e.g., `BusinessTopology.tsx`)
- **工具文件**：camelCase (e.g., `routes.ts`)
- **类型文件**：PascalCase (e.g., `Types.ts`)
- **常量**：UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **变量/函数**：camelCase (e.g., `getUserInfo`)

### 分支规范

- **主分支**：`main` - 生产环境代码
- **开发分支**：`dev` - 开发环境代码
- **功能分支**：`feature/<feature-name>` - 新功能开发
- **修复分支**：`fix/<bug-name>` - Bug 修复
- **热修复分支**：`hotfix/<issue-name>` - 生产环境紧急修复
- **发布分支**：`release/<version>` - 版本发布准备

### 提交规范

使用 **Conventional Commits** 规范：

```
<type>(<scope>): <subject>
```

**Type 类型：**

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构（既不是新功能也不是修复）
- `test`: 测试相关
- `chore`: 构建/工具/依赖更新

**示例：**

```bash
feat(business): 添加业务拓扑可视化
fix(host): 修复主机列表分页问题
docs(api): 添加 API 接口文档
style: 调整按钮间距
refactor(store): 优化状态管理结构
test(utils): 增加边界条件测试
chore(deps): 升级 React 到 18.3
```

---

## ❓ 常见问题

### 1. 开发服务器启动失败

```bash
# 清除缓存重新安装
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### 2. 构建失败

**可能原因**：

- Node.js 版本过低（需要 >= 18）
- 依赖安装不完整
- 内存不足

**解决方案**：

```bash
# 检查 Node.js 版本
node -v

# 重新安装依赖
pnpm install

# 增加内存限制
NODE_OPTIONS=--max_old_space_size=4096 pnpm build
```

---

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 贡献流程

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

**Made with ❤️ for Enterprise CMDB**
