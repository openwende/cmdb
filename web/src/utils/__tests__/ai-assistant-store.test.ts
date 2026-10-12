import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AIChatEvent } from '@/api/types/aiChat';

const api = vi.hoisted(() => ({
  streamAIChat: vi.fn(),
  listAIConversations: vi.fn(),
  getAIConversationMessages: vi.fn(),
  deleteAIConversation: vi.fn(),
}));

vi.mock('@/api/services/aiChat', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/services/aiChat')>('@/api/services/aiChat');
  return { ...actual, ...api };
});

import { AIChatHttpError } from '@/api/services/aiChat';
import {
  applyChatEvent,
  generateConversationId,
  useAIAssistantSceneStore,
  type AIChatMessage,
} from '@/store/AIAssistantSceneStore';

const base: AIChatMessage = { key: 'a', role: 'assistant', content: '', status: 'streaming' };

const run = (events: AIChatEvent[], start = base) =>
  events.reduce(
    (message, event, index) => applyChatEvent(message, event, 1000 + index * 100),
    start,
  );

describe('applyChatEvent', () => {
  it('replaces interim text when a new model call starts, final answer wins', () => {
    const message = run([
      { event: 'message_start', data: { message_id: 'm1' } },
      { event: 'reasoning', data: { message_id: 'm1', delta: '想' } },
      { event: 'reasoning', data: { message_id: 'm1', delta: '一下' } },
      { event: 'text', data: { message_id: 'm1', delta: '我先查' } },
      { event: 'text', data: { message_id: 'm1', delta: '一下' } },
    ]);
    expect(message.content).toBe('我先查一下');
    expect(message.reasoning).toBe('想一下');

    const next = run(
      [
        { event: 'reasoning', data: { message_id: 'm2', delta: '再想' } },
        { event: 'text', data: { message_id: 'm2', delta: '### 结论' } },
      ],
      message,
    );
    expect(next.content).toBe('### 结论');
    expect(next.reasoning).toBe('想一下\n\n再想');

    const done = applyChatEvent(next, {
      event: 'final',
      data: {
        answer: '### 结论\n最终回答',
        tool_calls: [],
        usage: { input_tokens: 100, output_tokens: 20 },
        elapsed_ms: 3200,
      },
    });
    expect(done.content).toBe('### 结论\n最终回答');
    expect(done.status).toBe('done');
    expect(done.stats).toEqual({
      toolCalls: 0,
      elapsedMs: 3200,
      inputTokens: 100,
      outputTokens: 20,
    });
  });

  it('tracks tool steps and prefers server-side elapsed time', () => {
    const message = run([
      { event: 'tool_start', data: { tool_call_id: 'c1', name: 'get_host', input: { ip: '1' } } },
      { event: 'tool_start', data: { tool_call_id: 'c2', name: 'search_knowledge', input: {} } },
      {
        event: 'tool_end',
        data: { tool_call_id: 'c2', name: 'search_knowledge', status: 'error', output: 'x' },
      },
    ]);
    expect(message.steps?.map((s) => [s.id, s.status])).toEqual([
      ['c1', 'pending'],
      ['c2', 'error'],
    ]);
    expect(message.steps?.[1].elapsedMs).toBe(100);

    const done = applyChatEvent(message, {
      event: 'final',
      data: {
        answer: 'ok',
        tool_calls: [
          { name: 'get_host', elapsed_ms: 123 },
          { name: 'search_knowledge', elapsed_ms: 456 },
        ],
      },
    });
    expect(done.steps?.map((s) => s.elapsedMs)).toEqual([123, 456]);
    expect(done.stats?.toolCalls).toBe(2);
  });

  it('marks the message as failed on an error event', () => {
    const message = applyChatEvent(base, { event: 'error', data: { message: 'boom' } });
    expect(message.status).toBe('error');
    expect(message.errorKey).toBe('aiAssistant.errors.server');
    expect(message.errorDetail).toBe('boom');
  });
});

describe('generateConversationId', () => {
  it('only uses characters the AI service accepts', () => {
    expect(generateConversationId()).toMatch(/^[A-Za-z0-9_-]{1,128}$/);
  });
});

describe('AIAssistantSceneStore', () => {
  beforeEach(() => {
    useAIAssistantSceneStore.getState().reset();
    api.listAIConversations.mockResolvedValue({ items: [] });
  });

  it('streams an answer into the conversation and keeps the id for follow-ups', async () => {
    api.streamAIChat.mockImplementation(async ({ onEvent }) => {
      onEvent({ event: 'text', data: { message_id: 'm1', delta: '半句' } });
      onEvent({ event: 'final', data: { answer: '完整回答', tool_calls: [] } });
    });

    await useAIAssistantSceneStore.getState().send('  问题一  ');
    const state = useAIAssistantSceneStore.getState();
    expect(state.streaming).toBe(false);
    expect(state.messages.map((m) => [m.role, m.content, m.status])).toEqual([
      ['user', '问题一', undefined],
      ['assistant', '完整回答', 'done'],
    ]);
    const conversationId = state.activeConversationId;
    expect(api.streamAIChat.mock.calls[0][0]).toMatchObject({ conversationId, message: '问题一' });
    expect(api.listAIConversations).toHaveBeenCalled();

    await useAIAssistantSceneStore.getState().send('追问');
    expect(api.streamAIChat.mock.calls[1][0].conversationId).toBe(conversationId);
  });

  it('stop aborts the request and keeps what was generated', async () => {
    let signal: AbortSignal | undefined;
    api.streamAIChat.mockImplementation(
      ({ onEvent, signal: s }) =>
        new Promise((_resolve, reject) => {
          signal = s;
          onEvent({ event: 'text', data: { message_id: 'm1', delta: '生成了一半' } });
          s.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );

    const pending = useAIAssistantSceneStore.getState().send('问题');
    expect(useAIAssistantSceneStore.getState().streaming).toBe(true);
    useAIAssistantSceneStore.getState().stop();
    await pending;

    expect(signal?.aborted).toBe(true);
    const [, assistant] = useAIAssistantSceneStore.getState().messages;
    expect(assistant.status).toBe('stopped');
    expect(assistant.content).toBe('生成了一半');
    expect(useAIAssistantSceneStore.getState().streaming).toBe(false);
  });

  it('maps 409 and connection failures to error messages', async () => {
    api.streamAIChat.mockRejectedValueOnce(new AIChatHttpError(409));
    await useAIAssistantSceneStore.getState().send('a');
    api.streamAIChat.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await useAIAssistantSceneStore.getState().send('b');
    api.streamAIChat.mockResolvedValueOnce(undefined);
    await useAIAssistantSceneStore.getState().send('c');

    const errors = useAIAssistantSceneStore
      .getState()
      .messages.filter((m) => m.role === 'assistant')
      .map((m) => m.errorKey);
    expect(errors).toEqual([
      'aiAssistant.errors.busy',
      'aiAssistant.errors.connectionFailed',
      'aiAssistant.errors.incomplete',
    ]);
  });

  it('restores a conversation from history and removes it', async () => {
    api.getAIConversationMessages.mockResolvedValue({
      items: [
        { role: 'user', content: '问题' },
        { role: 'assistant', content: '回答 [record_id=1]' },
      ],
    });
    api.deleteAIConversation.mockResolvedValue(undefined);
    useAIAssistantSceneStore.setState({
      conversations: [{ conversation_id: 'conv-a', title: '问题', created_at: '', updated_at: '' }],
    });

    await useAIAssistantSceneStore.getState().selectConversation('conv-a');
    let state = useAIAssistantSceneStore.getState();
    expect(state.activeConversationId).toBe('conv-a');
    expect(state.messages.map((m) => [m.role, m.content])).toEqual([
      ['user', '问题'],
      ['assistant', '回答 [record_id=1]'],
    ]);

    await useAIAssistantSceneStore.getState().removeConversation('conv-a');
    state = useAIAssistantSceneStore.getState();
    expect(api.deleteAIConversation).toHaveBeenCalledWith('conv-a');
    expect(state.conversations).toEqual([]);
    expect(state.activeConversationId).toBeNull();
    expect(state.messages).toEqual([]);
  });
});
