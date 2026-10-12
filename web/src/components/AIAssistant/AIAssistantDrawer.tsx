import React, { useEffect } from 'react';
import { Button, Drawer, Space } from 'antd';
import { HistoryOutlined, MessageOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAIAssistantSceneStore } from '@/store/AIAssistantSceneStore';
import { useResponsive } from '@/utils/useResponsive';
import ChatView from './ChatView';
import ConversationList from './ConversationList';
import './style.css';

/**
 * AI 调查助手抽屉：挂在 MainLayout，右侧、不遮罩，可以一边看页面一边对话。
 * 开关和对话状态都在 AIAssistantSceneStore，切换页面不丢。
 */
const AIAssistantDrawer: React.FC = () => {
  const { t } = useTranslation();
  const { isMobile } = useResponsive();
  const open = useAIAssistantSceneStore((s) => s.open);
  const view = useAIAssistantSceneStore((s) => s.view);
  const setOpen = useAIAssistantSceneStore((s) => s.setOpen);
  const setView = useAIAssistantSceneStore((s) => s.setView);
  const newConversation = useAIAssistantSceneStore((s) => s.newConversation);
  const loadConversations = useAIAssistantSceneStore((s) => s.loadConversations);

  // 打开抽屉、切到历史列表时刷新会话列表
  useEffect(() => {
    if (open) void loadConversations();
  }, [open, view, loadConversations]);

  const showingHistory = view === 'history';

  return (
    <Drawer
      title={t('aiAssistant.title')}
      placement="right"
      width={isMobile ? '100%' : 480}
      open={open}
      mask={false}
      onClose={() => setOpen(false)}
      rootClassName="ai-assistant-drawer"
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
      extra={
        <Space size={8}>
          <Button size="small" icon={<PlusOutlined />} onClick={newConversation}>
            {t('aiAssistant.newChat')}
          </Button>
          <Button
            size="small"
            type={showingHistory ? 'primary' : 'default'}
            icon={showingHistory ? <MessageOutlined /> : <HistoryOutlined />}
            onClick={() => setView(showingHistory ? 'chat' : 'history')}
          >
            {showingHistory ? t('aiAssistant.backToChat') : t('aiAssistant.history.title')}
          </Button>
        </Space>
      }
    >
      {showingHistory ? <ConversationList /> : <ChatView />}
    </Drawer>
  );
};

export default AIAssistantDrawer;
