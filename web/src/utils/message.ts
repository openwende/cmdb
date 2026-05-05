import { App, message as staticMessage } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

/**
 * Returns the context-aware AntD message API.
 * Use this instead of the static `message` import to avoid context warnings.
 */
export function useAppMessage(): MessageInstance {
  try {
    const { message } = App.useApp();
    return message;
  } catch {
    return staticMessage;
  }
}
