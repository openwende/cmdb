import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { buildModelDetailPath } from '../..';

const LegacyRedirectPage: React.FC = () => {
  const { name } = useParams<{ name: string }>();

  if (!name) {
    return <Navigate to="/model/overview" replace />;
  }

  return <Navigate to={buildModelDetailPath(name, 'basic')} replace />;
};

export default LegacyRedirectPage;
