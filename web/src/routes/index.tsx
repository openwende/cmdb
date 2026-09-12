import React, { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';
import ErrorBoundary from '../components/common/ErrorBoundary';
import PageLoading from '../components/common/PageLoading';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
// These are pure layout/pass-through routes (just <Outlet/>, optionally an
// index <Navigate/>) with no real content or data fetching. Import them
// eagerly instead of lazily: lazy-loading + Suspense-wrapping every level of
// a nested route chain caused a "double loading" flash on hard refresh —
// the parent layout's own Suspense fallback appeared first, then the child
// leaf route's fallback appeared right after, since neither chunk was
// cached yet. In-app menu navigation didn't show this because the layout
// chunk was already resolved from an earlier visit. Eager-importing these
// collapses each chain down to a single Suspense boundary (the actual leaf
// page), so only one loading fallback ever appears, on cold load or not.
import ResourcePage from '../pages/Resource';
import ResourceBusiness from '../pages/Resource/Business';
import ResourceHost from '../pages/Resource/Host';
import ResourceModel from '../pages/Resource/Model';
import BusinessPage from '../pages/Business';
import BusinessTopology from '../pages/Business/BusinessTopology';
import AnalysisPage from '../pages/Analysis';
import {
  NavigationItem,
  PrimaryNavKey,
  BusinessNavKey,
  BusinessSetNavKey,
  ModelKey,
  ResourceKey,
  AnalysisKey,
  AdminKey,
} from './Types';
import {
  AppstoreOutlined,
  DiffOutlined,
  BarChartOutlined,
  ProductOutlined,
  DatabaseOutlined,
  UnorderedListOutlined,
  GroupOutlined,
  NodeIndexOutlined,
  TeamOutlined,
  ProfileOutlined,
} from '@ant-design/icons';

// Lazy load all page components
const HomePage = lazy(() => import('../pages/Home'));
const BusinessEntryRedirect = lazy(() => import('../pages/Business/EntryRedirect'));
const TopologyView = lazy(() => import('../pages/Business/BusinessTopology/TopologyView'));
const TransferHost = lazy(() => import('../pages/Business/BusinessTopology/TransferHost'));
const DynamicGroup = lazy(() => import('../pages/Business/DynamicGroup'));

// Model pages (promoted to top-level)
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
const BusinessList = lazy(() => import('../pages/Resource/Business/BusinessList'));
const BusinessDetail = lazy(() => import('../pages/Resource/Business/BusinessDetail'));
const ArchivedBusiness = lazy(() => import('../pages/Resource/Business/ArchivedBusiness'));
const ResourceHostView = lazy(() => import('../pages/Resource/Host/HostView'));
const ResourceDelHistory = lazy(() => import('../pages/Resource/Host/DeleteHistory'));

// Analysis pages
const AuditLogs = lazy(() => import('../pages/Analysis/Audit'));
const Statistics = lazy(() => import('../pages/Analysis/Statistics'));
const UserManagementPage = lazy(() => import('../pages/Admin/Users'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));

// Wrap lazy-loaded components with Suspense and ErrorBoundary
const withSuspense = (Component: React.LazyExoticComponent<any>) => {
  // Use the component's generated name or a fallback string to ensure unique keys per route component
  const errorBoundaryKey =
    typeof Component === 'function' && Component.name
      ? Component.name
      : Math.random().toString(36).substring(7);
  return (
    <ErrorBoundary key={errorBoundaryKey}>
      <Suspense fallback={<PageLoading />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
};

// Wrap eagerly-imported layout/pass-through components with just an
// ErrorBoundary — no Suspense needed since there is no chunk to await.
const withBoundary = (Component: React.ComponentType) => (
  <ErrorBoundary key={Component.displayName || Component.name}>
    <Component />
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
  },
  // Redirect legacy /topology to business entry (auto-redirects to first business)
  {
    key: 'topologyRedirect',
    path: '/topology',
    element: <Navigate to="/business" replace />,
    hideInMenu: true,
  },
  {
    name: 'routes.business',
    key: 'businessEntity',
    path: '/business/:businessId',
    element: withBoundary(BusinessPage),
    hideInMenu: true,
    children: [
      {
        key: 'businessEntityIndex',
        element: <Navigate to="topology" replace />,
        index: true,
        hideInMenu: true,
      },
      {
        name: 'routes.businessTopology',
        key: BusinessNavKey.Topology,
        path: 'topology',
        element: withBoundary(BusinessTopology),
        icon: <ProfileOutlined />,
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
    element: withBoundary(BusinessPage),
    hideInMenu: true,
    children: [
      {
        key: 'businessSetEntityIndex',
        element: <Navigate to="topology" replace />,
        index: true,
        hideInMenu: true,
      },
      {
        name: 'routes.businessSetTopology',
        key: BusinessSetNavKey.Topology,
        path: 'topology',
        element: withBoundary(BusinessTopology),
        icon: <ProfileOutlined />,
      },
    ],
  },
  // ★ Model Management — promoted to top-level navigation
  {
    name: 'routes.modelManagement',
    key: PrimaryNavKey.Model,
    path: '/model',
    element: withBoundary(ResourceModel),
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
    element: withBoundary(ResourcePage),
    children: [
      {
        key: 'resourceIndex',
        element: <Navigate to="business" replace />,
        index: true,
        hideInMenu: true,
      },
      {
        name: 'routes.resourceBusiness',
        key: ResourceKey.Business,
        path: 'business',
        element: withBoundary(ResourceBusiness),
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
        element: withBoundary(ResourceHost),
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
    element: withBoundary(AnalysisPage),
    children: [
      {
        key: 'analysisIndex',
        element: <Navigate to="audit" replace />,
        index: true,
        hideInMenu: true,
      },
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
    name: 'routes.userManagement',
    key: PrimaryNavKey.AdminUsers,
    path: '/admin',
    icon: <TeamOutlined />,
    element: <ProtectedRoute requiredRoles={['admin']} />,
    children: [
      {
        key: 'adminIndex',
        element: <Navigate to="users" replace />,
        index: true,
        hideInMenu: true,
      },
      {
        name: 'routes.userList',
        key: AdminKey.Users,
        path: 'users',
        element: withSuspense(UserManagementPage),
        icon: <TeamOutlined />,
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
