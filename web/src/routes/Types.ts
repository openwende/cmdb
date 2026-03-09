export interface NavigationItem {
  name?: string;
  key: string;
  path?: string;
  element?: React.ReactNode;
  children?: NavigationItem[];
  hideInMenu?: boolean;
  icon?: any;
  index?: any;
}

/**
 * Entity route type for URL path segments
 */
export enum EntityRouteType {
  Business = 'business',
  BusinessSet = 'business-set',
}

export enum PrimaryNavKey {
  Home = 'home',
  Business = 'business',
  BusinessSet = 'businessSet',
  Model = 'model',
  Resource = 'resource',
  Analysis = 'analysis',
  NotFound = 'notfound',
}

export enum BusinessNavKey {
  Topology = 'topology',
  TopologyView = 'topologyView',
  Template = 'template',
  TransferHost = 'transferHost',
  DynamicGroup = 'dynamicGroup',
}

export enum BusinessSetNavKey {
  Topology = 'topology',
}

export enum ModelKey {
  Overview = 'modelOverview',
  Groups = 'modelGroups',
  Templates = 'modelTemplates',
  Topology = 'modelTopology',
  Detail = 'modelDetail',
  Basic = 'modelBasic',
  Fields = 'modelFields',
  Uniques = 'modelUniques',
  Preview = 'modelPreview',
  Instances = 'modelInstances',
  RelationDetail = 'modelRelationDetail',
  History = 'modelHistory',
  LegacyDetail = 'modelLegacyDetail',
}

export enum ResourceKey {
  Content = 'content',
  Project = 'project',
  Business = 'business',
  BusinessList = 'businessList',
  BusinessDetail = 'businessDetail',
  ArchivedBusiness = 'ArchivedBusiness',
  Host = 'host',
  HostView = 'hostView',
  DeleteHistory = 'deleteHistory',
}

export enum AnalysisKey {
  Audit = 'audit',
  Statistics = 'statistics',
}
