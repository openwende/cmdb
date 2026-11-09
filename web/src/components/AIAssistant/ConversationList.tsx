import React, { useMemo } from 'react';
import { Alert, Button, Empty, Modal, Spin } from 'antd';
import { Conversations, type ConversationsProps } from '@ant-design/x';
import { DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useAIAssistantSceneStore } from '@/store/AIAssistantSceneStore';
import { useAppMessage } from '@/utils/message';

const formatTime = (value: string) => {
  const time = dayjs(value);
  return time.isValid() ? time.format('YYYY-MM-DD HH:mm') : '';
};

/** 历史会话：标题（第一条问题）、更新时间，可删除 */
const ConversationList: React.FC = () => {
  const { t } = useTranslation();
  const message = useAppMessage();
  const [modal, contextHolder] = Modal.useModal();
  const conversations = useAIAssistantSceneStore((s) => s.conversations);
  const loading = useAIAssistantSceneStore((s) => s.conversationsLoading);
  const hasError = useAIAssistantSceneStore((s) => s.conversationsError);
  const activeConversationId = useAIAssistantSceneStore((s) => s.activeConversationId);
  const loadConversations = useAIAssistantSceneStore((s) => s.loadConversations);
  const selectConversation = useAIAssistantSceneStore((s) => s.selectConversation);
  const removeConversation = useAIAssistantSceneStore((s) => s.removeConversation);

  const items = useMemo(
    () =>
      conversations.map((item) => ({
        key: item.conversation_id,
        label: (
          <span className="ai-history__item">
            <span className="ai-history__title">
              {item.title || t('aiAssistant.history.untitled')}
            </span>
            <span className="ai-history__time">{formatTime(item.updated_at)}</span>
          </span>
        ),
      })),
    [conversations, t],
  );

  const confirmDelete = (conversationId: string) => {
    modal.confirm({
      title: t('aiAssistant.history.deleteConfirmTitle'),
      content: t('aiAssistant.history.deleteConfirmContent'),
      okText: t('aiAssistant.history.delete'),
      okButtonProps: { danger: true },
      cancelText: t('aiAssistant.history.cancel'),
      onOk: async () => {
        try {
          await removeConversation(conversationId);
          message.success(t('aiAssistant.history.deleted'));
        } catch {
          message.error(t('aiAssistant.history.deleteFailed'));
        }
      },
    });
  };

  const menu: ConversationsProps['menu'] = (conversation) => ({
    items: [
      {
        key: 'delete',
        label: t('aiAssistant.history.delete'),
        icon: <DeleteOutlined />,
        danger: true,
      },
    ],
    onClick: ({ key, domEvent }) => {
      domEvent.stopPropagation();
      if (key === 'delete') confirmDelete(conversation.key);
    },
  });

  let body: React.ReactNode;
  if (loading && conversations.length === 0) {
    body = (
      <div className="ai-chat__placeholder">
        <Spin />
      </div>
    );
  } else if (hasError) {
    body = (
      <div className="ai-chat__placeholder">
        <Alert
          type="error"
          showIcon
          message={t('aiAssistant.history.loadFailed')}
          action={
            <Button size="small" onClick={() => void loadConversations()}>
              {t('aiAssistant.history.retry')}
            </Button>
          }
        />
      </div>
    );
  } else if (conversations.length === 0) {
    body = (
      <div className="ai-chat__placeholder">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('aiAssistant.history.empty')} />
      </div>
    );
  } else {
    body = (
      <Conversations
        className="ai-history__list"
        items={items}
        activeKey={activeConversationId ?? undefined}
        onActiveChange={(key) => void selectConversation(key)}
        menu={menu}
      />
    );
  }

  return (
    <div className="ai-history">
      {contextHolder}
      {body}
    </div>
  );
};

export default ConversationList;
