import React, { lazy, Suspense } from 'react';
import { NavigationItem, PrimaryNavKey, BusinessNavKey, ResourceKey } from './Types';
import { AppstoreOutlined, ContainerOutlined, PieChartOutlined, UnorderedListOutlined} from '@ant-design/icons';

// Lazy load all page components
const HomePage = lazy(() => import('../pages/Home'));
const BusinessPage = lazy(() => import('../pages/Business'));
const BusinessTopology = lazy(() => import('../pages/Business/BusinessTopology'));
const ServiceTemplate = lazy(() => import('../pages/Business/ServiceTemplate'));
const ResourcePage = lazy(() => import('../pages/Resource'));
const ResourceContent = lazy(() => import('../pages/Resource/ResourceContent'));
const ResourceProject = lazy(() => import('../pages/Resource/ResourceProject'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));

// Loading component for Suspense
const Loading = () => <div>Loading...</div>;

// Wrap lazy-loaded components with Suspense
const withSuspense = (Component: React.LazyExoticComponent<any>) => (
  <Suspense fallback={<Loading />}>
    <Component />
  </Suspense>
);

export const routes: NavigationItem[] = [
  {
    name: '首页',
    key: PrimaryNavKey.Home,
    path: '/',
    element: withSuspense(HomePage)
  },
  {
    name: '业务',
    key: PrimaryNavKey.Business,
    path: '/business',
    element: withSuspense(BusinessPage),
    children: [
      {
        name: '业务拓扑',
        key: BusinessNavKey.Topology,
        path: '/business/topology',
        element: withSuspense(BusinessTopology),
        icon: <UnorderedListOutlined />
      },
      {
        name: '服务模板',
        key: BusinessNavKey.Template,
        path: '/business/template',
        element: withSuspense(ServiceTemplate),
        icon: <PieChartOutlined />
      }
    ]
  },
  {
    name: '资源',
    key: PrimaryNavKey.Resource,
    path: '/resource',
    element: withSuspense(ResourcePage),
    children: [
      {
        name: '资源目录',
        key: ResourceKey.Content,
        path: '/resource/content',
        element: withSuspense(ResourceContent),
        icon: <ContainerOutlined />
      },
      {
        name: '项目',
        key: ResourceKey.Project,
        path: '/resource/project',
        element: withSuspense(ResourceProject),
        icon: <AppstoreOutlined />
      }
    ]
  },
  {
    name: '404',
    key: PrimaryNavKey.NotFound,
    path: '*',
    element: withSuspense(NotFoundPage),
    hideInMenu: true
  }
];

export default routes; 