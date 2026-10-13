import React, { useMemo, useState } from 'react';
import { Collapse } from 'antd';
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

const STEPS_PANEL_KEY = 'steps';

const ToolSteps: React.FC<ToolStepsProps> = ({ steps, streaming }) => {
  const { t } = useTranslation();
  // 用户没手动展开 / 收起时：生成中、或有失败 / 中断的步骤就展开，全部成功后收成一行
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const problemCount = steps.filter((step) => step.status !== 'success').length;
  const open = userOpen ?? (streaming || problemCount > 0);
  const totalMs = steps.reduce((sum, step) => sum + (step.elapsedMs ?? 0), 0);

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

  const summary = streaming
    ? t('aiAssistant.steps.running', { count: steps.length })
    : [
        t('aiAssistant.steps.summary', { count: steps.length }),
        problemCount > 0 ? t('aiAssistant.steps.problems', { count: problemCount }) : null,
        totalMs > 0 ? formatDuration(totalMs) : null,
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <Collapse
      size="small"
      ghost
      className="ai-message__steps"
      activeKey={open ? [STEPS_PANEL_KEY] : []}
      onChange={(keys) => setUserOpen(keys.length > 0)}
      items={[
        {
          key: STEPS_PANEL_KEY,
          label: summary,
          children: (
            <ThoughtChain className="ai-tool-steps" size="small" collapsible items={items} />
          ),
        },
      ]}
    />
  );
};

export default ToolSteps;
