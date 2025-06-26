import { CopyMenuItemKey, TransferMenuItemType } from "./Types";

/**
 * "Copy" dropdown menu items
 */
export const hostCopyMenuItems = [
    { key: CopyMenuItemKey.Id, label: 'ID' },
    { key: CopyMenuItemKey.IPv4, label: '内网IPv4' },
    { key: CopyMenuItemKey.IPv6, label: '内网IPv6' },
    {
        key: 'cloud_id_ip_group',
        label: '管控区域ID:IP',
        children: [
            { key: CopyMenuItemKey.CloudIdIPv4, label: '管控区域ID:IPv4' },
            { key: CopyMenuItemKey.CloudIdIPv6, label: '管控区域ID:IPv6' },
            { key: CopyMenuItemKey.CloudIdIpIPv4First, label: '管控区域ID:IP(IPv4优先)' },
            { key: CopyMenuItemKey.CloudIdIpIPv6First, label: '管控区域ID:IP(IPv6优先)' },
        ]
    },
    { key: CopyMenuItemKey.CloudRegion, label: '管控区域' },
    { key: CopyMenuItemKey.ModuleName, label: '模块名' },
    { key: CopyMenuItemKey.SetName, label: '集群名' },
] as const;

/**
 * Flattened list of copy keys, for easy inclusion checks
 */
export const hostCopyKeys: CopyMenuItemKey[] = hostCopyMenuItems.flatMap((item: any) =>
    item.children ? item.children.map((c: any) => c.key) : item.key
) as CopyMenuItemKey[];

/**
 * "Move to" dropdown menu items
 */
export const transferBaseMenuItems = [
    { key: TransferMenuItemType.idlePool, label: '空闲机池' },
    { key: TransferMenuItemType.businessModule, label: '业务模块' },
    { key: TransferMenuItemType.hostPool, label: '主机池' },
    { key: TransferMenuItemType.otherBusiness, label: '其他业务' },
] as const;