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

/**
 * Host detail attributes
 */
export const hostDetailAttrs = [
    '寻址方式',
    'GSE Agent ID',
    '固资编号',
    '备份维护人',
    '云主机状态',
    '管控区域',
    '云主机实例ID',
    '云地域 (Region)',
    '云厂商',
    '云可用区 (Zone)',
    '备注',
    'CPU逻辑核数',
    'CPU架构',
    'CPU型号',
    '创建时间',
    '创建人',
    '磁盘容量(GB)',
    '内网IPv4',
    '内网IPv6',
    '主机名称',
    '公网IPv4',
    '公网IPv6',
    '所属运营商',
    '内网MAC地址',
    '内存容量(MB)',
    '操作系统位数',
    '操作系统名称',
    '操作系统类型',
    '操作系统版本',
    '公网MAC地址',
    '所在省份',
    '质保年限',
    'SLA级别',
    '设备SN',
    '当前状态',
    '所在国家',
    '更新时间',
    '更新人',
    '录入时间',
    '录入方式',
    '主要维护人',
];
/**
 * Host unique options
 */
export const hostUniqueOptions = [
    '管控区域 + 内网IPv4',
    '外网IPv4',
    '云主机实例ID + 云厂商',
    '内网IPv6 + 管控区域',
    'GSE Agent ID'
];

/**
 * Search field optons for business list
*/
export const searchFieldOptions = [
    { value: "bk_biz_id", label: "ID" },
    { value: "bk_biz_name", label: "业务名" },
    { value: "bk_biz_maintainer", label: "运维人员" },
    { value: "bk_created_at", label: "创建时间", isDate: true },
    { value: "bk_created_by", label: "创建人" },
    { value: "bk_updated_at", label: "更新时间", isDate: true }
];

