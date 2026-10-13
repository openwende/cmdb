import { useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppMessage } from '@/utils/message';
import { HOST_DETAIL_QUERY_KEY, parseHostIdParam } from '@/utils/routes';

/**
 * 主机资源页深链：`?host_id=43`（display_id）时打开该主机的详情抽屉。
 * 列表里点主机 ID 也走这个参数，所以链接可以直接分享。
 * 关闭抽屉时去掉参数；编号非法时提示并去掉参数（主机不存在由抽屉请求后回调 notFound）。
 * 没有参数时什么都不做，页面行为不变。
 */
export const useHostDetailDeepLink = () => {
  const { t } = useTranslation();
  const message = useAppMessage();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawHostId = searchParams.get(HOST_DETAIL_QUERY_KEY);
  const parsed = parseHostIdParam(rawHostId);
  const displayId = parsed.status === 'valid' ? parsed.displayId : null;

  // react-router v7 的 setSearchParams 引用会变，t / message 也不该触发 effect：都放 ref
  const latest = useRef({ t, message, setSearchParams });
  latest.current = { t, message, setSearchParams };

  const clearParam = useCallback(() => {
    latest.current.setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(HOST_DETAIL_QUERY_KEY);
        return next;
      },
      { replace: true },
    );
  }, []);

  const notFound = useCallback(() => {
    const { t: translate, message: api } = latest.current;
    api.error(translate('resource.host.detail.messages.notFound'));
    clearParam();
  }, [clearParam]);

  // 同一个非法值只提示一次：StrictMode 会把 effect 连跑两遍，而去参数要等下一次渲染才生效
  const reportedInvalidRef = useRef<string | null>(null);
  useEffect(() => {
    if (parseHostIdParam(rawHostId).status !== 'invalid') {
      reportedInvalidRef.current = null;
      return;
    }
    if (reportedInvalidRef.current === rawHostId) return;
    reportedInvalidRef.current = rawHostId;
    notFound();
  }, [rawHostId, notFound]);

  const open = useCallback((id: number | string) => {
    latest.current.setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(HOST_DETAIL_QUERY_KEY, String(id));
        return next;
      },
      { replace: true },
    );
  }, []);

  return { displayId, open, close: clearParam, notFound };
};
