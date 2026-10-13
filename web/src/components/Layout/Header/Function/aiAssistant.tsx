import React, { useEffect, useState } from 'react';
import { Button, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import SparklesIcon from '@/components/AIAssistant/SparklesIcon';
import { useAIAssistantSceneStore } from '@/store/AIAssistantSceneStore';
import { useResponsive } from '@/utils/useResponsive';
import './style.css';

/**
 * 低于这个宽度只显示图标（不分语言）：英文菜单较长，1280 宽时带文字的按钮会把
 * admin 的最后一个主菜单项挤进"…"
 */
export const AI_ENTRY_LABEL_MIN_WIDTH = 1440;

/** 打开过一次 AI 助手后不再显示"新"标记 */
export const AI_ENTRY_SEEN_STORAGE_KEY = 'cmdb.aiAssistant.entrySeen';

const readSeen = () => {
  try {
    return localStorage.getItem(AI_ENTRY_SEEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

/** Header 右侧的 AI 助手入口：点击打开 / 收起右侧对话抽屉 */
const AIAssistantEntry: React.FC = () => {
  const { t } = useTranslation();
  const { width } = useResponsive();
  const open = useAIAssistantSceneStore((s) => s.open);
  const toggleOpen = useAIAssistantSceneStore((s) => s.toggleOpen);
  const [seen, setSeen] = useState(readSeen);
  const label = t('aiAssistant.entry');
  const compact = width < AI_ENTRY_LABEL_MIN_WIDTH;

  // 从首页卡片等其他入口打开抽屉也算看过
  useEffect(() => {
    if (!open || seen) return;
    setSeen(true);
    try {
      localStorage.setItem(AI_ENTRY_SEEN_STORAGE_KEY, '1');
    } catch {
      // 存不了就只在本次页面内隐藏
    }
  }, [open, seen]);

  const button = (
    <Button
      type="text"
      icon={<SparklesIcon className="header-ai-icon" />}
      className={`header-ai-button${compact ? ' header-ai-button--compact' : ''}${
        open ? ' header-ai-button--active' : ''
      }`}
      aria-pressed={open}
      aria-label={label}
      onClick={toggleOpen}
    >
      {!compact && <span className="header-ai-label">{label}</span>}
      {!seen &&
        (compact ? (
          <span className="header-ai-dot" aria-hidden="true" />
        ) : (
          <span className="header-ai-badge" aria-hidden="true">
            {t('aiAssistant.entryNew')}
          </span>
        ))}
    </Button>
  );

  return compact ? (
    <Tooltip title={label} placement="bottom">
      {button}
    </Tooltip>
  ) : (
    button
  );
};

export default AIAssistantEntry;
