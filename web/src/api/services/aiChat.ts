import axios from '../axiosInstance';
import { AUTH_TOKEN_KEY, LOGIN_PATH } from '@/constants/auth';
import type {
  AIChatEvent,
  AIConversationListResponse,
  AIConversationMessagesResponse,
  AIKnowledgeSection,
} from '../types/aiChat';

// --- Base URL ---
// 本地开发直连 AI 服务 :8090；构建产物走同源 `/ai-api`（由 nginx 转发），
// 避免浏览器去请求用户自己机器上的 localhost。
const LOCAL_AI_API_URL = 'http://localhost:8090';
export const AI_API_BASE_URL =
  import.meta.env.VITE_AI_API_URL || (import.meta.env.DEV ? LOCAL_AI_API_URL : '/ai-api');

// 普通 JSON 接口复用 CMDB 的 axios 实例（带 token、拆 response.data、401 跳登录），
// 只是把 baseURL 换成 AI 服务。
const aiRequestConfig = { baseURL: AI_API_BASE_URL };

export const listAIConversations = (): Promise<AIConversationListResponse> =>
  axios.get('/conversations', aiRequestConfig);

export const getAIConversationMessages = (
  conversationId: string,
): Promise<AIConversationMessagesResponse> =>
  axios.get(`/conversations/${encodeURIComponent(conversationId)}/messages`, aiRequestConfig);

export const deleteAIConversation = (conversationId: string): Promise<void> =>
  axios.delete(`/conversations/${encodeURIComponent(conversationId)}`, aiRequestConfig);

export const getKnowledgeSection = (id: string): Promise<AIKnowledgeSection> =>
  axios.get('/knowledge/sections', { ...aiRequestConfig, params: { id } });

// --- SSE ---

export interface RawSSEEvent {
  event: string;
  data: string;
}

/**
 * 增量解析 SSE 文本流。服务端（sse-starlette）用 `\r\n` 换行，这里统一成 `\n`；
 * 一个 chunk 末尾的 `\r` 先留着，等下一个 chunk 判断是不是 `\r\n`，
 * 避免被拆开的 `\r` + `\n` 被当成空行把一个事件截断。
 */
export const createSSEParser = () => {
  let buffer = '';
  let pendingCR = false;

  const parseBlock = (block: string): RawSSEEvent | null => {
    let event = 'message';
    const dataLines: string[] = [];
    let hasField = false;
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue; // 空行 / 注释（如 ping）
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') {
        event = value;
        hasField = true;
      } else if (field === 'data') {
        dataLines.push(value);
        hasField = true;
      }
    }
    if (!hasField || dataLines.length === 0) return null;
    return { event, data: dataLines.join('\n') };
  };

  const drain = (final: boolean): RawSSEEvent[] => {
    const events: RawSSEEvent[] = [];
    let index = buffer.indexOf('\n\n');
    while (index !== -1) {
      const parsed = parseBlock(buffer.slice(0, index));
      if (parsed) events.push(parsed);
      buffer = buffer.slice(index + 2);
      index = buffer.indexOf('\n\n');
    }
    if (final && buffer.trim()) {
      const parsed = parseBlock(buffer);
      if (parsed) events.push(parsed);
      buffer = '';
    }
    return events;
  };

  return {
    push(chunk: string): RawSSEEvent[] {
      let text = (pendingCR ? '\r' : '') + chunk;
      pendingCR = text.endsWith('\r');
      if (pendingCR) text = text.slice(0, -1);
      buffer += text.replace(/\r\n?/g, '\n');
      return drain(false);
    },
    flush(): RawSSEEvent[] {
      if (pendingCR) {
        buffer += '\n';
        pendingCR = false;
      }
      return drain(true);
    },
  };
};

const KNOWN_EVENTS = new Set<AIChatEvent['event']>([
  'message_start',
  'reasoning',
  'text',
  'message_end',
  'tool_start',
  'tool_end',
  'final',
  'error',
]);

export const toAIChatEvent = (raw: RawSSEEvent): AIChatEvent | null => {
  if (!KNOWN_EVENTS.has(raw.event as AIChatEvent['event'])) return null;
  try {
    return { event: raw.event, data: JSON.parse(raw.data) } as AIChatEvent;
  } catch {
    return null;
  }
};

/** POST /chat 返回非 2xx 时抛出，status 用于区分 401 / 409 / 其他 */
export class AIChatHttpError extends Error {
  status: number;

  constructor(status: number) {
    super(`AI chat request failed with status ${status}`);
    this.name = 'AIChatHttpError';
    this.status = status;
  }
}

export interface StreamChatOptions {
  conversationId: string;
  message: string;
  signal?: AbortSignal;
  onEvent: (event: AIChatEvent) => void;
}

/**
 * 调 POST /chat 并逐个回调 SSE 事件。fetch 不经过 axios 拦截器，
 * 所以 token 和 401 在这里按 axiosInstance 的同样逻辑处理。
 * 用 signal 中断时 reject 一个 AbortError。
 */
export const streamAIChat = async ({
  conversationId,
  message,
  signal,
  onEvent,
}: StreamChatOptions): Promise<void> => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${AI_API_BASE_URL}/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversation_id: conversationId, message }),
    signal,
  });

  if (response.status === 401) {
    // 与 axiosInstance 的 401 处理一致：清 token、回登录页
    localStorage.removeItem(AUTH_TOKEN_KEY);
    if (window.location.pathname !== LOGIN_PATH) {
      window.location.assign(LOGIN_PATH);
    }
    throw new AIChatHttpError(401);
  }
  if (!response.ok || !response.body) {
    throw new AIChatHttpError(response.status);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const parser = createSSEParser();
  const emit = (events: RawSSEEvent[]) => {
    events.forEach((raw) => {
      const event = toAIChatEvent(raw);
      if (event) onEvent(event);
    });
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) emit(parser.push(decoder.decode(value, { stream: true })));
  }
  emit(parser.push(decoder.decode()));
  emit(parser.flush());
};
