import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

const Analysis: React.FC = () => {
  const location = useLocation();

  if (location.pathname === '/analysis') {
    return <Navigate to="/analysis/audit" replace />;
  }

  return (
    <>
      <Outlet />
    </>
  );
};

export default Analysis;
