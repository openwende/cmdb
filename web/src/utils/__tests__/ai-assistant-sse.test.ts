import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AIChatHttpError,
  createSSEParser,
  streamAIChat,
  toAIChatEvent,
} from '@/api/services/aiChat';
import type { AIChatEvent } from '@/api/types/aiChat';
import { AUTH_TOKEN_KEY } from '@/constants/auth';

// sse-starlette 的真实格式：\r\n 换行，空行分隔事件，中间夹 ping 注释
const SAMPLE =
  'event: message_start\r\ndata: {"message_id": "m1"}\r\n\r\n' +
  ': ping - 2026-10-12 09:00:00\r\n\r\n' +
  'event: text\r\ndata: {"message_id": "m1", "delta": "你好"}\r\n\r\n' +
  'event: tool_start\r\ndata: {"tool_call_id": "c1", "name": "get_host", "input": {"ip": "10.20.1.11"}}\r\n\r\n' +
  'event: final\r\ndata: {"answer": "### 结论\\n完成 [record_id=1]", "tool_calls": []}\r\n\r\n';

const streamOf = (text: string, chunkSize: number) => {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });
};

describe('createSSEParser', () => {
  it('parses CRLF events, skips comments', () => {
    const parser = createSSEParser();
    const events = [...parser.push(SAMPLE), ...parser.flush()];
    expect(events.map((e) => e.event)).toEqual(['message_start', 'text', 'tool_start', 'final']);
    expect(JSON.parse(events[1].data)).toEqual({ message_id: 'm1', delta: '你好' });
  });

  it('handles chunks split anywhere, including between \\r and \\n', () => {
    for (const size of [1, 2, 3, 7, 50]) {
      const parser = createSSEParser();
      const events = [];
      for (let i = 0; i < SAMPLE.length; i += size) {
        events.push(...parser.push(SAMPLE.slice(i, i + size)));
      }
      events.push(...parser.flush());
      expect(events.map((e) => e.event)).toEqual(['message_start', 'text', 'tool_start', 'final']);
    }
  });

  it('ignores unknown events and broken JSON', () => {
    expect(toAIChatEvent({ event: 'unknown', data: '{}' })).toBeNull();
    expect(toAIChatEvent({ event: 'text', data: '{oops' })).toBeNull();
    expect(toAIChatEvent({ event: 'error', data: '{"message":"boom"}' })).toEqual({
      event: 'error',
      data: { message: 'boom' },
    });
  });
});

describe('streamAIChat', () => {
  const fetchMock = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem(AUTH_TOKEN_KEY, 'test-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  it('sends the JWT and emits parsed events from a byte stream', async () => {
    fetchMock.mockResolvedValue(new Response(streamOf(SAMPLE, 5), { status: 200 }));
    const events: AIChatEvent[] = [];

    await streamAIChat({
      conversationId: 'conv-1',
      message: '你好',
      onEvent: (e) => events.push(e),
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:8090/chat');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(init.body)).toEqual({ conversation_id: 'conv-1', message: '你好' });
    expect(events.map((e) => e.event)).toEqual(['message_start', 'text', 'tool_start', 'final']);
  });

  it('throws a 409 error so the UI can say the previous message is still running', async () => {
    fetchMock.mockResolvedValue(new Response('{"detail":"busy"}', { status: 409 }));
    await expect(
      streamAIChat({ conversationId: 'conv-1', message: 'x', onEvent: vi.fn() }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('clears the token and goes to login on 401', async () => {
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname: '/analysis/audit', assign },
    });
    fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));

    await expect(
      streamAIChat({ conversationId: 'conv-1', message: 'x', onEvent: vi.fn() }),
    ).rejects.toBeInstanceOf(AIChatHttpError);
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(assign).toHaveBeenCalledWith('/login');
  });
});
