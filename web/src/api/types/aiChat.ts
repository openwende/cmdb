/**
 * AI 调查助手服务（wende-cmdb-ai）的接口类型
 */

export interface AIConversation {
  conversation_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIConversationListResponse {
  items: AIConversation[];
}

export interface AIStoredMessage {
  role: 'user' | 'assistant';
  /** 用户问题，或助手的最终回答（Markdown） */
  content: string;
  created_at?: string;
}

export interface AIConversationMessagesResponse {
  items: AIStoredMessage[];
}

export interface AIKnowledgeSection {
  id: string;
  doc: string;
  title: string;
  content: string;
}

export interface AIUsage {
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  cache_read_tokens?: number;
}

export interface AIFinalToolCall {
  name: string;
  input?: unknown;
  status?: 'success' | 'error';
  elapsed_ms?: number;
}

/** POST /chat 的 SSE 事件，event 名 + data JSON */
export type AIChatEvent =
  | { event: 'message_start'; data: { message_id: string } }
  | { event: 'reasoning'; data: { message_id: string; delta: string } }
  | { event: 'text'; data: { message_id: string; delta: string } }
  | {
      event: 'message_end';
      data: { message_id: string; finish_reason?: string; usage?: AIUsage };
    }
  | { event: 'tool_start'; data: { tool_call_id: string; name: string; input?: unknown } }
  | {
      event: 'tool_end';
      data: { tool_call_id: string; name: string; status: 'success' | 'error'; output?: string };
    }
  | {
      event: 'final';
      data: {
        answer: string;
        tool_calls?: AIFinalToolCall[];
        usage?: AIUsage;
        model_calls?: number;
        elapsed_ms?: number;
        trace_id?: string;
      };
    }
  | { event: 'error'; data: { message?: string } };

export type AIChatEventName = AIChatEvent['event'];
