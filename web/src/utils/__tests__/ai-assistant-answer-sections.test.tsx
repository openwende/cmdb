import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

import AnswerSections from '@/components/AIAssistant/AnswerSections';
import {
  isEmptySection,
  splitAnswerSections,
  splitTopLevelItems,
} from '@/components/AIAssistant/parseAnswer';

const facts = Array.from({ length: 7 }, (_, i) => `- 事实 ${i + 1} [record_id=${600 + i}]`).join(
  '\n',
);

const ANSWER = `### 结论
主机在两个模块。

### 查到的事实
${facts}

### 待核查
- 找 zhangwei 确认

### 缺失证据
无`;

describe('splitAnswerSections', () => {
  it('splits the four prompt sections', () => {
    const parsed = splitAnswerSections(ANSWER);
    expect(parsed?.sections.map((s) => s.title)).toEqual([
      '结论',
      '查到的事实',
      '待核查',
      '缺失证据',
    ]);
    expect(parsed?.sections[0].body).toBe('主机在两个模块。');
    expect(parsed?.preamble).toBe('');
  });

  it('falls back when the answer is not structured', () => {
    expect(splitAnswerSections('我只能做只读查询。')).toBeNull();
    expect(splitAnswerSections('### 结论\n只有一节')).toBeNull();
    expect(splitAnswerSections('### 结论\na\n### 结论\nb')).toBeNull();
  });

  it('ignores headings inside code fences', () => {
    const parsed = splitAnswerSections('### 结论\na\n```\n### 待核查\n```\n### 缺失证据\n无');
    expect(parsed?.sections.map((s) => s.title)).toEqual(['结论', '缺失证据']);
  });

  it('keeps continuation lines with their list item', () => {
    expect(splitTopLevelItems('说明\n- a\n  续行\n- b')).toEqual({
      head: '说明',
      items: ['- a\n  续行', '- b'],
    });
    expect(isEmptySection('无。')).toBe(true);
    expect(isEmptySection('- 无记录')).toBe(false);
  });
});

describe('AnswerSections', () => {
  it('previews four facts, folds follow-ups and shows empty sections inline', async () => {
    render(
      <MemoryRouter>
        <AnswerSections parsed={splitAnswerSections(ANSWER)!} />
      </MemoryRouter>,
    );

    expect(screen.getByText('主机在两个模块。')).toBeInTheDocument();
    expect(screen.getByText(/事实 4/)).toBeInTheDocument();
    expect(screen.queryByText(/事实 5/)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'aiAssistant.answer.showMore:3' }));
    expect(screen.getByText(/事实 7/)).toBeInTheDocument();

    const followUp = screen.getByRole('button', { name: /待核查/ });
    expect(followUp).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/找 zhangwei 确认/)).not.toBeInTheDocument();
    await userEvent.click(followUp);
    expect(screen.getByText(/找 zhangwei 确认/)).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /^缺失证据\s*无$/ })).toBeInTheDocument();
  });
});
