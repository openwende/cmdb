import { AssignType, ResourceCopyKey, ResourceMoreKey } from './Types';

/**
 * "Copy" dropdown menu**
 */
export const resourceCopyMenuItems = [
  { key: ResourceCopyKey.Id, label: 'resource.host.copy.id' },
  { key: ResourceCopyKey.IPv4, label: 'resource.host.copy.innerIpv4' },
  { key: ResourceCopyKey.IPv6, label: 'resource.host.copy.innerIpv6' },
  {
    key: 'cloud_id_ip_group',
    label: 'resource.host.copy.cloudAreaIdIp',
    children: [
      { key: ResourceCopyKey.CloudIdIPv4, label: 'resource.host.copy.cloudAreaIdIpv4' },
      { key: ResourceCopyKey.CloudIdIPv6, label: 'resource.host.copy.cloudAreaIdIpv6' },
      {
        key: ResourceCopyKey.CloudIdIPIPv4First,
        label: 'resource.host.copy.cloudAreaIdIpIpv4First',
      },
      {
        key: ResourceCopyKey.CloudIdIPIPv6First,
        label: 'resource.host.copy.cloudAreaIdIpIpv6First',
      },
    ],
  },
  { key: ResourceCopyKey.CloudRegion, label: 'resource.host.copy.cloudArea' },
  { key: ResourceCopyKey.TopoPath, label: 'resource.host.copy.topoPath' },
  { key: ResourceCopyKey.CloudHostStatus, label: 'resource.host.copy.cloudHostStatus' },
] as const;

/**
 * Flattened list of copy keys, for easy inclusion checks
 */
export const resourceCopyKeys: ResourceCopyKey[] = resourceCopyMenuItems.flatMap((item: any) =>
  item.children ? item.children.map((c: any) => c.key) : item.key,
) as ResourceCopyKey[];

/**
 * "Assign" dropdown menu items - will use i18n keys
 */
export const resourceAssignMenuItems = [
  {
    key: AssignType.Biz,
    label: 'resource.host.assign.businessIdlePool',
  },
  {
    key: AssignType.HostPool,
    label: 'resource.host.assign.hostPoolOtherDirectory',
  },
];

/**
 * "More" dropdown menu items - will use i18n keys
 */
export const resourceMoreMenuItems = [
  {
    key: ResourceMoreKey.Delete,
    label: 'resource.host.more.delete',
  },
];

/**
 * Host detail attributes - will use i18n keys
 */
export const hostDetailAttrs = [
  'resource.operation.attributes.addressingMethod',
  'resource.operation.attributes.gseAgentId',
  'resource.operation.attributes.assetNumber',
  'resource.operation.attributes.backupMaintainer',
  'resource.operation.attributes.cloudHostStatus',
  'resource.operation.attributes.cloudArea',
  'resource.operation.attributes.cloudInstanceId',
  'resource.operation.attributes.cloudRegion',
  'resource.operation.attributes.cloudVendor',
  'resource.operation.attributes.cloudZone',
  'resource.operation.attributes.remark',
  'resource.operation.attributes.cpuLogicalCores',
  'resource.operation.attributes.cpuArchitecture',
  'resource.operation.attributes.cpuModel',
  'resource.operation.attributes.createdTime',
  'resource.operation.attributes.createdBy',
  'resource.operation.attributes.diskCapacity',
  'resource.operation.attributes.innerIpv4',
  'resource.operation.attributes.innerIpv6',
  'resource.operation.attributes.hostname',
  'resource.operation.attributes.outerIpv4',
  'resource.operation.attributes.outerIpv6',
  'resource.operation.attributes.isp',
  'resource.operation.attributes.innerMac',
  'resource.operation.attributes.memoryCapacity',
  'resource.operation.attributes.osBit',
  'resource.operation.attributes.osName',
  'resource.operation.attributes.osType',
  'resource.operation.attributes.osVersion',
  'resource.operation.attributes.outerMac',
  'resource.operation.attributes.province',
  'resource.operation.attributes.warrantyYears',
  'resource.operation.attributes.slaLevel',
  'resource.operation.attributes.deviceSn',
  'resource.operation.attributes.currentStatus',
  'resource.operation.attributes.country',
  'resource.operation.attributes.updatedTime',
  'resource.operation.attributes.updatedBy',
  'resource.operation.attributes.importTime',
  'resource.operation.attributes.importMethod',
  'resource.operation.attributes.mainMaintainer',
];

/**
 * Host unique identifier options - will use i18n keys
 */
export const hostUniqueOptions = [
  'resource.import.uniqueOptions.cloudAreaIpv4',
  'resource.import.uniqueOptions.outerIpv4',
  'resource.import.uniqueOptions.cloudInstanceVendor',
  'resource.import.uniqueOptions.ipv6CloudArea',
  'resource.import.uniqueOptions.gseAgentId',
];

/**
 * Search field options for business list - will use i18n keys
 */
export const searchFieldOptions = [
  { value: 'bk_biz_id', label: 'resource.business.search.fields.id' },
  { value: 'bk_biz_name', label: 'resource.business.search.fields.name' },
  { value: 'bk_biz_maintainer', label: 'resource.business.search.fields.maintainer' },
  { value: 'bk_created_at', label: 'resource.business.search.fields.createdAt', isDate: true },
  { value: 'bk_created_by', label: 'resource.business.search.fields.createdBy' },
  { value: 'bk_updated_at', label: 'resource.business.search.fields.updatedAt', isDate: true },
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
  { label: '中文', value: 'zh' },
  { label: 'English', value: 'en' },
];
