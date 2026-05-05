import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export const modelRootPath = '/model';
export const modelOverviewPath = `${modelRootPath}/overview`;
export const modelLegacyDetailPath = `${modelRootPath}/modelDetail`;
export const buildModelDetailPath = (name: string, section: string = 'basic') =>
  `${modelRootPath}/${name}/${section}`;

const ResourceModel: React.FC = () => {
  const location = useLocation();

  if (location.pathname === modelRootPath) {
    return <Navigate to={modelOverviewPath} replace />;
  }

  return <Outlet />;
};

export default ResourceModel;
