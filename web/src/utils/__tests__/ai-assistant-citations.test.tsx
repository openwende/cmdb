import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import {
  collectCitationKeys,
  parseCitationContent,
  parseCitations,
  rewriteInlineIds,
} from '@/components/AIAssistant/citations';
import { CitationGroup } from '@/components/AIAssistant/CitationTag';
import MarkdownAnswer from '@/components/AIAssistant/MarkdownAnswer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { id?: string }) =>
      options?.id !== undefined ? `${key}:${options.id}` : key,
  }),
}));

const api = vi.hoisted(() => ({ getKnowledgeSection: vi.fn() }));
const businessApi = vi.hoisted(() => ({ getTopologyModule: vi.fn(), getTopologySet: vi.fn() }));

vi.mock('@/api/services/aiChat', () => api);
vi.mock('@/api/services/business', () => businessApi);

describe('parseCitations', () => {
  it('parses a single record citation', () => {
    expect(parseCitations('变更见[record_id=895]。')).toEqual([
      { type: 'text', value: '变更见' },
      { type: 'citation', raw: '[record_id=895]', items: [{ kind: 'record', id: '895' }] },
      { type: 'text', value: '。' },
    ]);
  });

  it('gives each id in a list its own item', () => {
    expect(parseCitationContent('record_id=700、701')).toEqual([
      { kind: 'record', id: '700' },
      { kind: 'record', id: '701' },
    ]);
    expect(parseCitationContent('record_id=700, 701,702')).toEqual([
      { kind: 'record', id: '700' },
      { kind: 'record', id: '701' },
      { kind: 'record', id: '702' },
    ]);
  });

  it('keeps only both ends of a range', () => {
    expect(parseCitationContent('record_id=800~802')).toEqual([
      { kind: 'record', id: '800' },
      { kind: 'record', id: '802' },
    ]);
    expect(parseCitationContent('record_id=800 ～ 805、900')).toEqual([
      { kind: 'record', id: '800' },
      { kind: 'record', id: '805' },
      { kind: 'record', id: '900' },
    ]);
  });

  it('splits mixed keys in one bracket', () => {
    expect(parseCitationContent('host_id=43, record_id=612')).toEqual([
      { kind: 'host', id: '43' },
      { kind: 'record', id: '612' },
    ]);
    expect(parseCitationContent('record_id=612、613，doc=主机流转规则#追加到业务模块')).toEqual([
      { kind: 'record', id: '612' },
      { kind: 'record', id: '613' },
      { kind: 'doc', id: '主机流转规则#追加到业务模块' },
    ]);
  });

  it('reads a doc value up to the closing bracket, even with 、 or spaces in the title', () => {
    expect(parseCitations('[doc=拓扑与空闲机池#删除和移动集群、模块]')).toEqual([
      {
        type: 'citation',
        raw: '[doc=拓扑与空闲机池#删除和移动集群、模块]',
        items: [{ kind: 'doc', id: '拓扑与空闲机池#删除和移动集群、模块' }],
      },
    ]);
    expect(parseCitationContent('doc=审计记录说明#归属变更的 from 和 to')).toEqual([
      { kind: 'doc', id: '审计记录说明#归属变更的 from 和 to' },
    ]);
  });

  it('only breaks a doc value before another key=', () => {
    expect(parseCitationContent('doc=主机流转规则#回收到资源池, record_id=895')).toEqual([
      { kind: 'doc', id: '主机流转规则#回收到资源池' },
      { kind: 'record', id: '895' },
    ]);
  });

  it('leaves non-citation brackets untouched', () => {
    const text = '见 [链接] 和 [1] 以及 ["gw","扩容"]、[module_id=a7] 还有 [record_id=abc]';
    expect(parseCitations(text)).toEqual([{ type: 'text', value: text }]);
  });

  it('keeps unknown keys next to known ones as plain items', () => {
    expect(parseCitationContent('host_id=43, matched=10')).toEqual([
      { kind: 'host', id: '43' },
      { kind: 'other', text: 'matched=10' },
    ]);
  });

  it('parses business, module, cluster and pool directory ids', () => {
    expect(parseCitationContent('business_id=1029, module_id=108、109')).toEqual([
      { kind: 'business', id: '1029' },
      { kind: 'module', id: '108' },
      { kind: 'module', id: '109' },
    ]);
    expect(parseCitationContent('set_id=38, directory_id=2')).toEqual([
      { kind: 'set', id: '38' },
      { kind: 'directory', id: '2' },
    ]);
  });

  it('treats a bracket of query conditions as one citation', () => {
    expect(parseCitationContent('ip=10.20.1.11, since=2026-09-01')).toEqual([
      { kind: 'other', text: 'ip=10.20.1.11' },
      { kind: 'other', text: 'since=2026-09-01' },
    ]);
    expect(parseCitationContent('record_id=abc, since=2026-09-01')).toBeNull();
  });
});

describe('rewriteInlineIds', () => {
  const none = new Set<string>();

  it('moves ids out of prose parentheses into citations', () => {
    expect(rewriteInlineIds('支付网关（module_id=97）和风控服务', none)).toBe(
      '支付网关[module_id=97]和风控服务',
    );
    expect(rewriteInlineIds('生产集群（set_id=35），属于同一业务', none)).toBe(
      '生产集群[set_id=35]，属于同一业务',
    );
  });

  it('keeps the other words in the parentheses', () => {
    expect(rewriteInlineIds('10.20.1.11（pay-gw-01，host_id=43）现在', none)).toBe(
      '10.20.1.11（pay-gw-01）[host_id=43]现在',
    );
    expect(rewriteInlineIds('支付网关（module_id=97，生产集群）', none)).toBe(
      '支付网关（生产集群）[module_id=97]',
    );
  });

  it('drops ids already cited in the same paragraph', () => {
    expect(rewriteInlineIds('10.20.1.11（pay-gw-01，host_id=43）', new Set(['host-43']))).toBe(
      '10.20.1.11（pay-gw-01）',
    );
    expect(rewriteInlineIds('主机（host_id=43）现在', new Set(['host-43']))).toBe('主机现在');
  });

  it('counts every id of a cited range as already cited', () => {
    const existing = collectCitationKeys('命中 4 台 [host_id=56~59]');
    expect(rewriteInlineIds('pay-db-02（10.20.4.12，host_id=57）', existing)).toBe(
      'pay-db-02（10.20.4.12）',
    );
  });

  it('leaves other parentheses alone', () => {
    const text = '8 核（32 GB）、状态 running (since=2026-09-01)、记录（record_id=abc）';
    expect(rewriteInlineIds(text, none)).toBe(text);
  });
});

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

const renderAnswer = (content: string) =>
  render(
    <MemoryRouter initialEntries={['/home']}>
      <Routes>
        <Route path="*" element={<MarkdownAnswer content={content} />} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );

describe('MarkdownAnswer', () => {
  it('renders markdown and turns citations into tags', async () => {
    const user = userEvent.setup();
    renderAnswer(
      [
        '### 结论',
        '主机同时在两个模块。[record_id=613]',
        '',
        '- 先转移 [record_id=800~802]',
        '- 主机 [host_id=43, record_id=612]',
        '- 规则 [doc=拓扑与空闲机池#删除和移动集群、模块]',
        '- 标签 ["gw","扩容"]',
      ].join('\n'),
    );

    expect(screen.getByRole('heading', { level: 3, name: '结论' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);

    expect(screen.getByText('aiAssistant.citation.record:613')).toBeInTheDocument();
    expect(screen.getByText('aiAssistant.citation.record:800')).toBeInTheDocument();
    expect(screen.getByText('aiAssistant.citation.record:802')).toBeInTheDocument();
    expect(screen.queryByText('aiAssistant.citation.record:801')).not.toBeInTheDocument();
    expect(screen.getByText('aiAssistant.citation.host:43')).toBeInTheDocument();
    expect(screen.getByText('aiAssistant.citation.record:612')).toBeInTheDocument();
    expect(screen.getByText('拓扑与空闲机池#删除和移动集群、模块')).toBeInTheDocument();
    expect(screen.getByText(/标签 \["gw","扩容"\]/)).toBeInTheDocument();

    // record 标签跳到审计详情，host 标签跳到主机详情深链
    await user.click(screen.getByText('aiAssistant.citation.record:613'));
    expect(screen.getByTestId('location')).toHaveTextContent('/analysis/audit?record_id=613');
    const hostTag = screen.getByText('aiAssistant.citation.host:43').closest('[role="link"]');
    expect(hostTag).not.toBeNull();
    await user.click(hostTag as HTMLElement);
    expect(screen.getByTestId('location')).toHaveTextContent('/resource/host?host_id=43');
  });

  it('opens the host deep link from the keyboard (Enter / Space)', async () => {
    const user = userEvent.setup();
    renderAnswer('主机 [host_id=7]');
    const hostTag = screen.getByRole('link', { name: /aiAssistant\.citation\.host:7/ });
    expect(hostTag).toHaveAttribute('tabindex', '0');
    expect(hostTag).toHaveAttribute('title', 'aiAssistant.citation.hostTip');

    hostTag.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('location')).toHaveTextContent('/resource/host?host_id=7');
  });

  it('opens the host deep link with Space', () => {
    renderAnswer('主机 [host_id=8]');
    const hostTag = screen.getByRole('link', { name: /aiAssistant\.citation\.host:8/ });
    fireEvent.keyDown(hostTag, { key: ' ' });
    expect(screen.getByTestId('location')).toHaveTextContent('/resource/host?host_id=8');
  });

  it('opens the business topology from a business citation', async () => {
    const user = userEvent.setup();
    renderAnswer('数据中台 [business_id=1029]');
    await user.click(screen.getByRole('link', { name: /aiAssistant\.citation\.business:1029/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/business/1029/topology');
  });

  it('looks up the business of a module and selects its tree node', async () => {
    const user = userEvent.setup();
    businessApi.getTopologyModule.mockImplementation(async (id: string) => ({
      code: 0,
      data: { id: Number(id), business_id: 1029, set_id: 38, name: 'm', is_default: id === '107' },
    }));
    renderAnswer('模块 [module_id=108] 和 [module_id=107]');

    await user.click(screen.getByRole('link', { name: /aiAssistant\.citation\.module:108/ }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/business/1029/topology?node=module-108',
      ),
    );
    await user.click(screen.getByRole('link', { name: /aiAssistant\.citation\.module:107/ }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/business/1029/topology?node=idle_module-107',
      ),
    );
  });

  it('selects the cluster node, including the idle pool', async () => {
    const user = userEvent.setup();
    businessApi.getTopologySet.mockImplementation(async (id: string) => ({
      code: 0,
      data: { id: Number(id), business_id: 1027, name: 's', is_default: id === '38' },
    }));
    renderAnswer('集群 [set_id=35] 和 [set_id=38]');

    await user.click(screen.getByRole('link', { name: /aiAssistant\.citation\.set:35/ }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/business/1027/topology?node=set-35',
      ),
    );
    await user.click(screen.getByRole('link', { name: /aiAssistant\.citation\.set:38/ }));
    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        '/business/1027/topology?node=idle_set-38',
      ),
    );
  });

  it('shows pool directories and query conditions as plain text', () => {
    renderAnswer('目录 [directory_id=2] 查询 [ip=10.20.1.11, since=2026-09-01]');
    expect(screen.getByText('aiAssistant.citation.directory:2')).toHaveClass('ai-citation-plain');
    expect(screen.getByText('ip=10.20.1.11')).toHaveClass('ai-citation-plain');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('turns prose ids into tags without repeating ones cited in the paragraph', () => {
    renderAnswer(
      '10.20.1.11（pay-gw-01，host_id=43）在支付网关（module_id=97）和生产集群（set_id=35）[host_id=43]',
    );
    expect(screen.getAllByText('aiAssistant.citation.host:43')).toHaveLength(1);
    expect(screen.getByText('aiAssistant.citation.module:97')).toBeInTheDocument();
    expect(screen.getByText('aiAssistant.citation.set:35')).toBeInTheDocument();
    expect(screen.getByText(/10\.20\.1\.11（pay-gw-01）在支付网关/)).toBeInTheDocument();
    expect(screen.queryByText(/module_id=97/)).not.toBeInTheDocument();
  });

  it('does not touch brackets inside code', () => {
    renderAnswer('`[record_id=1]`');
    expect(screen.getByText('[record_id=1]').tagName).toBe('CODE');
    expect(screen.queryByText('aiAssistant.citation.record:1')).not.toBeInTheDocument();
  });
});

describe('doc citation popover', () => {
  it('Esc closes only the popover, not the drawer around it', async () => {
    api.getKnowledgeSection.mockResolvedValue({
      id: '主机流转规则#回收到资源池',
      doc: '主机流转规则',
      title: '回收到资源池',
      content: '回收是把主机从业务退回资源池。',
    });
    const drawerKeyDown = vi.fn();
    render(
      <MemoryRouter>
        <div onKeyDown={(event) => drawerKeyDown(event.key)}>
          <CitationGroup items={[{ kind: 'doc', id: '主机流转规则#回收到资源池' }]} />
        </div>
      </MemoryRouter>,
    );

    const tag = screen.getByRole('button', { name: /主机流转规则#回收到资源池/ });
    fireEvent.click(tag);
    expect(await screen.findByText('回收是把主机从业务退回资源池。')).toBeInTheDocument();
    expect(api.getKnowledgeSection).toHaveBeenCalledWith('主机流转规则#回收到资源池');
    expect(tag).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(tag, { key: 'Escape' });
    expect(drawerKeyDown).not.toHaveBeenCalled();
    await waitFor(() => expect(tag).toHaveAttribute('aria-expanded', 'false'));

    // 气泡已关时 Esc 照常冒泡，抽屉可以用 Esc 关闭
    fireEvent.keyDown(tag, { key: 'Escape' });
    expect(drawerKeyDown).toHaveBeenCalledWith('Escape');
  });

  it('Esc still closes the popover after focus moved to body (clicked its text)', async () => {
    api.getKnowledgeSection.mockResolvedValue({
      id: '主机流转规则#故障机',
      doc: '主机流转规则',
      title: '故障机',
      content: '故障机不能分配给业务。',
    });
    render(
      <MemoryRouter>
        <CitationGroup items={[{ kind: 'doc', id: '主机流转规则#故障机' }]} />
      </MemoryRouter>,
    );

    const tag = screen.getByRole('button', { name: /主机流转规则#故障机/ });
    fireEvent.click(tag);
    fireEvent.click(await screen.findByText('故障机不能分配给业务。'));
    expect(tag).toHaveAttribute('aria-expanded', 'true');

    const outerKeyDown = vi.fn();
    document.addEventListener('keydown', outerKeyDown);
    try {
      fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() => expect(tag).toHaveAttribute('aria-expanded', 'false'));
      // 被气泡拦下，不会继续传给抽屉等外层监听
      expect(outerKeyDown).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', outerKeyDown);
    }
  });
});
