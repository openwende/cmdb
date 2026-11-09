import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AIChatMessage } from '@/store/AIAssistantSceneStore';

/** 回答生成中显示在消息底部：当前阶段（流光文字）+ 已用时间，结束后由调用方移除 */
const StreamingStatus: React.FC<{ message: AIChatMessage }> = ({ message }) => {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const phase = message.phase ?? 'thinking';
  const pending = [...(message.steps ?? [])].reverse().find((step) => step.status === 'pending');
  const label =
    phase === 'tool' && pending
      ? t('aiAssistant.status.tool', {
          tool: t(`aiAssistant.tools.${pending.name}`, { defaultValue: pending.name }),
        })
      : t(`aiAssistant.status.${phase === 'tool' ? 'analyzing' : phase}`);
  const seconds =
    typeof message.startedAt === 'number'
      ? Math.max(0, Math.floor((now - message.startedAt) / 1000))
      : null;

  return (
    <div className="ai-status" role="status">
      <span className="ai-status__text">{label}</span>
      {seconds !== null && <span className="ai-status__time">{seconds} s</span>}
    </div>
  );
};

export default StreamingStatus;
