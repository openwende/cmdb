# AI 助手：提问次数用完时的明确提示

## 背景

AI 服务（`wende-cmdb-ai`）要部署到公开演示机 207（demo.wendeops.com），演示登录是公开的。为防止 DeepSeek 额度被刷完，AI 服务加了每日提问次数限额：每个账号每天 30 次（`CHAT_DAILY_LIMIT_PER_USER`）、全站每天 200 次（`CHAT_DAILY_LIMIT_TOTAL`），按 Asia/Shanghai 的日期算。超限时 `POST /chat` 返回 HTTP 429，body 是 FastAPI 的 `{"detail": "..."}`，不调用模型、不记会话。AI 服务这部分已在另一个会话完成（未提交）。

现状（2026-10-21 查代码）：

- `src/api/services/aiChat.ts` 对非 2xx 的 `/chat` 响应抛 `AIChatHttpError(response.status)`
- `src/store/AIAssistantSceneStore.ts` 的 `getChatErrorKey` 只区分 401（`common.errors.unauthorized`）和 409（`aiAssistant.errors.busy`），其他状态码都是 `aiAssistant.errors.requestFailed`（"AI 服务请求失败，请稍后重试"）。所以 429 现在显示成通用失败，用户会以为是服务出错、反复重试
- 测试 `src/utils/__tests__/ai-assistant-store.test.ts` 的 "maps 409 and connection failures to error messages" 覆盖了 409 和连接失败

## 目标

**今天的提问次数用完时，AI 助手的回答位置明确告诉用户"次数用完了，明天再来"，而不是通用的请求失败。**

## 验收标准

- AC1：`POST /chat` 返回 429 时，该条助手回答显示错误提示：中文"今天的 AI 提问次数已用完，请明天再来"，英文对应翻译；不显示"AI 服务请求失败，请稍后重试"
- AC2：中英文切换后提示跟着变，没有裸露的 i18n key
- AC3：其他错误分支不变：409 仍是 `aiAssistant.errors.busy`，401 仍是 `common.errors.unauthorized`，其他非 2xx 仍是 `aiAssistant.errors.requestFailed`，连不上服务仍是 `aiAssistant.errors.connectionFailed`
- AC4：单测覆盖 429 → `aiAssistant.errors.quotaExceeded`
- AC5：`pnpm format:check`、`lint`、`typecheck`、`vitest run`、`build` 全过；控制台没有新的报错或警告

## 约束

- 只改：`src/store/AIAssistantSceneStore.ts`（`getChatErrorKey` 在 409 判断旁边加 429 → `aiAssistant.errors.quotaExceeded`）、`src/locales/zh-CN.json` 和 `src/locales/en-US.json`（`aiAssistant.errors.quotaExceeded`，两边逐 key 同步）、`src/utils/__tests__/ai-assistant-store.test.ts`
- 不改 `aiChat.ts` 的请求逻辑，不改后端和 AI 服务
- 文案用前端固定的 i18n 文案，不显示 429 body 里的 `detail`（`detail` 只有中文，且分"每个账号"和"全站"两种；前端一条文案覆盖两种情况）
- 不提交、不切分支（提交前由用户决定）
