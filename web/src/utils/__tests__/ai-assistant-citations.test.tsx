import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { parseCitationContent, parseCitations } from '@/components/AIAssistant/citations';
import MarkdownAnswer from '@/components/AIAssistant/MarkdownAnswer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { id?: string }) =>
      options?.id !== undefined ? `${key}:${options.id}` : key,
  }),
}));

vi.mock('@/api/services/aiChat', () => ({
  getKnowledgeSection: vi.fn(),
}));

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
    const text = '见 [链接] 和 [1] 以及 ["gw","扩容"]、[module_id=97] 还有 [record_id=abc]';
    expect(parseCitations(text)).toEqual([{ type: 'text', value: text }]);
  });

  it('keeps unknown keys next to known ones as plain items', () => {
    expect(parseCitationContent('host_id=43, module_id=97')).toEqual([
      { kind: 'host', id: '43' },
      { kind: 'other', text: 'module_id=97' },
    ]);
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

    // host 标签不可点击，record 标签可以跳到审计详情
    expect(screen.getByText('aiAssistant.citation.host:43').closest('[role="link"]')).toBeNull();
    await user.click(screen.getByText('aiAssistant.citation.record:613'));
    expect(screen.getByTestId('location')).toHaveTextContent('/analysis/audit?record_id=613');
  });

  it('does not touch brackets inside code', () => {
    renderAnswer('`[record_id=1]`');
    expect(screen.getByText('[record_id=1]').tagName).toBe('CODE');
    expect(screen.queryByText('aiAssistant.citation.record:1')).not.toBeInTheDocument();
  });
});
