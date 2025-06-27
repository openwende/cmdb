import { ResourceCopyKey } from "./Types";

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
            return String(record.host.bk_host_id);
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