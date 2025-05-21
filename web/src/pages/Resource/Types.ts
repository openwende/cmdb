// Host part
export enum TabsKey {
    Unassigned = 'unassigned',
    Assigned = 'assigned',
    All = 'all'
}

export interface TabsProps {
    key: TabsKey;
    label: string;
    children: React.ReactNode;
}

export interface DirectoryData {
    key: number;
    title: React.ReactNode;
    count?: number;
    children?: DirectoryData[];
    icon?: React.ReactNode;
}

export enum DirMenuKey {
    Rename = 'rename',
    Delete = 'delete'
}

// The key of the directory pinned to the top
export enum DirPinToTopKey {
    None = -1,
    Unpin = 0,
    Pin = 1
}