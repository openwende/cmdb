import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { CitationGroup } from '@/components/AIAssistant/CitationTag';
import MarkdownAnswer from '@/components/AIAssistant/MarkdownAnswer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { id?: string }) =>
      options?.id !== undefined ? `${key}:${options.id}` : key,
  }),
}));

const api = vi.hoisted(() => ({ getKnowledgeSection: vi.fn() }));

vi.mock('@/api/services/aiChat', () => api);

const renderAnswer = (content: string) =>
  render(
    <MemoryRouter>
      <MarkdownAnswer content={content} />
    </MemoryRouter>,
  );

const strongTexts = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('strong')).map((node) => node.textContent);

describe('MarkdownAnswer CJK emphasis', () => {
  // 前三条在纯 CommonMark 下本来就能渲染，留作回归，防止插件改坏常见写法
  it('renders bold right before a full-width colon', () => {
    const { container } = renderAnswer('**主机状态**：故障');
    expect(strongTexts(container)).toEqual(['主机状态']);
    expect(container).not.toHaveTextContent('**');
  });

  it('renders bold inside full-width parentheses', () => {
    const { container } = renderAnswer('当前状态（**故障**）需要处理');
    expect(strongTexts(container)).toEqual(['故障']);
    expect(container).not.toHaveTextContent('**');
  });

  it('renders bold right before a full-width comma with text after it', () => {
    const { container } = renderAnswer('**注意**，这台主机还在业务模块里');
    expect(strongTexts(container)).toEqual(['注意']);
    expect(container).toHaveTextContent('注意，这台主机还在业务模块里');
  });

  // 纯 CommonMark 下不生效的写法：`**` 内侧是全角标点、外侧紧挨汉字，
  // 定界符既不算左侧也不算右侧，星号原样显示
  it('renders bold whose content starts or ends with full-width punctuation', () => {
    const cases: Array<[string, string]> = [
      ['**主机状态：**故障', '主机状态：'],
      ['这是**（故障）**主机', '（故障）'],
      ['**注意，**这台主机还在业务模块里', '注意，'],
      ['状态为**“待回收”**的主机', '“待回收”'],
      ['结论：**在两个模块。**后续再处理', '在两个模块。'],
    ];
    for (const [content, bold] of cases) {
      const { container, unmount } = renderAnswer(content);
      expect(strongTexts(container)).toEqual([bold]);
      expect(container).not.toHaveTextContent('**');
      unmount();
    }
  });

  it('handles several bold spans in one list', () => {
    const { container } = renderAnswer(
      ['- **结论：**在两个模块', '- 状态（**待回收**）', '- **注意**，先转移'].join('\n'),
    );
    expect(strongTexts(container)).toEqual(['结论：', '待回收', '注意']);
  });
});

describe('MarkdownAnswer keeps existing rendering', () => {
  it('renders GFM tables with bold cells and citations inside', () => {
    const { container } = renderAnswer(
      [
        '| 主机 | 状态 | 依据 |',
        '| --- | --- | --- |',
        '| 10.20.1.11 | **故障：**待处理 | [record_id=895] |',
      ].join('\n'),
    );
    expect(container.querySelector('.ai-markdown__table table')).not.toBeNull();
    expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      '主机',
      '状态',
      '依据',
    ]);
    expect(strongTexts(container)).toEqual(['故障：']);
    expect(screen.getByText('aiAssistant.citation.record:895')).toBeInTheDocument();
  });

  it('still turns record and doc citations next to bold text into tags', () => {
    const { container } = renderAnswer(
      '**原因：**主机被追加到第二个模块[record_id=612]，规则见[doc=主机流转规则#回收到资源池]。',
    );
    expect(strongTexts(container)).toEqual(['原因：']);
    expect(screen.getByText('aiAssistant.citation.record:612')).toBeInTheDocument();
    expect(screen.getByText('主机流转规则#回收到资源池')).toBeInTheDocument();
    expect(container).not.toHaveTextContent('[record_id=612]');
  });

  it('leaves code spans and fenced code blocks literal', () => {
    const { container } = renderAnswer(
      ['`**主机状态**：`', '', '```', '**故障**，[record_id=1]', '```'].join('\n'),
    );
    expect(container.querySelector('strong')).toBeNull();
    expect(screen.getByText('**主机状态**：').tagName).toBe('CODE');
    expect(container.querySelector('pre code')).toHaveTextContent('**故障**，[record_id=1]');
    expect(screen.queryByText('aiAssistant.citation.record:1')).not.toBeInTheDocument();
  });
});

describe('MarkdownAnswer tildes', () => {
  // 单个 ~ 在回答里几乎都是范围（01~08、800~802），不能当删除线
  it('does not strike through text between single-tilde ranges', () => {
    const { container } = renderAnswer('主机编号 01~08（11~18）都在资源池，变更见 800~802 号记录');
    expect(container.querySelector('del')).toBeNull();
    expect(container).toHaveTextContent('主机编号 01~08（11~18）都在资源池，变更见 800~802 号记录');
  });

  it('keeps single-tilde ranges inside record citations working', () => {
    renderAnswer('先转移 [record_id=800~802]，再看 01~08');
    expect(screen.getByText('aiAssistant.citation.record:800')).toBeInTheDocument();
    expect(screen.getByText('aiAssistant.citation.record:802')).toBeInTheDocument();
  });

  // 现状：双波浪线仍是 GFM 删除线；紧挨全角标点时同样受 CommonMark 定界符规则限制
  // （没加 remark-cjk-friendly-gfm-strikethrough）
  it('still renders ~~double tildes~~ as strikethrough', () => {
    const { container } = renderAnswer('旧状态 ~~待回收~~ 已改为空闲');
    expect(container.querySelector('del')).toHaveTextContent('待回收');
  });
});

describe('knowledge section popover', () => {
  it('uses the same CJK-friendly plugins for the section content', async () => {
    api.getKnowledgeSection.mockResolvedValue({
      id: '主机流转规则#故障机',
      doc: '主机流转规则',
      title: '故障机',
      content: '**故障机：**不能分配给业务，**（需先修复）**后才能回收。',
    });
    render(
      <MemoryRouter>
        <CitationGroup items={[{ kind: 'doc', id: '主机流转规则#故障机' }]} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /主机流转规则#故障机/ }));
    expect(await screen.findByText('故障机：', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByText('（需先修复）', { selector: 'strong' })).toBeInTheDocument();
  });
});
