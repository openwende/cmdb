import React, { useMemo } from 'react';
import { ThoughtChain, type ThoughtChainItem } from '@ant-design/x';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { AIToolStep } from '@/store/AIAssistantSceneStore';
import { formatDuration } from './format';

const prettyJson = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      // output 截断到 4000 字时不是合法 JSON，原样显示
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
};

interface ToolStepsProps {
  steps: AIToolStep[];
  /** 本条消息是否还在生成；生成结束后仍是 pending 的步骤显示为已中断 */
  streaming: boolean;
}

const ToolSteps: React.FC<ToolStepsProps> = ({ steps, streaming }) => {
  const { t } = useTranslation();

  const items = useMemo<ThoughtChainItem[]>(
    () =>
      steps.map((step) => {
        const interrupted = step.status === 'pending' && !streaming;
        const status = interrupted ? 'error' : step.status;
        const statusText = interrupted
          ? t('aiAssistant.steps.interrupted')
          : t(`aiAssistant.steps.status.${step.status}`);
        const icon = interrupted ? (
          <StopOutlined />
        ) : step.status === 'pending' ? (
          <LoadingOutlined />
        ) : step.status === 'success' ? (
          <CheckCircleOutlined />
        ) : (
          <CloseCircleOutlined />
        );
        const input = prettyJson(step.input);
        const output = prettyJson(step.output);
        return {
          key: step.id,
          icon,
          status,
          title: t(`aiAssistant.tools.${step.name}`, { defaultValue: step.name }),
          description:
            typeof step.elapsedMs === 'number'
              ? `${statusText} · ${formatDuration(step.elapsedMs)}`
              : statusText,
          content: (
            <div className="ai-tool-step">
              <div className="ai-tool-step__label">{t('aiAssistant.steps.input')}</div>
              <pre className="ai-tool-step__code">{input || '{}'}</pre>
              <div className="ai-tool-step__label">{t('aiAssistant.steps.output')}</div>
              <pre className="ai-tool-step__code">{output || t('aiAssistant.steps.noOutput')}</pre>
            </div>
          ),
        };
      }),
    [steps, streaming, t],
  );

  return <ThoughtChain className="ai-tool-steps" size="small" collapsible items={items} />;
};

export default ToolSteps;
