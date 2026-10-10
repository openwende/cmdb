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

### SSE 事件

| 事件 | data | 说明 |
|---|---|---|
| `message_start` | `{message_id}` | 一次模型调用开始 |
| `reasoning` | `{message_id, delta}` | 思考过程增量 |
| `text` | `{message_id, delta}` | 回答文本增量（调用工具前的过渡语也会出现） |
| `message_end` | `{message_id, finish_reason, usage}` | 一次模型调用结束，含 token 用量 |
| `tool_start` | `{tool_call_id, name, input}` | 工具调用开始 |
| `tool_end` | `{tool_call_id, name, status, output}` | `status` 为 `success` / `error`，`output` 截断到 4000 字 |
| `final` | `{answer, tool_calls, usage, model_calls, elapsed_ms}` | 本轮最终回答和统计 |
| `error` | `{message}` | 执行失败 |

## 开发

```bash
uv run pytest            # 单元测试，不调用模型和网络
uv run ruff check . && uv run ruff format .
```

### 评测

`eval/cases.yaml` 是基于本地演示数据（故事 S1–S5）的 20 个问题，检查回答是否引用了正确的
record_id、是否包含关键事实、是否调用了必要的工具。一键运行（需要 Go 后端和 `.env` 里的评测账号）：

```bash
uv run python eval/run_eval.py --label baseline          # 全部用例，默认并发 4
uv run python eval/run_eval.py --only s1-why-two-modules # 只跑部分用例
```

结果写到 `eval/results/`（不提交），包含每题的回答、工具调用、token 和耗时，用于优化前后对比。

同一配置建议跑 3 轮，再按 label 对比（检查项按当前 `cases.yaml` 重新打分，改了规则也不用重跑模型）：

```bash
uv run python eval/compare.py baseline prompt-v2
```

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

开发进度与任务清单见上级目录的 `PROGRESS.md`。
