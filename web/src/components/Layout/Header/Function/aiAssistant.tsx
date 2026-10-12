import React from 'react';
import { Button } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAIAssistantSceneStore } from '@/store/AIAssistantSceneStore';
import './style.css';

/** Header 右侧的 AI 助手入口：点击打开 / 收起右侧对话抽屉 */
const AIAssistantEntry: React.FC = () => {
  const { t } = useTranslation();
  const open = useAIAssistantSceneStore((s) => s.open);
  const toggleOpen = useAIAssistantSceneStore((s) => s.toggleOpen);

  return (
    <Button
      type="text"
      icon={<RobotOutlined />}
      className={`header-ai-button${open ? ' header-ai-button--active' : ''}`}
      aria-pressed={open}
      aria-label={t('aiAssistant.entry')}
      onClick={toggleOpen}
    >
      <span className="header-ai-label">{t('aiAssistant.entry')}</span>
    </Button>
  );
};

export default AIAssistantEntry;
