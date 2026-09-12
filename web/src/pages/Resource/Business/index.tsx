import React from 'react';
import { Outlet } from 'react-router-dom';

export const archivedBusinessPath = '/resource/business/archivedBusiness';
export const businessDetailPath = '/resource/business/businessDetail';

const ResourceBusiness: React.FC = () => {
  return (
    <>
      <Outlet />
    </>
  );
};

export default ResourceBusiness;
