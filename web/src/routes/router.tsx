import React from 'react';
import { createBrowserRouter, createRoutesFromElements, Route } from 'react-router-dom';
import { routes } from './index';
import { NavigationItem } from './Types';
import MainLayout from '@/components/Layout/MainLayout';

function createRouteElements(items: NavigationItem[]): React.ReactNode[] {
  return items.map(item => (
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
    <Route path="/" element={<MainLayout />}>
      {createRouteElements(routes)}
    </Route>
  )
);

export default router;