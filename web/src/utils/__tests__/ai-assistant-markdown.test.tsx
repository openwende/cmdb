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

describe('MarkdownAnswer single line breaks', () => {
  // 回答里单个换行按换行显示（remark-breaks）；CommonMark 默认会把它合并成空格
  it('keeps "field: value" lines apart and bold intact', () => {
    const { container } = renderAnswer('**主机：**a\n**状态：**b');
    const paragraph = container.querySelector('.ai-markdown p')!;
    expect(paragraph.querySelectorAll('br')).toHaveLength(1);
    expect(strongTexts(container)).toEqual(['主机：', '状态：']);
    expect(paragraph.innerHTML).toMatch(
      /<strong>主机：<\/strong>a<br>\s*<strong>状态：<\/strong>b/,
    );
  });

  it('breaks plain lines separated by a single newline, with citations kept', () => {
    const { container } = renderAnswer(
      '转入支付网关的：host_id=55（共 4 次）[record_id=851]\n转出支付网关的：host_id=43（共 2 次）',
    );
    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.querySelectorAll('p br')).toHaveLength(1);
    expect(screen.getByText('aiAssistant.citation.record:851')).toBeInTheDocument();
  });

  // 列表项后紧跟一行无缩进文字：仍是同一个列表项（CommonMark 懒续行），项内换行显示
  it('keeps a lazy line after a list item inside that item, on its own line', () => {
    const { container } = renderAnswer('- **结论：**在两个模块\n补充说明一行');
    const items = container.querySelectorAll('li');
    expect(items).toHaveLength(1);
    expect(items[0].querySelectorAll('br')).toHaveLength(1);
    // 实际结构：<li><strong>结论：</strong>在两个模块<br>\n补充说明一行</li>
    expect(items[0].innerHTML).toMatch(/^<strong>结论：<\/strong>在两个模块<br>\s*补充说明一行$/);
    expect(container.querySelector('ul + p')).toBeNull();
  });

  it('does not add breaks inside tables or code blocks', () => {
    const { container } = renderAnswer(
      [
        '| 主机 | 状态 |',
        '| --- | --- |',
        '| 01~08 | **故障** |',
        '',
        '```',
        'line 1',
        'line 2',
        '```',
      ].join('\n'),
    );
    expect(container.querySelector('table br')).toBeNull();
    expect(container.querySelector('pre br')).toBeNull();
    expect(container.querySelector('pre code')!.textContent).toBe('line 1\nline 2\n');
    expect(container.querySelector('del')).toBeNull();
  });

  it('keeps single-tilde ranges and doc citations across lines', () => {
    const { container } = renderAnswer(
      '编号 01~08\n规则见[doc=主机流转规则#回收到资源池]，记录 [record_id=800~802]',
    );
    expect(container.querySelector('del')).toBeNull();
    expect(container.querySelectorAll('p br')).toHaveLength(1);
    expect(screen.getByText('主机流转规则#回收到资源池')).toBeInTheDocument();
    expect(screen.getByText('aiAssistant.citation.record:800')).toBeInTheDocument();
    expect(screen.getByText('aiAssistant.citation.record:802')).toBeInTheDocument();
  });
});

describe('knowledge section popover', () => {
  it('keeps CommonMark soft breaks (no remark-breaks) in the section content', async () => {
    api.getKnowledgeSection.mockResolvedValue({
      id: '主机流转规则#换行',
      doc: '主机流转规则',
      title: '换行',
      content: '第一行\n第二行',
    });
    render(
      <MemoryRouter>
        <CitationGroup items={[{ kind: 'doc', id: '主机流转规则#换行' }]} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /主机流转规则#换行/ }));
    const paragraph = (await screen.findByText(/第一行/)).closest('p')!;
    expect(paragraph.querySelector('br')).toBeNull();
    expect(paragraph.textContent).toBe('第一行\n第二行');
  });

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
