import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  streamAIChat: vi.fn(),
  listAIConversations: vi.fn(),
  getAIConversationMessages: vi.fn(),
  deleteAIConversation: vi.fn(),
  getKnowledgeSection: vi.fn(),
}));

vi.mock('@/api/services/aiChat', async () => {
  const actual =
    await vi.importActual<typeof import('@/api/services/aiChat')>('@/api/services/aiChat');
  return { ...actual, ...api };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      key.startsWith('aiAssistant.tools.unknown') && options?.defaultValue
        ? options.defaultValue
        : key,
  }),
}));

import AIAssistantDrawer from '@/components/AIAssistant/AIAssistantDrawer';
import { useAIAssistantSceneStore } from '@/store/AIAssistantSceneStore';

// jsdom 缺这几个浏览器 API：AntD 响应式、Bubble.List 自动滚动、ThoughtChain 标题溢出检测
beforeAll(() => {
  Element.prototype.scrollTo = vi.fn() as unknown as Element['scrollTo'];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});

const renderDrawer = () =>
  render(
    <MemoryRouter>
      <AIAssistantDrawer />
    </MemoryRouter>,
  );

describe('AI assistant drawer', () => {
  beforeEach(() => {
    useAIAssistantSceneStore.getState().reset();
    api.listAIConversations.mockResolvedValue({
      items: [
        {
          conversation_id: 'conv-a',
          title: '10.20.1.11 为什么同时在两个模块？',
          created_at: '2026-10-12T09:16:55Z',
          updated_at: '2026-10-12T09:17:13Z',
        },
      ],
    });
  });

  it('shows the welcome state and sends an example question', async () => {
    api.streamAIChat.mockResolvedValue(undefined);
    useAIAssistantSceneStore.setState({ open: true });
    const user = userEvent.setup();
    renderDrawer();

    expect(await screen.findByText('aiAssistant.welcome.title')).toBeInTheDocument();
    const prompt = screen.getByText('aiAssistant.welcome.prompts.hostModules');
    expect(screen.getByText('aiAssistant.welcome.prompts.faultVsReclaim')).toBeInTheDocument();
    expect(screen.getByText('aiAssistant.welcome.prompts.recentReclaim')).toBeInTheDocument();

    await user.click(prompt);
    await waitFor(() =>
      expect(api.streamAIChat).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'aiAssistant.welcome.prompts.hostModules' }),
      ),
    );
  });

  it('renders reasoning, tool steps, answer, stopped tag and stats', async () => {
    useAIAssistantSceneStore.setState({
      open: true,
      activeConversationId: 'conv-a',
      messages: [
        { key: 'u1', role: 'user', content: '问题' },
        {
          key: 'a1',
          role: 'assistant',
          content: '### 结论\n见 [record_id=613]',
          reasoning: '先查主机',
          status: 'done',
          steps: [
            {
              id: 'c1',
              name: 'get_host',
              input: { ip: '10.20.1.11' },
              output: '{"host_id":43}',
              status: 'success',
              startedAt: 0,
              elapsedMs: 123,
            },
            { id: 'c2', name: 'unknown_tool', status: 'pending', startedAt: 0 },
          ],
          stats: { toolCalls: 2, elapsedMs: 17361, inputTokens: 100, outputTokens: 20 },
        },
        { key: 'u2', role: 'user', content: '追问' },
        { key: 'a2', role: 'assistant', content: '一半', status: 'stopped' },
      ],
    });
    renderDrawer();

    expect(await screen.findByText('aiAssistant.message.reasoning')).toBeInTheDocument();
    // 思考过程默认折叠
    expect(screen.queryByText('先查主机')).not.toBeInTheDocument();
    expect(screen.getByText('aiAssistant.tools.get_host')).toBeInTheDocument();
    expect(screen.getByText('unknown_tool')).toBeInTheDocument();
    expect(screen.getByText('aiAssistant.steps.interrupted')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '结论' })).toBeInTheDocument();
    expect(screen.getByText('aiAssistant.citation.record')).toBeInTheDocument();
    expect(screen.getByText('aiAssistant.message.stopped')).toBeInTheDocument();
    expect(screen.getByText('aiAssistant.message.stats')).toBeInTheDocument();
  });

  it('lists history conversations', async () => {
    useAIAssistantSceneStore.setState({ open: true, view: 'history' });
    renderDrawer();
    expect(await screen.findByText('10.20.1.11 为什么同时在两个模块？')).toBeInTheDocument();
    expect(api.listAIConversations).toHaveBeenCalled();
  });
});
