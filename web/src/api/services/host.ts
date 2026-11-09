import axios from '../axiosInstance';
import type { HostDetailResponse, PoolHostListParams, PoolHostListResponse } from '../types/host';
import { listAuditLogs, type AuditListResponse } from './audit';

const URLS = {
  poolHosts: '/v1/resource-pool/hosts',
  hostByDisplayId: (displayId: number) => `/v1/hosts/display/${displayId}`,
};

export interface PoolHostQueryInput {
  page: number;
  pageSize: number;
  directoryId?: number;
  keyword?: string;
}

/**
 * 资源池主机列表的查询参数：关键字去掉首尾空白，空白时不传；
 * 目录 ID 只在大于 0 时传。
 */
export const buildPoolHostListParams = (query: PoolHostQueryInput): PoolHostListParams => {
  const params: PoolHostListParams = {
    page: query.page,
    page_size: query.pageSize,
  };
  if (query.directoryId && query.directoryId > 0) {
    params.directory_id = query.directoryId;
  }
  const keyword = query.keyword?.trim();
  if (keyword) {
    params.keyword = keyword;
  }
  return params;
};

export const listPoolHosts = (params: PoolHostListParams): Promise<PoolHostListResponse> => {
  return axios.get(URLS.poolHosts, { params });
};

/** 按 display_id 取一台主机（含云区域名称和当前归属）；不存在 404，编号非法 400 */
export const getHostByDisplayId = (displayId: number): Promise<HostDetailResponse> => {
  return axios.get(URLS.hostByDisplayId(displayId));
};

/** 一台主机最近的审计记录，按时间倒序 */
export const listHostAuditLogs = (displayId: number, pageSize = 5): Promise<AuditListResponse> => {
  return listAuditLogs({
    audit_type: 'host',
    resource_id: displayId,
    page: 1,
    page_size: pageSize,
  });
};
