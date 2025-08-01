export interface NavigationItem {
    name: string;
    key: string;
    path: string;
    element: React.ReactNode;
    children?: NavigationItem[];
    hideInMenu?: boolean;
    icon?: any;
    index?: boolean;
}

/**
 * Entity route type for URL path segments
 */
export enum EntityRouteType {
    Business = 'business',
    BusinessSet = 'business-set'
}

export enum PrimaryNavKey {
    Home = 'home',
    Business = 'business',
    BusinessSet = 'businessSet',
    Resource = 'resource',
    NotFound = 'notfound'
}

export enum BusinessNavKey {
    Topology = 'topology',
    Template = 'template',
    TransferHost = 'transferHost'
}

export enum BusinessSetNavKey {
    Topology = 'topology'
}

export enum ResourceKey {
    Content = 'content',
    Project = 'project',
    Business = 'business',
    ArchivedBusiness = 'ArchivedBusiness',
    Host = 'host',
    DeleteHistory = 'deleteHistory'
}