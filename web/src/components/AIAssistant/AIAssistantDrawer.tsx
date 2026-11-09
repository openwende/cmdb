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
/**
 * 随视口变宽：1280 及以下 560px，1440 约 600px，1920 封顶 760px。
 * 回答里有表格和成串的依据标签，480 太挤；抽屉不带遮罩，点依据跳转后要能看到左边的页面，所以不超过视口的一半
 */
const AI_DRAWER_WIDTH = 'clamp(560px, 42vw, 760px)';

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
      // 单行，放不下时省略号截断（英文标题较长，有"返回对话"按钮时会折成两行）
      title={
        <span className="ai-assistant-drawer__title" title={t('aiAssistant.title')}>
          {t('aiAssistant.title')}
        </span>
      }
      placement="right"
      width={isMobile ? '100%' : AI_DRAWER_WIDTH}
      open={open}
      mask={false}
      onClose={() => setOpen(false)}
      rootClassName="ai-assistant-drawer"
      // 从 Header 下方开始，不盖住 Header 上的入口按钮、语言切换和用户菜单
      rootStyle={{ top: 'var(--header-height)' }}
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
