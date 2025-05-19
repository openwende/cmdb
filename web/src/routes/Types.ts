export interface NavigationItem {
    name: string;
    key: string;
    path: string;
    element: React.ReactNode;
    children?: NavigationItem[];
    hideInMenu?: boolean;
    icon?: any;
}

export enum PrimaryNavKey {
    Home = 'home',
    Business = 'business',
    Resource = 'resource',
    NotFound = 'notfound'
}

export enum BusinessNavKey {
    Topology = 'topology',
    Template = 'template'
}

export enum ResourceKey {
    Content = 'content',
    Project = 'project',
    Business = 'business',
    Host = 'host'
}