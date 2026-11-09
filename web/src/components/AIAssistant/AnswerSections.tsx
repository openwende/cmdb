import React, { useMemo, useState } from 'react';
import { Button } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import MarkdownAnswer from './MarkdownAnswer';
import {
  isEmptySection,
  splitTopLevelItems,
  type AnswerSection,
  type AnswerSectionTitle,
  type ParsedAnswer,
} from './parseAnswer';

/** "查到的事实"默认显示的条数 */
export const FACTS_PREVIEW_COUNT = 4;

const COLLAPSED_BY_DEFAULT: ReadonlySet<AnswerSectionTitle> = new Set(['待核查', '缺失证据']);

const Section: React.FC<{ section: AnswerSection }> = ({ section }) => {
  const { t } = useTranslation();
  const { title, body } = section;
  const { head, items } = useMemo(() => splitTopLevelItems(body), [body]);
  const empty = isEmptySection(body);
  const collapsible = COLLAPSED_BY_DEFAULT.has(title) && !empty;
  const [open, setOpen] = useState(!collapsible);
  const [showAll, setShowAll] = useState(false);
  // 只多出一两条时不折叠，免得"展开其余 1 条"
  const truncatable = title === '查到的事实' && items.length > FACTS_PREVIEW_COUNT + 1;
  const hiddenCount = items.length - FACTS_PREVIEW_COUNT;
  const count =
    title !== '结论' && items.length > 0 ? (
      <span className="ai-answer__count">
        {t('aiAssistant.answer.itemCount', { count: items.length })}
      </span>
    ) : null;

  if (empty) {
    return (
      <section className="ai-answer__section">
        <h3 className="ai-answer__heading">
          {title}
          <span className="ai-answer__empty">{body}</span>
        </h3>
      </section>
    );
  }

  const visibleBody =
    truncatable && !showAll
      ? [head, ...items.slice(0, FACTS_PREVIEW_COUNT)].filter(Boolean).join('\n')
      : body;

  return (
    <section className="ai-answer__section">
      <h3 className="ai-answer__heading">
        {collapsible ? (
          <button
            type="button"
            className="ai-answer__toggle"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <RightOutlined className="ai-answer__caret" rotate={open ? 90 : 0} />
            <span>{title}</span>
            {count}
          </button>
        ) : (
          <>
            {title}
            {count}
          </>
        )}
      </h3>
      {open && <MarkdownAnswer content={visibleBody} />}
      {open && truncatable && (
        <Button
          type="link"
          size="small"
          className="ai-answer__more"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll
            ? t('aiAssistant.answer.showLess')
            : t('aiAssistant.answer.showMore', { count: hiddenCount })}
        </Button>
      )}
    </section>
  );
};

/** 结构化回答：结论始终展开，事实超过 5 条时先显示前 4 条，待核查 / 缺失证据默认收起 */
const AnswerSections: React.FC<{ parsed: ParsedAnswer }> = ({ parsed }) => (
  <div className="ai-answer">
    {parsed.preamble && <MarkdownAnswer content={parsed.preamble} />}
    {parsed.sections.map((section) => (
      <Section key={section.title} section={section} />
    ))}
  </div>
);

export default AnswerSections;
