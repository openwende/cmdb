import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import { Bubble, Prompts, Sender, Welcome, type BubbleProps } from '@ant-design/x';
import type { GetProp } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAIAssistantSceneStore, type AIChatMessage } from '@/store/AIAssistantSceneStore';
import AssistantMessage from './AssistantMessage';
import { EXAMPLE_PROMPT_KEYS } from './examplePrompts';

const renderAssistant = (message: AIChatMessage) => <AssistantMessage message={message} />;

const ROLES: GetProp<typeof Bubble.List, 'roles'> = {
  user: {
    placement: 'end',
    variant: 'filled',
    classNames: { content: 'ai-bubble-user' },
  },
  assistant: {
    placement: 'start',
    variant: 'borderless',
    classNames: { content: 'ai-bubble-assistant' },
    messageRender: renderAssistant as BubbleProps<AIChatMessage>['messageRender'],
  },
};

const hasVisibleContent = (message: AIChatMessage) =>
  Boolean(message.content || message.reasoning || message.steps?.length);

const ChatView: React.FC = () => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const messages = useAIAssistantSceneStore((s) => s.messages);
  const messagesLoading = useAIAssistantSceneStore((s) => s.messagesLoading);
  const messagesErrorKey = useAIAssistantSceneStore((s) => s.messagesErrorKey);
  const activeConversationId = useAIAssistantSceneStore((s) => s.activeConversationId);
  const streaming = useAIAssistantSceneStore((s) => s.streaming);
  const send = useAIAssistantSceneStore((s) => s.send);
  const stop = useAIAssistantSceneStore((s) => s.stop);
  const selectConversation = useAIAssistantSceneStore((s) => s.selectConversation);

  const promptItems = useMemo(
    () =>
      EXAMPLE_PROMPT_KEYS.map((key) => ({
        key,
        description: t(`aiAssistant.welcome.prompts.${key}`),
      })),
    [t],
  );

  const bubbleItems = useMemo(
    () =>
      messages.map((message) =>
        message.role === 'user'
          ? { key: message.key, role: 'user', content: message.content }
          : {
              key: message.key,
              role: 'assistant',
              content: message,
              loading: message.status === 'streaming' && !hasVisibleContent(message),
            },
      ),
    [messages],
  );

  // 发送后滚到底。Bubble.List 只在"新增前的最后一项"可见时才自动滚动，而发送一次会
  // 同时追加问题和回答占位，被检查的那一项就是刚发的问题，不在视野里（往上滚过、或抽屉
  // 重开后没停在底部时），于是不滚，流式回答也不跟随。这里显式滚到底：位置变化触发
  // scroll 事件，Bubble.List 据此把"在底部"重新置为 true，之后的流式内容继续跟随。
  const listRef = useRef<React.ElementRef<typeof Bubble.List>>(null);
  const scrollToEndOnNextItemsRef = useRef(false);

  useEffect(() => {
    if (!scrollToEndOnNextItemsRef.current) return;
    scrollToEndOnNextItemsRef.current = false;
    const list = listRef.current;
    if (list?.nativeElement) {
      list.scrollTo({ offset: list.nativeElement.scrollHeight, behavior: 'instant' });
    }
  }, [bubbleItems]);

  const handleSubmit = (value: string) => {
    if (!value.trim() || streaming) return;
    setDraft('');
    scrollToEndOnNextItemsRef.current = true;
    void send(value);
  };

  let body: React.ReactNode;
  if (messagesLoading) {
    body = (
      <div className="ai-chat__placeholder">
        <Spin />
      </div>
    );
  } else if (messagesErrorKey) {
    body = (
      <div className="ai-chat__placeholder">
        <Alert
          type="error"
          showIcon
          message={t(messagesErrorKey)}
          action={
            activeConversationId ? (
              <Button size="small" onClick={() => void selectConversation(activeConversationId)}>
                {t('aiAssistant.history.retry')}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  } else if (messages.length === 0) {
    body = (
      <div className="ai-chat__welcome">
        <Welcome
          variant="borderless"
          icon={<RobotOutlined className="ai-chat__welcome-icon" />}
          title={t('aiAssistant.welcome.title')}
          description={t('aiAssistant.welcome.description')}
        />
        <Prompts
          title={t('aiAssistant.welcome.promptsTitle')}
          vertical
          items={promptItems}
          onItemClick={({ data }) => handleSubmit(String(data.description ?? ''))}
        />
      </div>
    );
  } else {
    body = (
      <Bubble.List ref={listRef} className="ai-chat__list" items={bubbleItems} roles={ROLES} />
    );
  }

  return (
    <div className="ai-chat">
      <div className="ai-chat__body">{body}</div>
      <div className="ai-chat__sender">
        <Sender
          value={draft}
          onChange={setDraft}
          onSubmit={handleSubmit}
          onCancel={stop}
          loading={streaming}
          disabled={messagesLoading}
          placeholder={t('aiAssistant.sender.placeholder')}
          autoSize={{ minRows: 1, maxRows: 6 }}
          actions={(_, { components: { SendButton, LoadingButton } }) =>
            streaming ? (
              <LoadingButton
                aria-label={t('aiAssistant.sender.stop')}
                title={t('aiAssistant.sender.stop')}
              />
            ) : (
              <SendButton
                aria-label={t('aiAssistant.sender.send')}
                title={t('aiAssistant.sender.send')}
              />
            )
          }
        />
      </div>
    </div>
  );
};

export default ChatView;
