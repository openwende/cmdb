import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { useAIAssistantSceneStore } from '@/store/AIAssistantSceneStore';
import { useAuthStore } from '@/store/AuthStore';

// 对话面板依赖 @ant-design/x 和 Markdown 渲染，第一次打开时才加载
const AIAssistantDrawer = lazy(() => import('./AIAssistantDrawer'));

/**
 * 挂在 MainLayout 上的 AI 助手入口：第一次打开后才渲染抽屉，之后一直保留，
 * 切换页面时对话不丢。登录账号变化（退出 / 换人）时清掉对话。
 */
const AIAssistant: React.FC = () => {
  const open = useAIAssistantSceneStore((s) => s.open);
  const token = useAuthStore((s) => s.token);
  const [mounted, setMounted] = useState(open);
  const tokenRef = useRef(token);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (tokenRef.current === token) return;
    tokenRef.current = token;
    useAIAssistantSceneStore.getState().reset();
  }, [token]);

  if (!mounted) return null;
  return (
    <Suspense fallback={null}>
      <AIAssistantDrawer />
    </Suspense>
  );
};

export default AIAssistant;
