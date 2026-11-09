import { App, message as staticMessage } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

type AntdAppHook = () => { message?: MessageInstance };

/**
 * 模块加载时选定要使用的 AntD App Hook。
 *
 * 单测里常用 `vi.mock('antd')` 只导出被测组件用到的那几个导出，此时读取
 * `App` 本身就会抛错，所以这里用 try/catch 兜住的是「取 Hook」这一步。
 * 组件里调用的永远是同一个 Hook，既保留了降级能力，也不违反 Hook 必须
 * 无条件调用的规则（原先是把 `App.useApp()` 包在 try/catch 里调用）。
 */
let useAntdApp: AntdAppHook = () => ({});
try {
  if (typeof App?.useApp === 'function') {
    useAntdApp = App.useApp;
  }
} catch {
  // antd 被 mock 且未导出 App：保持上面的降级实现
}

/**
 * Returns the context-aware AntD message API.
 * Use this instead of the static `message` import to avoid context warnings.
 *
 * 不在 `<App>` 里时 `App.useApp()` 返回的是 `{ message: {} }`，不会抛错，
 * 所以这里再判断一次拿到的实例是否可用，不可用则回退到静态 message。
 */
export function useAppMessage(): MessageInstance {
  const { message } = useAntdApp();
  return typeof message?.success === 'function' ? message : staticMessage;
}
