import { AssignType, ResourceCopyKey, ResourceMoreKey } from './Types';

/**
 * "Copy" dropdown menu items - will use i18n keys
 */
export const resourceCopyMenuItems = [
    { key: ResourceCopyKey.Id, label: 'resource.host.copy.id' },
    { key: ResourceCopyKey.IPv4, label: 'resource.host.copy.inner_ipv4' },
    { key: ResourceCopyKey.IPv6, label: 'resource.host.copy.inner_ipv6' },
    {
        key: 'cloud_id_ip_group',
        label: 'resource.host.copy.cloud_area_id_ip',
        children: [
            { key: ResourceCopyKey.CloudIdIPv4, label: 'resource.host.copy.cloud_area_id_ipv4' },
            { key: ResourceCopyKey.CloudIdIPv6, label: 'resource.host.copy.cloud_area_id_ipv6' },
            { key: ResourceCopyKey.CloudIdIPIPv4First, label: 'resource.host.copy.cloud_area_id_ip_ipv4_first' },
            { key: ResourceCopyKey.CloudIdIPIPv6First, label: 'resource.host.copy.cloud_area_id_ip_ipv6_first' },
        ],
    },
    { key: ResourceCopyKey.CloudRegion, label: 'resource.host.copy.cloud_area' },
    { key: ResourceCopyKey.TopoPath, label: 'resource.host.copy.topo_path' },
    { key: ResourceCopyKey.CloudHostStatus, label: 'resource.host.copy.cloud_host_status' },
] as const;

/**
 * Flattened list of copy keys, for easy inclusion checks
 */
export const resourceCopyKeys: ResourceCopyKey[] = resourceCopyMenuItems.flatMap((item: any) =>
    item.children ? item.children.map((c: any) => c.key) : item.key
) as ResourceCopyKey[];

/**
 * "Assign" dropdown menu items - will use i18n keys
 */
export const resourceAssignMenuItems = [
    {
        key: AssignType.Biz,
        label: "resource.host.assign.business_idle_pool",
    },
    {
        key: AssignType.HostPool,
        label: "resource.host.assign.host_pool_other_directory",
    }
];

/**
 * "More" dropdown menu items - will use i18n keys
 */
export const resourceMoreMenuItems = [
    {
        key: ResourceMoreKey.Delete,
        label: "resource.host.more.delete"
    }
];

/**
 * Host detail attributes - will use i18n keys
 */
export const hostDetailAttrs = [
    'resource.operation.attributes.addressing_method',
    'resource.operation.attributes.gse_agent_id',
    'resource.operation.attributes.asset_number',
    'resource.operation.attributes.backup_maintainer',
    'resource.operation.attributes.cloud_host_status',
    'resource.operation.attributes.cloud_area',
    'resource.operation.attributes.cloud_instance_id',
    'resource.operation.attributes.cloud_region',
    'resource.operation.attributes.cloud_vendor',
    'resource.operation.attributes.cloud_zone',
    'resource.operation.attributes.remark',
    'resource.operation.attributes.cpu_logical_cores',
    'resource.operation.attributes.cpu_architecture',
    'resource.operation.attributes.cpu_model',
    'resource.operation.attributes.created_time',
    'resource.operation.attributes.created_by',
    'resource.operation.attributes.disk_capacity',
    'resource.operation.attributes.inner_ipv4',
    'resource.operation.attributes.inner_ipv6',
    'resource.operation.attributes.hostname',
    'resource.operation.attributes.outer_ipv4',
    'resource.operation.attributes.outer_ipv6',
    'resource.operation.attributes.isp',
    'resource.operation.attributes.inner_mac',
    'resource.operation.attributes.memory_capacity',
    'resource.operation.attributes.os_bit',
    'resource.operation.attributes.os_name',
    'resource.operation.attributes.os_type',
    'resource.operation.attributes.os_version',
    'resource.operation.attributes.outer_mac',
    'resource.operation.attributes.province',
    'resource.operation.attributes.warranty_years',
    'resource.operation.attributes.sla_level',
    'resource.operation.attributes.device_sn',
    'resource.operation.attributes.current_status',
    'resource.operation.attributes.country',
    'resource.operation.attributes.updated_time',
    'resource.operation.attributes.updated_by',
    'resource.operation.attributes.import_time',
    'resource.operation.attributes.import_method',
    'resource.operation.attributes.main_maintainer',
];
/**
 * Host unique options - will use i18n keys
 */
export const hostUniqueOptions = [
    'resource.import.unique_options.cloud_area_ipv4',
    'resource.import.unique_options.outer_ipv4',
    'resource.import.unique_options.cloud_instance_vendor',
    'resource.import.unique_options.ipv6_cloud_area',
    'resource.import.unique_options.gse_agent_id'
];

/**
 * Search field options for business list - will use i18n keys
*/
export const searchFieldOptions = [
    { value: "bk_biz_id", label: "resource.business.search.fields.id" },
    { value: "bk_biz_name", label: "resource.business.search.fields.name" },
    { value: "bk_biz_maintainer", label: "resource.business.search.fields.maintainer" },
    { value: "bk_created_at", label: "resource.business.search.fields.created_at", isDate: true },
    { value: "bk_created_by", label: "resource.business.search.fields.created_by" },
    { value: "bk_updated_at", label: "resource.business.search.fields.updated_at", isDate: true }
];

/**
 * Business lifecycle options - will use i18n keys
 */
export const LIFECYCLE_OPTIONS = [
    { label: 'resource.business.modify.options.lifecycle.testing', value: 'testing' },
    { label: 'resource.business.modify.options.lifecycle.online', value: 'production' },
    { label: 'resource.business.modify.options.lifecycle.offline', value: 'offline' },
];

/**
 * Business language options - will use i18n keys
 */
export const LANGUAGE_OPTIONS = [
    { label: 'resource.business.modify.options.language.chinese', value: 'zh' },
    { label: 'resource.business.modify.options.language.english', value: 'en' },
];

