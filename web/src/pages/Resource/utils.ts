import { HostPoolStatus, ResourceCopyKey } from './Types';

/**
 * Get the text of the host record based on the copied key.
 *
 * @param record Single host record
 * @param copyKey Copy menu option key
 * @returns Return the text to be copied; return an empty string if no corresponding data exists
 */
export const getHostCopyValue = (record: any, copyKey: ResourceCopyKey) => {
  const cloud = record.host.bk_cloud_id?.[0];
  const cloudStr = cloud ? `${cloud.bk_inst_id}` : '';
  const region = cloud ? `${cloud.bk_inst_name}[${cloud.bk_inst_id}]` : '';
  switch (copyKey) {
    case ResourceCopyKey.Id:
      return String(record.host.bk_host_display_id ?? record.host.bk_host_id);
    case ResourceCopyKey.IPv4:
      return record.host.bk_host_innerip || '';
    case ResourceCopyKey.IPv6:
      return record.host.bk_host_innerip_v6 || '--';
    case ResourceCopyKey.CloudRegion:
      return region;
    case ResourceCopyKey.CloudIdIPv4:
      return cloud ? `${cloudStr}:${record.host.bk_host_innerip || ''}` : '';
    case ResourceCopyKey.CloudIdIPv6:
      return cloud ? `${cloudStr}:[${record.host.bk_host_innerip_v6 || '--'}]` : '';
    case ResourceCopyKey.CloudIdIPIPv4First: {
      if (!cloud) return '';
      const ipv4 = record.host.bk_host_innerip;
      const ipv6 = record.host.bk_host_innerip_v6;
      return ipv4 ? `${cloudStr}:${ipv4}` : `${cloudStr}:[${ipv6 || '--'}]`;
    }
    case ResourceCopyKey.CloudIdIPIPv6First: {
      if (!cloud) return '';
      const ipv4 = record.host.bk_host_innerip;
      const ipv6 = record.host.bk_host_innerip_v6;
      return ipv6 ? `${cloudStr}:[${ipv6}]` : `${cloudStr}:${ipv4 || ''}`;
    }
    case ResourceCopyKey.TopoPath:
      return (record.module[0]?.topo_module_name || '').replace(/##/g, '/');
    case ResourceCopyKey.CloudHostStatus:
      return record.host.bk_cloud_host_status || '--';
    default:
      return '';
  }
};

/**
 * Check if the selected host is in the host pool
 *
 * Check rules:
 * 1. The length of the host's module array must be 1;
 * 2. module[0].bk_module_id must exist in the bk_module_id set of hostDirectory.
 *
 * @param selectedRowKeys Selected host row key list (host_id)
 * @param allHostsData    All host data
 * @param hostDirectory   Host pool directory data
 * @returns HostPoolStatus[]   Return an array containing the host pool judgment result
 */
export function checkHostsInHostPool(
  selectedRowKeys: React.Key[],
  allHostsData: any[],
  hostDirectory: { bk_module_id: number }[],
): HostPoolStatus[] {
  if (!selectedRowKeys?.length) return [];

  const hostPoolModuleIds = hostDirectory.map((dir) => dir.bk_module_id);

  return selectedRowKeys.map((key) => {
    const hostItem = allHostsData.find((h) => h.host.bk_host_id === key);
    // Get module info
    const modules = hostItem?.module ?? [];
    const hasSingleModule = modules.length === 1;
    const moduleId = hasSingleModule ? modules[0].bk_module_id : null;
    const inHostPool = hasSingleModule && hostPoolModuleIds.includes(moduleId as number);
    return {
      id: key,
      ip: hostItem?.host?.bk_host_innerip ?? '',
      moduleId,
      inHostPool,
    } as HostPoolStatus;
  });
}
