import React from 'react';
import { Outlet } from 'react-router-dom';

export const modelRootPath = '/model';
export const modelOverviewPath = `${modelRootPath}/overview`;
export const modelLegacyDetailPath = `${modelRootPath}/modelDetail`;
export const buildModelDetailPath = (name: string, section: string = 'basic') =>
  `${modelRootPath}/${name}/${section}`;

const ResourceModel: React.FC = () => {
  return <Outlet />;
};

export default ResourceModel;
