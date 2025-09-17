import React, { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { NavigationItem, PrimaryNavKey, BusinessNavKey, BusinessSetNavKey, ResourceKey } from './Types';
import { AppstoreOutlined, ContainerOutlined, PieChartOutlined, UnorderedListOutlined } from '@ant-design/icons';

// Lazy load all page components
const HomePage = lazy(() => import('../pages/Home'));
const BusinessPage = lazy(() => import('../pages/Business'));
const BusinessTopology = lazy(() => import('../pages/Business/BusinessTopology'));
const TopologyView = lazy(() => import('../pages/Business/BusinessTopology/TopologyView'));
const TransferHost = lazy(() => import('../pages/Business/BusinessTopology/TransferHost'));
const ServiceTemplate = lazy(() => import('../pages/Business/ServiceTemplate'));
const DynamicGroup = lazy(() => import('../pages/Business/DynamicGroup'));
const ResourcePage = lazy(() => import('../pages/Resource'));
const ResourceContent = lazy(() => import('../pages/Resource/ResourceContent'));
const ResourceProject = lazy(() => import('../pages/Resource/ResourceProject'));
const ResourceBusiness = lazy(() => import('../pages/Resource/Business'));
const BusinessList = lazy(() => import('../pages/Resource/Business/BusinessList'));
const BusinessDetail = lazy(() => import('../pages/Resource/Business/BusinessDetail'));
const ArchivedBusiness = lazy(() => import('../pages/Resource/Business/ArchivedBusiness'));
const ResourceHost = lazy(() => import('../pages/Resource/Host'));
const ResourceHostView = lazy(() => import('../pages/Resource/Host/HostView'));
const ResourceDelHistory = lazy(() => import('../pages/Resource/Host/DeleteHistory'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));

// Wrap lazy-loaded components with Suspense
const withSuspense = (Component: React.LazyExoticComponent<any>) => (
  <Suspense fallback={
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Spin size="large" />
    </div>
  }
  >
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
    path: '/business/:businessId',
    element: withSuspense(BusinessPage),
    children: [
      {
        name: '业务拓扑',
        key: BusinessNavKey.Topology,
        path: 'topology',
        element: withSuspense(BusinessTopology),
        icon: <UnorderedListOutlined />,
        children: [
          {
            key: BusinessNavKey.TopologyView,
            element: withSuspense(TopologyView),
            index: true,
            hideInMenu: true
          },
          {
            name: '转移主机',
            key: BusinessNavKey.TransferHost,
            path: 'transferHost',
            element: withSuspense(TransferHost),
            hideInMenu: true
          }
        ]
      },
      {
        name: '服务模板',
        key: BusinessNavKey.Template,
        path: 'template',
        element: withSuspense(ServiceTemplate),
        icon: <PieChartOutlined />
      },
      {
        name: '动态分组',
        key: BusinessNavKey.DynamicGroup,
        path: 'dynamicGroup',
        element: withSuspense(DynamicGroup),
        icon: <PieChartOutlined />
      }
    ]
  },
  {
    name: '业务集',
    key: PrimaryNavKey.BusinessSet,
    path: '/business-set/:businessSetId',
    element: withSuspense(BusinessPage),
    hideInMenu: true,
    children: [
      {
        name: '业务集拓扑',
        key: BusinessSetNavKey.Topology,
        path: 'topology',
        element: withSuspense(BusinessTopology),
        icon: <UnorderedListOutlined />,
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
        path: 'content',
        element: withSuspense(ResourceContent),
        icon: <ContainerOutlined />
      },
      {
        name: '项目',
        key: ResourceKey.Project,
        path: 'project',
        element: withSuspense(ResourceProject),
        icon: <AppstoreOutlined />
      },
      {
        name: '业务',
        key: ResourceKey.Business,
        path: 'business',
        element: withSuspense(ResourceBusiness),
        icon: <AppstoreOutlined />,
        children: [
          {
            key: ResourceKey.BusinessList,
            element: withSuspense(BusinessList),
            index: true,
            hideInMenu: true
          },
          {
            name: '业务详情',
            key: ResourceKey.BusinessDetail,
            path: 'businessDetail/:id',
            element: withSuspense(BusinessDetail),
            hideInMenu: true
          },
          {
            name: '已归档业务',
            key: ResourceKey.ArchivedBusiness,
            path: 'archivedBusiness',
            element: withSuspense(ArchivedBusiness),
            hideInMenu: true
          },
        ]
      },
      {
        name: '主机',
        key: ResourceKey.Host,
        path: 'host',
        element: withSuspense(ResourceHost),
        icon: <AppstoreOutlined />,
        children: [
          {
            key: ResourceKey.HostView,
            element: withSuspense(ResourceHostView),
            index: true,
            hideInMenu: true
          },
          {
            name: '删除历史',
            key: ResourceKey.DeleteHistory,
            path: 'deleteHistory',
            element: withSuspense(ResourceDelHistory),
            hideInMenu: true
          },
        ]
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