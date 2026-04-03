import React, { lazy, Suspense } from 'react';
import { Spin } from 'antd';
import { Navigate } from 'react-router-dom';
import ErrorBoundary from '../components/common/ErrorBoundary';
import {
  NavigationItem,
  PrimaryNavKey,
  BusinessNavKey,
  BusinessSetNavKey,
  ModelKey,
  ResourceKey,
  AnalysisKey,
} from './Types';
import {
  AppstoreOutlined,
  ContainerOutlined,
  DiffOutlined,
  BarChartOutlined,
  ProductOutlined,
  DatabaseOutlined,
  UnorderedListOutlined,
  GroupOutlined,
  NodeIndexOutlined,
} from '@ant-design/icons';

// Lazy load all page components
const HomePage = lazy(() => import('../pages/Home'));
const BusinessPage = lazy(() => import('../pages/Business'));
const BusinessEntryRedirect = lazy(() => import('../pages/Business/EntryRedirect'));
const BusinessTopology = lazy(() => import('../pages/Business/BusinessTopology'));
const TopologyView = lazy(() => import('../pages/Business/BusinessTopology/TopologyView'));
const TransferHost = lazy(() => import('../pages/Business/BusinessTopology/TransferHost'));
const DynamicGroup = lazy(() => import('../pages/Business/DynamicGroup'));

// Model pages (promoted to top-level)
const ResourceModel = lazy(() => import('../pages/Resource/Model'));
const ModelList = lazy(() => import('../pages/Resource/Model/ModelList'));
const ModelGroups = lazy(() => import('../pages/Resource/Model/pages/Groups'));
const ModelRelations = lazy(() => import('../pages/Resource/Model/pages/Relations'));
const ModelLayout = lazy(() => import('../pages/Resource/Model/ModelLayout'));
const LegacyModelRedirect = lazy(() => import('../pages/Resource/Model/pages/LegacyRedirect'));
const ModelBasicInfo = lazy(() => import('../pages/Resource/Model/pages/BasicInfo'));
const ModelFieldDesigner = lazy(() => import('../pages/Resource/Model/pages/FieldDesigner'));
const ModelUniqueRules = lazy(() => import('../pages/Resource/Model/pages/UniqueRules'));
const ModelFormPreview = lazy(() => import('../pages/Resource/Model/pages/FormPreview'));
const ModelInstances = lazy(() => import('../pages/Resource/Model/pages/Instances'));
const ModelRelationDetail = lazy(() => import('../pages/Resource/Model/pages/RelationDetail'));
const ModelHistory = lazy(() => import('../pages/Resource/Model/pages/History'));

// Resource pages
const ResourcePage = lazy(() => import('../pages/Resource'));
const ResourceBusiness = lazy(() => import('../pages/Resource/Business'));
const BusinessList = lazy(() => import('../pages/Resource/Business/BusinessList'));
const BusinessDetail = lazy(() => import('../pages/Resource/Business/BusinessDetail'));
const ArchivedBusiness = lazy(() => import('../pages/Resource/Business/ArchivedBusiness'));
const ResourceHost = lazy(() => import('../pages/Resource/Host'));
const ResourceHostView = lazy(() => import('../pages/Resource/Host/HostView'));
const ResourceDelHistory = lazy(() => import('../pages/Resource/Host/DeleteHistory'));

// Analysis pages
const AnalysisPage = lazy(() => import('../pages/Analysis'));
const AuditLogs = lazy(() => import('../pages/Analysis/Audit'));
const Statistics = lazy(() => import('../pages/Analysis/Statistics'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));

// Wrap lazy-loaded components with Suspense and ErrorBoundary
const withSuspense = (Component: React.LazyExoticComponent<any>) => (
  <ErrorBoundary>
    <Suspense
      fallback={
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '64px 0',
          }}
        >
          <Spin size="large" />
        </div>
      }
    >
      <Component />
    </Suspense>
  </ErrorBoundary>
);

export const routes: NavigationItem[] = [
  {
    name: 'routes.home',
    key: PrimaryNavKey.Home,
    path: '/',
    element: withSuspense(HomePage),
  },
  {
    name: 'routes.business',
    key: PrimaryNavKey.Business,
    path: '/business',
    element: withSuspense(BusinessEntryRedirect),
    hideInMenu: true,
  },
  {
    name: 'routes.business',
    key: 'businessEntity',
    path: '/business/:businessId',
    element: withSuspense(BusinessPage),
    children: [
      {
        name: 'routes.businessTopology',
        key: BusinessNavKey.Topology,
        path: 'topology',
        element: withSuspense(BusinessTopology),
        icon: <ContainerOutlined />,
        children: [
          {
            key: BusinessNavKey.TopologyView,
            element: withSuspense(TopologyView),
            index: true,
            hideInMenu: true,
          },
          {
            name: 'routes.transferHost',
            key: BusinessNavKey.TransferHost,
            path: 'transferHost',
            element: withSuspense(TransferHost),
            hideInMenu: true,
          },
        ],
      },
      {
        name: 'routes.dynamicGroup',
        key: BusinessNavKey.DynamicGroup,
        path: 'dynamicGroup',
        element: withSuspense(DynamicGroup),
        icon: <ProductOutlined />,
      },
    ],
  },
  {
    name: 'routes.businessSet',
    key: PrimaryNavKey.BusinessSet,
    path: '/business-set/:businessSetId',
    element: withSuspense(BusinessPage),
    hideInMenu: true,
    children: [
      {
        name: 'routes.businessSetTopology',
        key: BusinessSetNavKey.Topology,
        path: 'topology',
        element: withSuspense(BusinessTopology),
        icon: <ContainerOutlined />,
      },
    ],
  },
  // ★ Model Management — promoted to top-level navigation
  {
    name: 'routes.modelManagement',
    key: PrimaryNavKey.Model,
    path: '/model',
    element: withSuspense(ResourceModel),
    children: [
      {
        key: 'modelIndex',
        element: <Navigate to="overview" replace />,
        index: true,
        hideInMenu: true,
      },
      {
        name: 'routes.modelOverview',
        key: ModelKey.Overview,
        path: 'overview',
        element: withSuspense(ModelList),
        icon: <UnorderedListOutlined />,
      },
      {
        name: 'routes.modelGroups',
        key: ModelKey.Groups,
        path: 'groups',
        element: withSuspense(ModelGroups),
        icon: <GroupOutlined />,
      },
      {
        name: 'routes.modelTopology',
        key: ModelKey.Topology,
        path: 'topology',
        element: withSuspense(ModelRelations),
        icon: <NodeIndexOutlined />,
      },
      {
        name: 'routes.modelDetail',
        key: ModelKey.LegacyDetail,
        path: 'modelDetail/:name',
        element: withSuspense(LegacyModelRedirect),
        hideInMenu: true,
      },
      {
        key: ModelKey.Detail,
        path: ':name',
        element: withSuspense(ModelLayout),
        hideInMenu: true,
        children: [
          {
            key: 'modelBasicIndex',
            element: <Navigate to="basic" replace />,
            index: true,
            hideInMenu: true,
          },
          {
            key: ModelKey.Basic,
            path: 'basic',
            element: withSuspense(ModelBasicInfo),
            hideInMenu: true,
          },
          {
            key: ModelKey.Fields,
            path: 'fields',
            element: withSuspense(ModelFieldDesigner),
            hideInMenu: true,
          },
          {
            key: ModelKey.Uniques,
            path: 'uniques',
            element: withSuspense(ModelUniqueRules),
            hideInMenu: true,
          },
          {
            key: ModelKey.Preview,
            path: 'preview',
            element: withSuspense(ModelFormPreview),
            hideInMenu: true,
          },
          {
            key: ModelKey.Instances,
            path: 'instances',
            element: withSuspense(ModelInstances),
            hideInMenu: true,
          },
          {
            key: ModelKey.RelationDetail,
            path: 'relations',
            element: withSuspense(ModelRelationDetail),
            hideInMenu: true,
          },
          {
            key: ModelKey.History,
            path: 'history',
            element: withSuspense(ModelHistory),
            hideInMenu: true,
          },
        ],
      },
    ],
  },
  {
    name: 'routes.resource',
    key: PrimaryNavKey.Resource,
    path: '/resource',
    element: withSuspense(ResourcePage),
    children: [
      {
        name: 'routes.resourceBusiness',
        key: ResourceKey.Business,
        path: 'business',
        element: withSuspense(ResourceBusiness),
        icon: <AppstoreOutlined />,
        children: [
          {
            key: ResourceKey.BusinessList,
            element: withSuspense(BusinessList),
            index: true,
            hideInMenu: true,
          },
          {
            name: 'routes.businessDetail',
            key: ResourceKey.BusinessDetail,
            path: 'businessDetail/:id',
            element: withSuspense(BusinessDetail),
            hideInMenu: true,
          },
          {
            name: 'routes.archivedBusiness',
            key: ResourceKey.ArchivedBusiness,
            path: 'archivedBusiness',
            element: withSuspense(ArchivedBusiness),
            hideInMenu: true,
          },
        ],
      },
      {
        name: 'routes.host',
        key: ResourceKey.Host,
        path: 'host',
        element: withSuspense(ResourceHost),
        icon: <DatabaseOutlined />,
        children: [
          {
            key: ResourceKey.HostView,
            element: withSuspense(ResourceHostView),
            index: true,
            hideInMenu: true,
          },
          {
            name: 'routes.deleteHistory',
            key: ResourceKey.DeleteHistory,
            path: 'deleteHistory',
            element: withSuspense(ResourceDelHistory),
            hideInMenu: true,
          },
        ],
      },
    ],
  },
  {
    name: 'routes.analysis',
    key: PrimaryNavKey.Analysis,
    path: '/analysis',
    element: withSuspense(AnalysisPage),
    children: [
      {
        name: 'routes.auditLogs',
        key: AnalysisKey.Audit,
        path: 'audit',
        element: withSuspense(AuditLogs),
        icon: <DiffOutlined />,
      },
      {
        name: 'routes.operations',
        key: AnalysisKey.Statistics,
        path: 'statistics',
        element: withSuspense(Statistics),
        icon: <BarChartOutlined />,
      },
    ],
  },
  {
    name: 'routes.notFound',
    key: PrimaryNavKey.NotFound,
    path: '*',
    element: withSuspense(NotFoundPage),
    hideInMenu: true,
  },
];

export default routes;
