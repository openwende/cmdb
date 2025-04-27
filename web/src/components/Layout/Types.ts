export interface Navigation {
    name: string;
    key: string;
    path: string;
    element: React.ReactNode;
    children?: Navigation[];
}

export enum PrimaryNavKey {
    Home = 'home',
    Business = 'business',
    Resource = 'resource'
}

export enum BusinessNavKey {
    Topology = 'topology',
    Template = 'template'
}