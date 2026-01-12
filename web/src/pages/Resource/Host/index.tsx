import React from 'react';
import { Outlet } from 'react-router-dom';

const Host: React.FC = () => {
  return (
    <>
      <Outlet />
    </>
  );
};

export default Host;
