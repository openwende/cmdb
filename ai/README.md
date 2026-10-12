# wende-cmdb-ai

wende CMDB 的 AI 服务：资源配置调查助手（后续扩展为主机分配 / 流转助手）。

- Python 3.12 + FastAPI + LangChain `create_agent`，模型使用 DeepSeek（默认 `deepseek-flash`）
- 通过 MCP 调用 Go CMDB 后端 `/mcp` 的只读工具，调用时转发用户的登录凭证
- 会话状态用 LangGraph `AsyncPostgresSaver` 持久化到 PostgreSQL（独立 schema `ai`）
- 对话接口 `POST /chat`，SSE 流式输出

```
前端 ──SSE（用户 JWT）──▶ POST /chat ──▶ create_agent ──MCP（同一个 JWT）──▶ Go CMDB /mcp
                              │
                              └──▶ PostgreSQL schema ai（检查点，thread_id = 用户ID:会话ID）
```

## 本地运行

前提：Go 后端已用 docker compose 启动（`cmdb-db`、`cmdb-server`），`http://localhost:8080/health` 返回 200。

```bash
cp .env.example .env   # 已有 .env 时跳过；填入 DEEPSEEK_API_KEY
uv sync
uv run uvicorn cmdb_ai.api:app --port 8090
```

首次启动会在 CMDB 的数据库里创建 schema `ai` 和检查点表。

### 调用示例

```bash
TOKEN=$(curl -s -X POST localhost:8080/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"chenjing","password":"<密码>"}' | jq -r .access_token)

curl -N -X POST localhost:8090/chat \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"conversation_id":"demo-1","message":"10.20.1.11 为什么同时在两个模块？"}'
```

同一个 `conversation_id` 再发消息就是多轮追问。

### 接口

所有接口都要 `Authorization: Bearer <CMDB 的 JWT>`（AI 服务用 `/api/v1/auth/me` 校验），JWT 无效返回 401。允许跨域的前端来源由 `CORS_ORIGINS` 配置（默认 `http://localhost:5173`、`http://localhost:5199`）。

| 接口 | 说明 |
|---|---|
| `POST /chat` `{conversation_id, message}` | SSE 流式对话（事件见下）。同一会话上一条还没答完时返回 409。客户端中途断开后，下一轮开始前会给没有结果的工具调用补上"已中断"，会话可以继续问 |
| `GET /conversations` | 当前用户的会话列表（按最近更新倒序）：`{items: [{conversation_id, title, created_at, updated_at}]}` |
| `GET /conversations/{id}/messages` | 会话的问答：`{items: [{role, content, created_at}]}`；只有用户问题和最终回答，中途停止的轮次只有问题。不是自己的会话返回 404 |
| `DELETE /conversations/{id}` | 删除会话和它的检查点，204 |
| `GET /knowledge/sections?id=<文档#小节>` | 知识库小节原文 `{id, doc, title, content}`，前端点开 `[doc=…]` 引用用 |

会话列表和问答存在 `ai.conversations`、`ai.conversation_messages`，按 (用户 ID, 会话 ID) 隔离；Agent 的完整状态在 LangGraph 检查点里（thread_id = 用户ID:会话ID）。

### SSE 事件

| 事件 | data | 说明 |
|---|---|---|
| `message_start` | `{message_id}` | 一次模型调用开始 |
| `reasoning` | `{message_id, delta}` | 思考过程增量 |
| `text` | `{message_id, delta}` | 回答文本增量（调用工具前的过渡语也会出现） |
| `message_end` | `{message_id, finish_reason, usage}` | 一次模型调用结束，含 token 用量 |
| `tool_start` | `{tool_call_id, name, input}` | 工具调用开始 |
| `tool_end` | `{tool_call_id, name, status, output}` | `status` 为 `success` / `error`，`output` 截断到 4000 字 |
| `final` | `{answer, tool_calls, usage, model_calls, elapsed_ms, trace_id?}` | 本轮最终回答和统计；启用 Langfuse 时带 `trace_id` |
| `error` | `{message}` | 执行失败 |

## 开发

```bash
uv run pytest            # 单元测试，不调用模型和网络
uv run ruff check . && uv run ruff format .
```

### 评测

`eval/cases.yaml` 是基于本地演示数据（故事 S1–S5 和 10 道难题）的 30 个问题，三层检查：

1. 规则检查：必须引用的 record_id、必须 / 不能出现的内容、必须调用的工具、调用上限（不调用模型）
2. 引用核对（`eval/citations.py`）：回答里引用的 record_id / host_id 必须在本题工具返回里出现过（不调用模型）
3. LLM 评分（`eval/judge.py`，deepseek-v4-pro）：正确性对照参考要点（`reference`），忠实度对照工具返回，
   分两次调用；结果按输入哈希缓存在 `eval/results/judge-cache.jsonl`，同样的输入不重复花钱

```bash
uv run python eval/run_eval.py --label baseline          # 跑 30 题（需要 Go 后端和 .env 里的评测账号）
uv run python eval/run_eval.py --only s1-why-two-modules # 只跑部分用例
uv run python eval/judge.py baseline --dry-run           # 先估算要调用多少次评分模型
uv run python eval/judge.py baseline                     # LLM 评分（命中缓存的不再调用）
uv run python eval/compare.py baseline prompt-v2         # 按 label 对比，只读缓存，不调用模型
uv run python eval/push_scores.py baseline               # 把分数写回 Langfuse trace（需要启用 Langfuse）
```

同一配置跑 3 轮再对比；检查项按当前 `cases.yaml` 重新打分，改了规则不用重跑模型。评测省钱规则见 `CLAUDE.md`。

`eval/labeling/` 是校准评分模型用的 40 条标注集（含 10 条故意改坏的回答）、盲标结果和一致率脚本；
`eval/ragas_faithfulness.py` 是 Ragas faithfulness 与自建评分的对比（需要 `uv sync --group eval`）。

### 可观测（Langfuse，可选）

本地自建，镜像和启动方式见 `deploy/langfuse/docker-compose.yml`：

```bash
cd deploy/langfuse && ./init-env.sh && docker compose up -d   # 首次运行生成随机密钥
```

打开 http://localhost:3100 ，登录账号在 `deploy/langfuse/.env`（`LANGFUSE_INIT_USER_EMAIL` / `_PASSWORD`）。
把 `.env` 里的 `LANGFUSE_INIT_PROJECT_PUBLIC_KEY` / `SECRET_KEY` 填到本仓库 `.env` 的 `LANGFUSE_PUBLIC_KEY` /
`LANGFUSE_SECRET_KEY` 即启用；不填则完全不启用。每次对话一条 trace（用户名、会话、标签 `chat` 或
`eval / <label> / <用例>`），包含每次模型调用的 token（含缓存命中、推理 token）、工具调用和中间件；
用户 JWT 不会上报。`final` 事件会带 `trace_id`。

## 代码结构

| 文件 | 内容 |
|---|---|
| `src/cmdb_ai/api.py` | FastAPI 应用、JWT 校验、`/chat` |
| `src/cmdb_ai/investigator.py` | 懒加载工具、执行一轮对话（接口和评测共用） |
| `src/cmdb_ai/agent.py` | `create_agent`、DeepSeek 模型、中间件 |
| `src/cmdb_ai/middleware.py` | 调用次数到上限时基于已有证据收尾；工具结果转成纯文本再交给模型 |
| `src/cmdb_ai/prompts.py` | 系统提示词 |
| `src/cmdb_ai/mcp_tools.py` | MCP 工具转换、按用户转发 JWT 的拦截器 |
| `src/cmdb_ai/streaming.py` | v3 流式事件 → SSE 事件，统计 token / 工具调用 |
| `src/cmdb_ai/checkpoint.py` | `AsyncPostgresSaver` 与 schema `ai` |
| `src/cmdb_ai/cmdb.py` | Go 后端客户端（登录、`/auth/me`）、`UserContext` |
| `src/cmdb_ai/config.py` | 配置项 |
| `src/cmdb_ai/observability.py` | Langfuse 追踪（可选） |

开发进度与任务清单见上级目录的 `PROGRESS.md`。
