# AI 调查助手对话面板

## 背景

AI 调查助手（独立的 Python 服务 `wende-cmdb-ai`，FastAPI + LangChain）已经能回答"这台主机为什么同时在两个模块""故障机和待回收有什么区别"这类问题：它用用户的 JWT 通过 MCP 调 CMDB 的只读工具查数据，用 `search_knowledge` 查领域知识库，回答里每条事实都带依据，例如 `[record_id=895]`、`[host_id=43]`、`[doc=主机流转规则#回收到资源池]`。目前只能用 curl 调 `POST /chat`（SSE 流式），前端没有入口。

前端现状（2026-10-12 调研）：

- 没有任何 AI / 对话相关代码；没有 `@ant-design/x`、Markdown 渲染库、SSE 客户端
- JWT 在 localStorage `authToken`（`src/constants/auth.ts`），axios 拦截器加 `Authorization`，401 时清 token 跳登录（`src/api/axiosInstance.ts:70-78`）；fetch 不经过这些拦截器
- 审计页 `/analysis/audit` 的详情抽屉（`OperationDetail`）只能从列表行打开，没有按记录 ID 打开的深链；后端也没有按 ID 取单条审计的接口
- 没有主机详情页，`host_id` 没有可跳转的地方

## 目标

**在 CMDB 前端里加一个 AI 调查助手对话面板：流式显示回答、思考过程和工具调用步骤，回答里的引用可以点开核对（审计记录跳到审计详情、知识库引用显示原文），支持多轮追问、停止生成和历史会话。**

## 依赖的接口（主会话在前端开发开始前完成，前端只调用）

### AI 服务（`wende-cmdb-ai`，本地 `http://localhost:8090`）

所有接口都要 `Authorization: Bearer <CMDB 的 JWT>`；JWT 无效返回 401。允许跨域来源由 AI 服务配置，默认包含 `http://localhost:5173`。

| 接口                                           | 说明                                                                                                                                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /chat` body `{conversation_id, message}` | SSE 流式回答。`conversation_id` 由前端生成，只能是字母、数字、`_`、`-`，最长 128；同一个 ID 再发就是多轮追问。同一会话上一条还没回答完时返回 **409**                          |
| `GET /conversations`                           | 当前用户的会话列表，按最近更新倒序：`{items: [{conversation_id, title, created_at, updated_at}]}`，`title` 是第一条问题（截断）                                               |
| `GET /conversations/{id}/messages`             | 恢复一个会话：`{items: [{role: "user" \| "assistant", content}]}`，`content` 是用户问题或助手的最终回答（Markdown）；不恢复思考过程和工具步骤。不是自己的会话或不存在返回 404 |
| `DELETE /conversations/{id}`                   | 删除会话，返回 204                                                                                                                                                            |
| `GET /knowledge/sections?id=<文档#小节>`       | 知识库小节原文：`{id, doc, title, content}`；不存在返回 404                                                                                                                   |

SSE 事件（`event:` 行是事件名，`data:` 行是 JSON）：

| 事件            | data                                                              | 说明                                                                     |
| --------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `message_start` | `{message_id}`                                                    | 一次模型调用开始（一轮回答里可能有多次）                                 |
| `reasoning`     | `{message_id, delta}`                                             | 思考过程增量                                                             |
| `text`          | `{message_id, delta}`                                             | 回答文本增量。调用工具前的过渡语也会出现，最终回答以 `final.answer` 为准 |
| `message_end`   | `{message_id, finish_reason, usage}`                              | 一次模型调用结束                                                         |
| `tool_start`    | `{tool_call_id, name, input}`                                     | 工具调用开始                                                             |
| `tool_end`      | `{tool_call_id, name, status, output}`                            | `status` 为 `success` / `error`，`output` 截断到 4000 字                 |
| `final`         | `{answer, tool_calls, usage, model_calls, elapsed_ms, trace_id?}` | 本轮结束：最终回答和统计                                                 |
| `error`         | `{message}`                                                       | 执行失败                                                                 |

工具名（显示时翻译）：`search_businesses` 查业务、`get_business_topology` 查业务拓扑、`search_hosts` 查主机、`get_host` 查主机详情、`query_host_changes` 查变更记录、`list_pool_directories` 查资源池目录、`search_knowledge` 查知识库；未知工具名原样显示。

### CMDB 后端（`wende-cmdb-backend`）

- 新增 `GET /api/v1/audit/:id`：返回单条审计记录，**结构和 `GET /api/v1/audit` 列表里的一项相同**（详情抽屉可以直接用）；不存在返回 404

## 界面与交互

- **入口**：Header 右侧功能区（`Header/Function`，语言切换旁边）加"AI 助手"按钮，点击打开右侧抽屉，不遮罩页面（可以一边看页面一边对话），再点按钮或抽屉的关闭按钮收起。抽屉挂在 `MainLayout`，切换页面时对话保持
- **组件**：用 Ant Design X 1.x（`@ant-design/x` 1.6.1，兼容 antd 5）：`Bubble.List` 显示消息、`Sender` 输入、`Welcome` + `Prompts` 欢迎态、`ThoughtChain` 显示工具步骤、`Conversations` 显示历史会话；SSE 可以用 `XStream` 解析 `fetch` 的响应流（要自己带 JWT 和 `AbortController`）。回答用 `react-markdown` 10.1.0 + `remark-gfm` 4.0.1 渲染
- **一条助手消息**从上到下：思考过程（可折叠，默认折叠）→ 工具步骤（每次调用一步：中文工具名、状态、耗时，展开看参数和返回）→ 回答正文（Markdown，引用渲染成标签）→ 底部小字统计（工具调用次数、耗时、输入 / 输出 token）
- **引用**：
  - `[record_id=895]` → 可点击标签，点击跳到 `/analysis/audit?record_id=895`，审计页自动打开这条记录的详情抽屉。一个方括号里有多个编号（`[record_id=700、701]`、`[record_id=800~802]`、`[host_id=43, record_id=612]`）时每个编号一个标签（范围只出两端）
  - `[doc=主机流转规则#回收到资源池]` → 可点击标签，点击弹出气泡显示该小节原文（`GET /knowledge/sections`）
  - `[host_id=43]` → 不可点击的标签（目前没有主机详情页）
  - 其他方括号内容原样显示
- **会话**：抽屉顶部"新对话"按钮 + 历史会话列表（标题、时间，可删除）；新对话由前端生成 `conversation_id`；点历史会话加载消息继续追问；刷新页面后历史仍在
- **生成中**：发送按钮变成停止按钮；点停止中断请求，助手消息保留已生成的内容并标记"已停止"；之后在同一会话里可以继续提问
- **错误**：AI 服务连不上、返回 `error` 事件或非 200 时，在这条助手消息里显示错误提示（i18n），不白屏；401 走现有逻辑（清 token、回登录页）；409 提示"上一条消息还在处理中"
- **新增配置**：`VITE_AI_API_URL`，开发环境默认 `http://localhost:8090`，构建产物默认 `/ai-api`（部署时由 nginx 转发）。不改已有的 `VITE_*` 默认值

## 改哪里（建议，developer 可调整）

1. `package.json`：加 `@ant-design/x@1.6.1`、`react-markdown@10.1.0`、`remark-gfm@4.0.1`（固定版本）
2. `src/api/services/aiChat.ts`（新）：会话列表 / 消息 / 删除 / 知识库小节（可以用单独的 axios 实例，baseURL 用 `VITE_AI_API_URL`）和 SSE 流式调用（fetch，自己处理 401 / 409）
3. `src/components/AIAssistant/`（新）：抽屉、消息列表、引用解析和渲染、工具步骤、会话列表；引用解析写成纯函数并单测
4. `src/components/Layout/Header/Function/index.tsx`：入口按钮；`MainLayout`：挂抽屉
5. 审计页：读 `?record_id=`，调 `GET /api/v1/audit/:id` 后打开详情抽屉；关闭抽屉时去掉这个参数；没有参数时行为不变
6. `src/locales/zh-CN.json`、`en-US.json`：新增 `aiAssistant.*`

## 验收标准

前提：后端（8080）和 AI 服务（8090，`uv run uvicorn cmdb_ai.api:app --port 8090`）在跑。用 `admin / admin123456` 登录。每次真实提问会调用 DeepSeek，测试时控制提问次数（全部 AC 跑一遍约 10 次提问）。

- **AC1 入口**：Header 右侧有"AI 助手"按钮（英文界面为 "AI Assistant"），点击打开右侧抽屉，再点收起；抽屉打开时切换到其他页面，对话内容还在
- **AC2 欢迎态**：新对话显示欢迎语和 3 个示例问题，点示例问题直接发送
- **AC3 流式回答**：问"10.20.1.11 为什么同时在两个模块？"：用户消息立刻出现；助手回答逐步出现，期间可以看到工具步骤一步步变成成功；最终回答按 Markdown 渲染（"结论""查到的事实"等是标题，列表正常）
- **AC4 思考与工具步骤**：思考过程默认折叠、可展开；每个工具步骤显示中文工具名、状态和耗时，展开能看到参数和返回内容
- **AC5 审计引用**：AC3 回答里的 `[record_id=…]` 是可点击标签；点击后跳到审计页并打开这条记录的详情抽屉，详情内容和从列表点开的一致；对话抽屉里的内容不丢
- **AC6 知识库引用**：问"故障机和待回收有什么区别？"，回答里的 `[doc=…]` 标签点击后弹出该小节原文；`[host_id=…]` 是不可点击的标签
- **AC7 统计**：每条助手回答底部显示工具调用次数、耗时、token
- **AC8 多轮**：在 AC3 的会话里追问"它现在在哪些模块？"，回答针对的是同一台主机
- **AC9 停止**：提问后在回答完成前点停止：请求中断，消息标记"已停止"；接着在同一会话再问一个问题，能正常回答
- **AC10 会话历史**：点"新对话"开始新会话；历史列表里能看到之前的会话（标题是第一条问题），点开能看到之前的问答，引用仍可点击；刷新页面后历史还在；删除会话后列表里消失
- **AC11 错误**：停掉 AI 服务后发送，助手消息显示连接失败的提示，页面不白屏、控制台没有未捕获异常；恢复服务后能继续使用
- **AC12 审计深链**：直接打开 `/analysis/audit?record_id=895` 自动打开该记录详情；`?record_id=999999` 提示记录不存在；没有参数时审计页行为和现在一样
- **AC13 权限与隔离**：用只读账号登录也能使用助手；看不到 admin 的历史会话
- **AC14 i18n**：中英文切换后所有新增文字都有翻译，没有裸 key；控制台没有 React key 警告和 antd 静态 message 警告
- **AC15 质量门禁**：`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm vitest run`、`pnpm build` 全部通过；引用解析有单测（覆盖单个、列表、范围、混合、doc 标题里有顿号）

## 约束

- 不改 AI 服务和后端的代码（接口由主会话提供）；接口和本文不一致时报给主会话
- JWT 不出现在 URL、日志、localStorage 新 key 里；只读现有的 `authToken`
- 不引入 SSE 库以外的新状态管理；会话状态放组件或 zustand 的 `*SceneStore`，遵守 `.claude/agents/developer.md`
- 新增依赖固定版本（见"改哪里"第 1 条）

## 不做（本次）

- 点赞 / 点踩反馈、分享会话、导出
- 主机详情页（`host_id` 只显示不跳转）
- 恢复历史会话时的思考过程和工具步骤（只恢复问答）
- 写操作（分配主机等，第三阶段）
