import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/AuthStore';
import { LOGIN_PATH } from '@/constants/auth';
import PageLoading from '@/components/common/PageLoading';

interface ProtectedRouteProps {
  requiredRoles?: string[];
  children?: React.ReactNode;
}

/**
 * 路由鉴权守卫。
 *
 * 刷新页面时不再整屏阻塞等待 `initialize()`（即 `GET /me`）返回。
 * 之前的写法会让一次刷新出现两段 loading：先是这里的整屏 PageLoading，
 * 鉴权结束后 MainLayout 才挂载，叶子路由的懒加载分片这时才开始下载，
 * Suspense fallback 于是又显示一次 PageLoading，位置和背景都不一样，
 * 看起来就是「两个 loading」。从菜单进入不会有这个问题，因为鉴权只在
 * 整页加载时执行一次，此后 initialized 一直为 true。
 *
 * 现在只要 localStorage 里还有 token 就乐观放行：布局立刻渲染，
 * 分片下载与用户信息请求并行，整个刷新过程只剩叶子路由那一个 loading。
 * token 失效时 `initialize()` 会清掉它，这里随即跳登录页；页面自身请求
 * 拿到 401 时，axios 拦截器也会兜底跳转。
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRoles, children }) => {
  const location = useLocation();
  const { token, user, loading, initialized, initialize } = useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (!token) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={LOGIN_PATH} replace state={{ from }} />;
  }

  // 只有按角色鉴权的路由必须等用户信息到位，其余路由无需阻塞。
  if (requiredRoles && requiredRoles.length > 0) {
    if (!user) {
      return loading || !initialized ? <PageLoading /> : <Navigate to="/" replace />;
    }

    const hasRequiredRole = requiredRoles.some((role) => user.roles.includes(role));
    if (!hasRequiredRole) {
      return <Navigate to="/" replace />;
    }
  }

  return children ? <>{children}</> : <Outlet />;
};

export default ProtectedRoute;
