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