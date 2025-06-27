import { AssignType, ResourceCopyKey, ResourceMoreKey } from './Types';

/**
 * "Copy" dropdown menu items
 */
export const resourceCopyMenuItems = [
    { key: ResourceCopyKey.Id, label: 'ID' },
    { key: ResourceCopyKey.IPv4, label: '内网IPv4' },
    { key: ResourceCopyKey.IPv6, label: '内网IPv6' },
    {
        key: 'cloud_id_ip_group',
        label: '管控区域ID:IP',
        children: [
            { key: ResourceCopyKey.CloudIdIPv4, label: '管控区域ID:IPv4' },
            { key: ResourceCopyKey.CloudIdIPv6, label: '管控区域ID:IPv6' },
            { key: ResourceCopyKey.CloudIdIPIPv4First, label: '管控区域ID:IP(IPv4优先)' },
            { key: ResourceCopyKey.CloudIdIPIPv6First, label: '管控区域ID:IP(IPv6优先)' },
        ],
    },
    { key: ResourceCopyKey.CloudRegion, label: '管控区域' },
    { key: ResourceCopyKey.TopoPath, label: '业务拓扑' },
    { key: ResourceCopyKey.CloudHostStatus, label: '云主机状态' },
] as const;

/**
 * Flattened list of copy keys, for easy inclusion checks
 */
export const resourceCopyKeys: ResourceCopyKey[] = resourceCopyMenuItems.flatMap((item: any) =>
    item.children ? item.children.map((c: any) => c.key) : item.key
) as ResourceCopyKey[];

/**
 * "Assign" dropdown menu items
 */
export const resourceAssignMenuItems = [
    {
        key: AssignType.Biz,
        label: "业务空闲机池",
    },
    {
        key: AssignType.HostPool,
        label: "主机池其他目录",
    }
];

/**
 * "More" dropdown menu items
 */
export const resourceMoreMenuItems = [
    {
        key: ResourceMoreKey.Delete,
        label: "删除"
    }
];
