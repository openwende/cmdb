import React, { useMemo } from 'react';
import { Alert, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import type { AIChatMessage } from '@/store/AIAssistantSceneStore';
import AnswerSections from './AnswerSections';
import MarkdownAnswer from './MarkdownAnswer';
import { splitAnswerSections } from './parseAnswer';
import StreamingStatus from './StreamingStatus';
import ToolSteps from './ToolSteps';
import { formatDuration } from './format';

/**
 * 一条助手消息：工具步骤 → 回答正文 → 生成中的状态行 / 统计。
 * 思考过程不显示：DeepSeek 常用英文思考，对用户核对结论没有帮助，查了什么看工具步骤即可
 */
const AssistantMessage: React.FC<{ message: AIChatMessage }> = ({ message }) => {
  const { t } = useTranslation();
  const streaming = message.status === 'streaming';
  const steps = message.steps ?? [];
  // 生成中照原样流式渲染，结束后再按小节折叠，免得内容边出边跳
  const parsed = useMemo(
    () => (streaming || !message.content ? null : splitAnswerSections(message.content)),
    [streaming, message.content],
  );

  return (
    <div className="ai-message">
      {steps.length > 0 && <ToolSteps steps={steps} streaming={streaming} />}

      {parsed ? (
        <AnswerSections parsed={parsed} />
      ) : (
        message.content && <MarkdownAnswer content={message.content} />
      )}

      {streaming && <StreamingStatus message={message} />}

      {message.status === 'stopped' && (
        <Tag className="ai-message__stopped">{t('aiAssistant.message.stopped')}</Tag>
      )}

      {message.status === 'error' && (
        <Alert
          type="error"
          showIcon
          className="ai-message__error"
          message={t(message.errorKey || 'aiAssistant.errors.requestFailed')}
          description={message.errorDetail}
        />
      )}

      {message.stats && (
        <div className="ai-message__stats">
          {t('aiAssistant.message.stats', {
            count: message.stats.toolCalls,
            elapsed: formatDuration(message.stats.elapsedMs),
            input: message.stats.inputTokens,
            output: message.stats.outputTokens,
          })}
        </div>
      )}
    </div>
  );
};

export default AssistantMessage;
