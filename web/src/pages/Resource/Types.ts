// Host part
export enum TabsKey {
  Unassigned = 'unassigned',
  Assigned = 'assigned',
  All = 'all',
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
  Delete = 'delete',
}
export enum AssignType {
  Biz = 'biz',
  HostPool = 'hostPool',
  None = 'none',
}
export interface MenuItemProps {
  key: string;
  label: React.ReactNode;
  disabled?: boolean;
}
// "Copy" dropdown menu item key
export enum ResourceCopyKey {
  Id = 'id',
  IPv4 = 'ipv4',
  IPv6 = 'ipv6',
  CloudIdIPv4 = 'cloudIdIpv4',
  CloudIdIPv6 = 'cloudIdIpv6',
  CloudIdIPIPv4First = 'cloudIdIpIpv4First',
  CloudIdIPIPv6First = 'cloudIdIpIpv6First',
  CloudRegion = 'cloudRegion',
  TopoPath = 'topoPath',
  CloudHostStatus = 'cloudHostStatus',
}
export enum ResourceMoreKey {
  Delete = 'delete',
}
// Host pool status
export interface HostPoolStatus {
  id: number;
  ip: string;
  moduleId: number | null;
  inHostPool: boolean;
}
