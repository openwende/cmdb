import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/store/AuthStore';
import { LOGIN_PATH } from '@/constants/auth';

const ProtectedRoute: React.FC = () => {
  const location = useLocation();
  const { token, user, loading, initialized, initialize } = useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (loading || !initialized) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!token || !user) {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={LOGIN_PATH} replace state={{ from }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
