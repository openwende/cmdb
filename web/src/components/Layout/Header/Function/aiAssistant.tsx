import React from 'react';
import { Button, Tooltip } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAIAssistantSceneStore } from '@/store/AIAssistantSceneStore';
import { useResponsive } from '@/utils/useResponsive';
import './style.css';

/**
 * 低于这个宽度只显示图标（不分语言）：英文菜单较长，1280 宽时带文字的按钮会把
 * admin 的最后一个主菜单项挤进"…"
 */
export const AI_ENTRY_LABEL_MIN_WIDTH = 1440;

/** Header 右侧的 AI 助手入口：点击打开 / 收起右侧对话抽屉 */
const AIAssistantEntry: React.FC = () => {
  const { t } = useTranslation();
  const { width } = useResponsive();
  const open = useAIAssistantSceneStore((s) => s.open);
  const toggleOpen = useAIAssistantSceneStore((s) => s.toggleOpen);
  const label = t('aiAssistant.entry');
  const compact = width < AI_ENTRY_LABEL_MIN_WIDTH;

  const button = (
    <Button
      type="text"
      icon={<RobotOutlined />}
      className={`header-ai-button${compact ? ' header-ai-button--compact' : ''}${
        open ? ' header-ai-button--active' : ''
      }`}
      aria-pressed={open}
      aria-label={label}
      onClick={toggleOpen}
    >
      {!compact && <span className="header-ai-label">{label}</span>}
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
