import { create } from 'zustand';
import {
  AIChatHttpError,
  deleteAIConversation,
  getAIConversationMessages,
  listAIConversations,
  streamAIChat,
} from '@/api/services/aiChat';
import type { AIChatEvent, AIConversation } from '@/api/types/aiChat';

/**
 * AI 调查助手的场景 store：抽屉开关、会话列表、当前会话的消息和流式状态。
 * 抽屉挂在 MainLayout，切换页面时状态保留在这里。
 */

export type AIToolStepStatus = 'pending' | 'success' | 'error';

export interface AIToolStep {
  id: string;
  name: string;
  input?: unknown;
  output?: string;
  status: AIToolStepStatus;
  startedAt: number;
  elapsedMs?: number;
}

export type AIAssistantMessageStatus = 'streaming' | 'done' | 'stopped' | 'error';

export interface AIChatStats {
  toolCalls: number;
  elapsedMs: number;
  inputTokens: number;
  outputTokens: number;
}

export interface AIChatMessage {
  key: string;
  role: 'user' | 'assistant';
  /** 用户问题；助手消息是当前回答文本，收到 final 后换成最终回答 */
  content: string;
  reasoning?: string;
  steps?: AIToolStep[];
  status?: AIAssistantMessageStatus;
  /** 错误提示的 i18n key */
  errorKey?: string;
  /** 服务端 error 事件带回的原文 */
  errorDetail?: string;
  stats?: AIChatStats;
  /** 当前 content / reasoning 属于哪次模型调用，换了一次调用时文本重新开始 */
  textMessageId?: string;
  reasoningMessageId?: string;
}

export type AIAssistantView = 'chat' | 'history';

let keySeed = 0;
const nextKey = (prefix: string) => {
  keySeed += 1;
  return `${prefix}-${Date.now().toString(36)}-${keySeed}`;
};

/** conversation_id 只能是字母、数字、`_`、`-`，最长 128 */
export const generateConversationId = (): string =>
  `conv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * 把一个 SSE 事件合并进助手消息（纯函数）。
 * 一轮回答里会有多次模型调用：工具调用前的过渡语也走 text，
 * 新一次调用开始出文本时替换掉上一段；最终回答以 final.answer 为准。
 */
export const applyChatEvent = (
  message: AIChatMessage,
  event: AIChatEvent,
  now: number = Date.now(),
): AIChatMessage => {
  switch (event.event) {
    case 'reasoning': {
      const { message_id: id, delta } = event.data;
      const prev = message.reasoning ?? '';
      const sameCall = message.reasoningMessageId === id;
      return {
        ...message,
        reasoning: sameCall || !prev ? prev + delta : `${prev}\n\n${delta}`,
        reasoningMessageId: id,
      };
    }
    case 'text': {
      const { message_id: id, delta } = event.data;
      const sameCall = message.textMessageId === id;
      return {
        ...message,
        content: sameCall ? message.content + delta : delta,
        textMessageId: id,
      };
    }
    case 'tool_start': {
      const { tool_call_id: id, name, input } = event.data;
      const steps = message.steps ?? [];
      if (steps.some((step) => step.id === id)) return message;
      return {
        ...message,
        steps: [...steps, { id, name, input, status: 'pending', startedAt: now }],
      };
    }
    case 'tool_end': {
      const { tool_call_id: id, name, status, output } = event.data;
      const steps = message.steps ?? [];
      const exists = steps.some((step) => step.id === id);
      const nextSteps = exists
        ? steps.map((step) =>
            step.id === id
              ? { ...step, status, output, elapsedMs: Math.max(0, now - step.startedAt) }
              : step,
          )
        : [...steps, { id, name, status, output, startedAt: now }];
      return { ...message, steps: nextSteps };
    }
    case 'final': {
      const { answer, tool_calls: toolCalls = [], usage, elapsed_ms: elapsedMs } = event.data;
      // 服务端统计的工具耗时更准，按顺序对上名字时覆盖前端计时
      const steps = (message.steps ?? []).map((step, index) => {
        const call = toolCalls[index];
        return call && call.name === step.name && typeof call.elapsed_ms === 'number'
          ? { ...step, elapsedMs: call.elapsed_ms }
          : step;
      });
      return {
        ...message,
        content: answer ?? message.content,
        steps,
        status: 'done',
        stats: {
          toolCalls: toolCalls.length,
          elapsedMs: elapsedMs ?? 0,
          inputTokens: usage?.input_tokens ?? 0,
          outputTokens: usage?.output_tokens ?? 0,
        },
      };
    }
    case 'error':
      return {
        ...message,
        status: 'error',
        errorKey: 'aiAssistant.errors.server',
        errorDetail: event.data?.message,
      };
    default:
      return message;
  }
};

/** 把请求失败映射到 i18n key */
export const getChatErrorKey = (error: unknown): string => {
  if (error instanceof AIChatHttpError) {
    if (error.status === 401) return 'common.errors.unauthorized';
    if (error.status === 409) return 'aiAssistant.errors.busy';
    return 'aiAssistant.errors.requestFailed';
  }
  // fetch 连不上服务（服务停了、CORS、断网）时抛 TypeError
  return 'aiAssistant.errors.connectionFailed';
};

const getHttpStatus = (error: unknown): number | undefined =>
  (error as { response?: { status?: number } })?.response?.status;

interface AIAssistantSceneState {
  open: boolean;
  view: AIAssistantView;
  conversations: AIConversation[];
  conversationsLoading: boolean;
  conversationsError: boolean;
  activeConversationId: string | null;
  messages: AIChatMessage[];
  messagesLoading: boolean;
  /** 加载历史消息失败时的 i18n key */
  messagesErrorKey: string | null;
  streaming: boolean;

  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setView: (view: AIAssistantView) => void;
  loadConversations: () => Promise<void>;
  newConversation: () => void;
  selectConversation: (conversationId: string) => Promise<void>;
  removeConversation: (conversationId: string) => Promise<void>;
  send: (text: string) => Promise<void>;
  stop: () => void;
  reset: () => void;
}

let activeController: AbortController | null = null;

const initialState = {
  open: false,
  view: 'chat' as AIAssistantView,
  conversations: [] as AIConversation[],
  conversationsLoading: false,
  conversationsError: false,
  activeConversationId: null as string | null,
  messages: [] as AIChatMessage[],
  messagesLoading: false,
  messagesErrorKey: null as string | null,
  streaming: false,
};

export const useAIAssistantSceneStore = create<AIAssistantSceneState>((set, get) => {
  const updateMessage = (key: string, update: (message: AIChatMessage) => AIChatMessage) => {
    set((state) => ({
      messages: state.messages.map((message) => (message.key === key ? update(message) : message)),
    }));
  };

  return {
    ...initialState,

    setOpen: (open) => set({ open }),
    toggleOpen: () => set((state) => ({ open: !state.open })),
    setView: (view) => set({ view }),

    loadConversations: async () => {
      set({ conversationsLoading: true, conversationsError: false });
      try {
        const response = await listAIConversations();
        set({ conversations: response?.items ?? [], conversationsLoading: false });
      } catch {
        set({ conversationsLoading: false, conversationsError: true });
      }
    },

    newConversation: () => {
      get().stop();
      set({
        activeConversationId: null,
        messages: [],
        messagesLoading: false,
        messagesErrorKey: null,
        view: 'chat',
      });
    },

    selectConversation: async (conversationId) => {
      if (conversationId === get().activeConversationId && !get().messagesErrorKey) {
        set({ view: 'chat' });
        return;
      }
      get().stop();
      set({
        activeConversationId: conversationId,
        messages: [],
        messagesLoading: true,
        messagesErrorKey: null,
        view: 'chat',
      });
      try {
        const response = await getAIConversationMessages(conversationId);
        if (get().activeConversationId !== conversationId) return;
        const messages: AIChatMessage[] = (response?.items ?? []).map((item) => ({
          key: nextKey(item.role),
          role: item.role,
          content: item.content,
          ...(item.role === 'assistant' ? { status: 'done' as const } : {}),
        }));
        set({ messages, messagesLoading: false });
      } catch (error) {
        if (get().activeConversationId !== conversationId) return;
        set({
          messagesLoading: false,
          messagesErrorKey:
            getHttpStatus(error) === 404
              ? 'aiAssistant.history.notFound'
              : 'aiAssistant.history.loadMessagesFailed',
        });
      }
    },

    removeConversation: async (conversationId) => {
      await deleteAIConversation(conversationId);
      set((state) => ({
        conversations: state.conversations.filter(
          (item) => item.conversation_id !== conversationId,
        ),
      }));
      if (get().activeConversationId === conversationId) {
        get().newConversation();
        set({ view: 'history' });
      }
    },

    send: async (text) => {
      const question = text.trim();
      if (!question || get().streaming) return;

      const conversationId = get().activeConversationId ?? generateConversationId();
      const assistantKey = nextKey('assistant');
      set((state) => ({
        activeConversationId: conversationId,
        view: 'chat',
        streaming: true,
        messagesErrorKey: null,
        messages: [
          ...state.messages,
          { key: nextKey('user'), role: 'user', content: question },
          { key: assistantKey, role: 'assistant', content: '', status: 'streaming' },
        ],
      }));

      const controller = new AbortController();
      activeController = controller;

      try {
        await streamAIChat({
          conversationId,
          message: question,
          signal: controller.signal,
          onEvent: (event) =>
            updateMessage(assistantKey, (message) => applyChatEvent(message, event)),
        });
        // 流结束了却没有 final / error：连接被意外断开
        updateMessage(assistantKey, (message) =>
          message.status === 'streaming'
            ? { ...message, status: 'error', errorKey: 'aiAssistant.errors.incomplete' }
            : message,
        );
      } catch (error) {
        updateMessage(assistantKey, (message) => {
          if (message.status !== 'streaming') return message;
          if (controller.signal.aborted) return { ...message, status: 'stopped' };
          return { ...message, status: 'error', errorKey: getChatErrorKey(error) };
        });
      } finally {
        if (activeController === controller) {
          activeController = null;
          set({ streaming: false });
        }
        // 新会话的标题、更新时间都在服务端，回答结束后刷新一次列表
        void get().loadConversations();
      }
    },

    stop: () => {
      const controller = activeController;
      if (!controller) return;
      activeController = null;
      controller.abort();
      set((state) => ({
        streaming: false,
        messages: state.messages.map((message) =>
          message.status === 'streaming' ? { ...message, status: 'stopped' } : message,
        ),
      }));
    },

    reset: () => {
      get().stop();
      set({ ...initialState });
    },
  };
});
