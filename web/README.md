# 配置管理平台 (CMDB)

> 企业级配置管理平台，提供业务拓扑管理、主机资源管理、运营分析等核心功能

[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-purple.svg)](https://vitejs.dev/)
[![Ant Design](https://img.shields.io/badge/Ant%20Design-5.x-blue.svg)](https://ant.design/)

## 📋 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [架构设计](#架构设计)
- [规范说明](#规范说明)
- [构建部署](#构建部署)
- [常见问题](#常见问题)

## ✨ 功能特性

### 业务管理

- 🏢 **业务生命周期管理**：创建、编辑、归档业务
- 🌳 **业务拓扑**：可视化业务架构，支持集群、模块、主机多层级管理
- 🔄 **主机转移**：支持主机在业务间转移、模块间转移
- 📋 **服务模板**：基于模板快速创建服务实例
- 👥 **动态分组**：灵活的主机分组条件配置

### 资源管理

- 💻 **主机管理**：主机导入、分配、转移、删除
- 📁 **资源目录**：主机池分组管理
- 📥 **批量导入**：支持 Excel 批量导入主机
- 🗑️ **删除历史**：可追溯的删除记录查询

### 运营分析

- 📊 **操作审计**：完整的操作日志记录（主机、业务、资源）
- 📈 **运营统计**：业务总数、主机总数、实例统计
- 📉 **可视化图表**：支持饼图、柱状图、折线图等多种展示方式
- 🔍 **多维度查询**：按操作对象、动作、时间、账号等条件筛选

### 系统功能

- 🌍 **国际化支持**：中英文无缝切换
- 🎨 **响应式设计**：适配多种屏幕尺寸
- 🔐 **权限控制**：基于角色的权限管理

## 🛠 技术栈

### 核心框架

- **React 18.2** - UI 框架
- **TypeScript 5.x** - 类型安全
- **Vite 5.x** - 构建工具

### UI & 样式

- **Ant Design 5.x** - 企业级 UI 组件库
- **@ant-design/icons** - 图标库
- **@antv/g2** - 数据可视化

### 状态管理 & 路由

- **Zustand** - 轻量级状态管理
- **React Router 7.x** - 路由管理

### 国际化 & 工具

- **i18next** - 国际化方案
- **axios** - HTTP 客户端
- **dayjs** - 日期处理

### 代码质量

- **ESLint** - 代码检查
- **Prettier** - 代码格式化
- **TypeScript** - 类型检查

## 🚀 快速开始

### 环境要求

```bash
Node.js >= 18.0.0
pnpm >= 8.0.0
```

### 安装依赖

```bash
# 使用 pnpm（推荐）
pnpm install

# 或使用 npm
npm install
```

### 开发运行

```bash
# 启动开发服务器
pnpm dev

# 默认访问地址
http://localhost:5173
```

### 生产构建

```bash
# 构建生产版本
pnpm build

# 预览生产版本
pnpm preview
```

### 代码检查与格式化

```bash
# 运行 ESLint 检查
pnpm lint

# 格式化代码
pnpm format

# 检查代码格式
pnpm format:check
```

## 📁 项目结构

```
wende-cmdb/
├── public/                    # 静态资源
├── src/
│   ├── api/                   # API 接口层
│   │   ├── services/          # API 服务
│   │   │   ├── business.ts    # 业务相关接口
│   │   │   └── resource.ts    # 资源相关接口
│   │   ├── types/             # API 类型定义
│   │   ├── axiosInstance.ts   # Axios 实例配置
│   │   └── index.ts           # API 统一导出
│   ├── assets/                # 静态资源
│   │   ├── icons/             # 图标
│   │   ├── images/            # 图片
│   │   └── templates/         # 模板文件
│   ├── components/            # 公共组件
│   │   ├── Business/          # 业务相关组件
│   │   ├── common/            # 通用组件
│   │   │   ├── Pagination/    # 分页组件
│   │   │   ├── ConfirmModal/  # 确认弹窗
│   │   │   └── ...
│   │   ├── DeleteHistory/     # 删除历史组件
│   │   └── Layout/            # 布局组件
│   ├── constants/             # 常量配置
│   ├── locales/               # 国际化文件
│   │   ├── en-US.json         # 英文
│   │   └── zh-CN.json         # 中文
│   ├── mock/                  # Mock 数据
│   ├── pages/                 # 页面组件
│   │   ├── Analysis/          # 运营分析
│   │   ├── Business/          # 业务管理
│   │   ├── Home/              # 首页
│   │   ├── NotFound/          # 404 页面
│   │   └── Resource/          # 资源管理
│   ├── routes/                # 路由配置
│   ├── store/                 # 状态管理
│   ├── utils/                 # 工具函数
│   ├── App.tsx                # 应用根组件
│   ├── i18n.js                # 国际化配置
│   └── main.tsx               # 应用入口
├── .eslintrc.cjs              # ESLint 配置
├── .prettierrc                # Prettier 配置
├── tsconfig.json              # TypeScript 配置
├── vite.config.ts             # Vite 配置
└── package.json               # 项目依赖配置
```

## 📐 架构设计

### 整体架构

```
┌─────────────────────────────────────────┐
│           UI Layer (Pages)              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐ │
│  │ Business│  │Resource │  │Analysis │ │
│  └────┬────┘  └────┬────┘  └────┬────┘ │
└───────┼───────────┼────────────┼────────┘
        │           │            │
┌───────┼───────────┼────────────┼────────┐
│       │  Component Layer       │        │
│  ┌────▼────┐  ┌────▼────┐  ┌──▼──────┐ │
│  │Common   │  │Business │  │Layout   │ │
│  │Components│ │Components│ │Components││
│  └─────────┘  └─────────┘  └─────────┘ │
└───────┬───────────┬────────────┬────────┘
        │           │            │
┌───────▼───────────▼────────────▼────────┐
│        Business Logic Layer             │
│  ┌──────────┐  ┌──────────┐           │
│  │  Hooks   │  │  Store   │           │
│  └──────────┘  └──────────┘           │
└───────────────────┬─────────────────────┘
                    │
┌───────────────────▼─────────────────────┐
│         Data Access Layer (API)         │
│  ┌──────────┐  ┌──────────┐           │
│  │ Business │  │ Resource │           │
│  │ Service  │  │ Service  │           │
│  └──────────┘  └──────────┘           │
└───────────────────┬─────────────────────┘
                    │
            ┌───────▼────────┐
            │  Backend API   │
            └────────────────┘
```

### 核心设计理念

#### 1. 分层架构

- **表示层**：负责 UI 渲染和用户交互
- **业务逻辑层**：处理业务规则和状态管理
- **数据访问层**：封装 API 调用和数据处理
- **各层职责单一**，降低耦合度

#### 2. 组件化设计

- **原子组件**：Button、Input 等基础组件
- **业务组件**：BusinessSelector、ModifyDrawer 等
- **页面组件**：完整的页面级组件
- **布局组件**：Header、Sidebar、Footer 等

#### 3. 类型安全

- 全面使用 TypeScript
- 接口返回类型定义
- 组件 Props 类型约束
- 严格的类型检查

#### 4. 状态管理

- 使用 Zustand 进行全局状态管理
- 组件内部使用 React Hooks
- 避免 Props 层层传递

#### 5. 性能优化

- 路由懒加载（React.lazy）
- 组件按需加载
- 列表虚拟滚动
- 图片懒加载
- 防抖节流处理

## 📝 规范说明

### 代码规范

#### 命名规范

- **组件文件**：PascalCase（如 `BusinessList.tsx`）
- **工具文件**：camelCase（如 `formatDate.ts`）
- **样式文件**：kebab-case（如 `business-list.css`）
- **常量**：UPPER_SNAKE_CASE（如 `API_BASE_URL`）
- **枚举**：PascalCase（如 `LIFECYCLE`）

#### 文件组织

```typescript
// 1. 外部依赖导入
import React, { useState } from 'react';
import { Button } from 'antd';

// 2. 内部模块导入
import { getBusinessList } from '@/api';
import BusinessCard from '@/components/BusinessCard';

// 3. 类型导入
import type { BusinessDetail } from '@/api/types';

// 4. 样式导入
import './style.css';

// 5. 组件定义
const BusinessList: React.FC = () => {
  // ...
};

export default BusinessList;
```

#### TypeScript 规范

- 启用严格模式（`strict: true`）
- 明确标注函数返回类型
- 避免使用 `any`，使用 `unknown` 替代
- 接口优先于类型别名
- 使用枚举管理常量

### Git 提交规范

遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type 类型

- `feat`: 新增功能
- `fix`: 修复 Bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响代码运行）
- `refactor`: 重构代码
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建工具或辅助工具的变动
- `revert`: 回滚提交

#### 示例

```bash
feat(business): 添加业务归档功能

- 新增归档按钮
- 实现归档 API 调用
- 更新业务生命周期为 offline

Closes #123
```

### 分支管理策略

```
main (生产环境)
  ├── develop (开发环境)
  │     ├── feature/business-archive (功能分支)
  │     ├── feature/host-import (功能分支)
  │     └── bugfix/table-pagination (修复分支)
  └── hotfix/critical-bug (紧急修复)
```

#### 分支规则

- `main`: 生产环境，受保护分支
- `develop`: 开发环境，日常开发基准
- `feature/*`: 新功能开发
- `bugfix/*`: Bug 修复
- `hotfix/*`: 紧急修复生产问题

## 🔒 安全说明

### API 安全

- **统一鉴权**：所有 API 请求携带 Token
- **请求拦截**：axios 拦截器统一处理
- **响应拦截**：统一处理错误和鉴权失效
- **超时处理**：请求超时自动重试

### 前端安全

- **XSS 防护**：
  - 使用 React 自动转义
  - 避免 `dangerouslySetInnerHTML`
  - 对用户输入进行转义
- **CSRF 防护**：
  - 使用 CSRF Token
  - 验证 Referer 头
- **敏感数据**：
  - 不在前端存储敏感信息
  - Token 使用 httpOnly Cookie
  - 及时清理本地存储

### 权限控制

- 路由级别权限校验
- 组件级别权限控制
- API 级别权限验证
- 按钮级别权限隐藏

### 性能优化建议

1. **构建优化**
   - 启用代码分割
   - 压缩静态资源
   - Tree Shaking
   - 移除 console.log

2. **加载优化**
   - CDN 加速
   - 资源预加载
   - 图片懒加载
   - 路由懒加载

3. **运行优化**
   - 使用 React.memo
   - 避免不必要的重渲染
   - 虚拟列表
   - 防抖节流

## ❓ 常见问题

### 1. 安装依赖失败

**问题**：npm install 或 pnpm install 失败

**解决方案**：

```bash
# 清理缓存
pnpm store prune
rm -rf node_modules pnpm-lock.yaml

# 使用国内镜像
pnpm config set registry https://registry.npmmirror.com

# 重新安装
pnpm install
```

### 2. 端口被占用

**问题**：启动开发服务器时提示端口 5173 被占用

**解决方案**：

```typescript
// 修改 vite.config.ts
export default defineConfig({
  server: {
    port: 3000, // 修改为其他端口
  },
});
```

### 3. 跨域问题

**问题**：开发环境 API 请求跨域

**解决方案**：

```typescript
// vite.config.ts 配置代理
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

### 4. TypeScript 类型错误

**问题**：TypeScript 编译报错

**解决方案**：

```bash
# 检查 TypeScript 版本
pnpm list typescript

# 重新生成类型声明
rm -rf node_modules/.vite
pnpm dev
```

### 5. 样式不生效

**问题**：CSS 样式在生产环境不生效

**解决方案**：

- 检查 CSS 导入路径
- 确认 CSS 模块命名规范
- 查看浏览器开发者工具的样式加载情况

### 6. 国际化文本不显示

**问题**：页面显示 key 而不是翻译文本

**解决方案**：

```typescript
// 检查 i18n 配置
// 确认语言文件路径正确
// 验证 key 是否存在于语言文件中
```

## 📊 项目统计

- **代码行数**：~15,000+ 行
- **组件数量**：100+ 个
- **页面数量**：20+ 个
- **API 接口**：50+ 个
- **国际化条目**：1000+ 条

## 👥 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交改动 (`git commit -m 'feat: add some amazing feature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

## 📧 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 Issue
- 发送邮件至：email@example.com

---

**Built with ❤️ using React + TypeScript + Vite**
