import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom';
import { routes } from './index';
import { NavigationItem } from './Types';
import MainLayout from '@/components/Layout/MainLayout';
import { Navigate } from 'react-router-dom';
import CmdbNextPrototype from '@/pages/Prototype/CmdbNext';
import TopologyWorkstationPrototype from '@/pages/Prototype/TopologyWorkstation';
import ImpactAnalysisPrototype from '@/pages/Prototype/ImpactAnalysis';
import SreWorkbenchPrototype from '@/pages/Prototype/SreWorkbench';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import LoginPage from '@/pages/Login';

function createRouteElements(items: NavigationItem[]): React.ReactNode[] {
  return items.map((item) => (
    <Route
      key={item.key}
      path={item.path}
      element={item.element}
      index={item.index}
      handle={{
        navigationItem: item,
      }}
    >
      {item.children && createRouteElements(item.children)}
    </Route>
  ));
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<MainLayout />}>
          {createRouteElements(routes)}
        </Route>
      </Route>
      <Route path="/prototype/cmdb-next">
        <Route index element={<Navigate to="workbench" replace />} />
        <Route path=":section" element={<CmdbNextPrototype />} />
      </Route>
      <Route path="/prototype/topology-workstation" element={<TopologyWorkstationPrototype />} />
      <Route path="/prototype/impact-analysis" element={<ImpactAnalysisPrototype />} />
      <Route path="/prototype/sre-workbench" element={<SreWorkbenchPrototype />} />
    </>,
  ),
);

export default router;
