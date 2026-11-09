import { useCallback, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppMessage } from '@/utils/message';
import {
  getHostDetailNavigationState,
  HOST_DETAIL_FROM_STATE_KEY,
  HOST_DETAIL_QUERY_KEY,
  parseHostIdParam,
} from '@/utils/routes';

/**
 * 主机资源页深链：`?host_id=43`（display_id）时打开该主机的详情抽屉。
 * 列表里点主机 ID 也走这个参数，所以链接可以直接分享。
 * 没有参数时什么都不做，页面行为不变。
 *
 * 历史记录：列表里点 ID、AI 引用都用 push 打开，state 里记下打开时所在的页面
 * （getHostDetailNavigationState）。浏览器后退就是关抽屉、回到打开前的页面。
 * - 在主机页上打开的（state 里的页面就是当前页）：点关闭也走后退，回到打开前那条记录，
 *   历史里不留重复的 /resource/host，之后再后退不会重新打开抽屉。
 * - 在别的页面打开（AI 引用）、审计链接或直接打开 URL：关闭时用 replace 去掉参数，留在主机页。
 * - 编号非法 / 主机不存在：提示后按上面同样的规则关闭。
 */
export const useHostDetailDeepLink = () => {
  const { t } = useTranslation();
  const message = useAppMessage();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const openedFrom = (location.state as Record<string, unknown> | null)?.[
    HOST_DETAIL_FROM_STATE_KEY
  ];
  const pushedOnThisPage = openedFrom === location.pathname;
  const rawHostId = searchParams.get(HOST_DETAIL_QUERY_KEY);
  const parsed = parseHostIdParam(rawHostId);
  const displayId = parsed.status === 'valid' ? parsed.displayId : null;

  // react-router v7 的 setSearchParams 引用会变，t / message 也不该触发 effect：都放 ref
  const latest = useRef({
    t,
    message,
    setSearchParams,
    navigate,
    pushedOnThisPage,
    locationKey: location.key,
    pathname: location.pathname,
  });
  latest.current = {
    t,
    message,
    setSearchParams,
    navigate,
    pushedOnThisPage,
    locationKey: location.key,
    pathname: location.pathname,
  };
  // 浏览器的后退是异步的：同一条记录上连着关两次（点关闭后马上按 Esc）只能退一步
  const backedFromKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // 已经离开那条记录（后退完成）就清掉，前进回来后还能正常关闭
    if (backedFromKeyRef.current !== location.key) backedFromKeyRef.current = null;
  }, [location.key]);

  const clearParam = useCallback(() => {
    if (latest.current.pushedOnThisPage) {
      if (backedFromKeyRef.current === latest.current.locationKey) return;
      backedFromKeyRef.current = latest.current.locationKey;
      latest.current.navigate(-1);
      return;
    }
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
      { state: getHostDetailNavigationState(latest.current.pathname) },
    );
  }, []);

  return { displayId, open, close: clearParam, notFound };
};
