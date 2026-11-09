# Wende CMDB AI

[![CI](https://github.com/openwende/cmdb-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/openwende/cmdb-ai/actions/workflows/ci.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)

English | [简体中文](README.zh-CN.md)

An AI assistant for investigating [Wende CMDB](https://github.com/openwende/cmdb-server), such as "Why is this host in two modules?" or "Who moved this host last week?". It answers from live CMDB data through read-only tools, and cites the records behind each claim.

> **Status:** early development. The prompts and knowledge base are in Chinese, so the assistant currently works best in Chinese.

## How it works

```
browser ──SSE (user's JWT)──▶ POST /chat ──▶ agent ──MCP (same JWT)──▶ cmdb-server /mcp
                                               │
                                               └──▶ PostgreSQL schema `ai`
```

- **Permissions:** every tool call uses the signed-in user's own token, so the assistant can only see what that user can see.
- **Read-only:** the MCP tools it uses do not change CMDB data.
- **Limits:** model calls and tool calls per question, and questions per day, are capped.
- **Storage:** conversations and agent checkpoints live in a separate `ai` schema.

Built with Python 3.12, FastAPI, LangChain and LangGraph. The model is [DeepSeek](https://platform.deepseek.com/).

## Run it

To run the assistant with the full stack, follow the [quick start](https://github.com/openwende/cmdb-server/tree/main/deploy/quickstart).

To develop locally, you need [uv](https://docs.astral.sh/uv/), a DeepSeek API key and a running cmdb-server:

```bash
cp .env.example .env  # then set DEEPSEEK_API_KEY
uv sync
uv run uvicorn cmdb_ai.api:app --port 8090
```

### Knowledge search

The `search_knowledge` tool looks up domain knowledge from the documents in `knowledge/`. Set `KNOWLEDGE_SEARCH_MODE=off` to disable it, or choose where the embedding and rerank models run:

| `KNOWLEDGE_MODEL_PROVIDER` | Models | Requirements |
|---|---|---|
| `siliconflow` | Hosted bge-m3 and bge-reranker-v2-m3 | `SILICONFLOW_API_KEY` |
| `local` (default) | The same models, run locally | `uv sync --extra local-models`, a download of about 4.4 GB and about 4 GB of memory |

After choosing a provider, build the index:

```bash
uv run python -m cmdb_ai.knowledge_store
```

## API

All endpoints require `Authorization: Bearer <CMDB JWT>`.

| Endpoint | Description |
|---|---|
| `POST /chat` | Send `{conversation_id, message}` and stream the answer over SSE |
| `GET /conversations` | List the user's conversations |
| `GET /conversations/{id}/messages` | Get the questions and answers in a conversation |
| `DELETE /conversations/{id}` | Delete a conversation |
| `GET /knowledge/sections?id=<doc#section>` | Get the text of a knowledge base section |

`POST /chat` emits these events: `message_start`, `reasoning`, `text`, `message_end`, `tool_start`, `tool_end`, `final` and `error`.

## Evaluation

Changes to the prompts and tools are measured rather than judged by eye. `eval/cases.yaml` has 30 questions over a fixed demo dataset, checked in three layers:

1. **Rules:** required records, required and forbidden content, required tools and call limits.
2. **Citations:** every cited record must appear in that question's tool results.
3. **LLM judging:** correctness against reference points, and faithfulness against tool results. Scores are cached by input hash, so unchanged inputs are not judged twice.

```bash
uv run python eval/run_eval.py --label baseline    # requires cmdb-server and spends model credit
uv run python eval/judge.py baseline --dry-run     # estimate judging calls first
uv run python eval/judge.py baseline
uv run python eval/compare.py baseline my-change   # reads caches only
```

`eval/labeling/` holds the labeled set used to calibrate the judge. Optional tracing with self-hosted Langfuse is set up in `deploy/langfuse/`.

## Development

```bash
uv run pytest                   # no model or network calls; database tests need PostgreSQL
uv run ruff check .
uv run ruff format --check .
```

We are not accepting outside pull requests yet, but bug reports and feature requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Licensed under the [GNU Affero General Public License v3.0](LICENSE).
