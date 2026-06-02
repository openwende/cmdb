import axios from '../axiosInstance';
import { ApiResponse } from '../types';
import {
  BusinessListParams,
  BusinessListResponse,
  BusinessDetail,
  CreateBusinessRequest,
  UpdateBusinessRequest,
} from '../types/resource';

const URLS = {
  business: '/v1/businesses',
  hostsBatch: '/v1/hosts/batch',
  poolHostsImport: '/v1/resource-pool/hosts/import',
};

export const createBusiness = (data: CreateBusinessRequest): Promise<ApiResponse> => {
  return axios.post(URLS.business, data);
};
export const getBusinessList = (
  params: BusinessListParams,
): Promise<ApiResponse<BusinessListResponse>> => {
  return axios.get(URLS.business, { params });
};
export const getBusinessDetail = (id: number): Promise<ApiResponse<BusinessDetail>> => {
  return axios.get(`${URLS.business}/${id}`);
};
export const updateBusiness = (id: number, data: UpdateBusinessRequest): Promise<ApiResponse> => {
  return axios.put(`${URLS.business}/${id}`, data);
};
export const deleteBusiness = (id: number): Promise<ApiResponse> => {
  return axios.delete(`${URLS.business}/${id}`);
};

export interface BatchCreateHostItem {
  host_name: string;
  primary_ip: string;
  ip_addresses?: string[];
  os_type?: string;
  os_version?: string;
}

export interface BatchCreateHostsResult {
  total: number;
  successful: number;
  failed: number;
  created_ids: string[];
  errors?: Array<{ index: number; host_name: string; error: string }>;
}

export interface BatchOperationResult {
  total: number;
  successful: number;
  failed: number;
  errors?: string[];
}

interface ResourcePoolTopologyNode {
  node_id: string | number;
  node_type: string;
  is_default?: boolean;
  extra?: {
    bk_module_id?: string | number;
    [key: string]: unknown;
  };
  children?: ResourcePoolTopologyNode[];
}

interface ResourcePoolTopologyResponse {
  code: number;
  data?: ResourcePoolTopologyNode[];
  message?: string;
}

const findIdleModuleId = (nodes: ResourcePoolTopologyNode[] = []): number | undefined => {
  for (const node of nodes) {
    const isIdleModule =
      node.node_type === 'idle_module' || (node.node_type === 'module' && node.is_default);

    if (isIdleModule) {
      const moduleId = Number(node.extra?.bk_module_id ?? node.node_id);
      return Number.isFinite(moduleId) ? moduleId : undefined;
    }

    const childMatch = findIdleModuleId(node.children || []);
    if (childMatch !== undefined) {
      return childMatch;
    }
  }

  return undefined;
};

const fetchBusinessTopologyNodes = async (bizId: number): Promise<ResourcePoolTopologyNode[]> => {
  const response: ResourcePoolTopologyResponse = await axios.get('/v1/topology/tree', {
    params: {
      business_id: bizId,
      include_hosts: false,
      max_depth: 10,
    },
  });

  return response.data || [];
};

const getBusinessIdleModuleId = async (bizId: number): Promise<number> => {
  const nodes = await fetchBusinessTopologyNodes(bizId);
  const idleModuleId = findIdleModuleId(nodes);
  if (idleModuleId !== undefined) {
    return idleModuleId;
  }

  await axios.post(`/v1/topology/businesses/${bizId}/initialize`);

  const initializedNodes = await fetchBusinessTopologyNodes(bizId);
  const initializedIdleModuleId = findIdleModuleId(initializedNodes);
  if (initializedIdleModuleId === undefined) {
    throw new Error('未找到业务空闲机池模块');
  }

  return initializedIdleModuleId;
};

export const batchCreateHosts = async (
  hosts: BatchCreateHostItem[],
): Promise<BatchCreateHostsResult> => {
  // R8 统一响应：成功体为 { code, data }，批量统一 HTTP 200（部分/全部失败由 body 的
  // successful/failed 表达）。此处解包 data 返回批量结果；兼容迁移过渡期的历史裸响应
  // （无 data 时回退到顶层）。详见 docs/API_RESPONSE_STANDARD.md。
  const res: any = await axios.post(URLS.hostsBatch, {
    hosts,
    skip_errors: true,
    use_default_cloud_area: true,
  });
  return (res?.data ?? res) as BatchCreateHostsResult;
};

export const addHostsToPoolDirectory = (
  directoryId: number,
  hostIds: string[],
): Promise<BatchOperationResult> => {
  return axios.post(URLS.poolHostsImport, {
    directory_id: directoryId,
    host_ids: hostIds,
  });
};

export const assignHostsToBusinessIdlePool = (
  bizId: number,
  hostIds: string[],
): Promise<BatchOperationResult> => {
  return getBusinessIdleModuleId(bizId).then(async (targetModuleId) => {
    return axios.post('/v1/resource-pool/hosts/allocate', {
      target_module_id: targetModuleId,
      host_ids: hostIds,
    });
  });
};

export const createPoolDirectory = (name: string): Promise<{ id: number; name: string }> => {
  return axios.post('/v1/resource-pool/directories', { name });
};

export const renamePoolDirectory = (id: number, name: string): Promise<void> => {
  return axios.put(`/v1/resource-pool/directories/${id}`, { name });
};

export const deletePoolDirectory = (id: number): Promise<void> => {
  return axios.delete(`/v1/resource-pool/directories/${id}`);
};

// ===== 主机维度聚合统计（运营概览分布图，R4）=====
export interface HostStatBucket {
  name: string;
  count: number;
}
export interface HostStatistics {
  by_os_type: HostStatBucket[];
  by_business: HostStatBucket[];
  by_cloud_area: HostStatBucket[];
}

// 返回信封 { code, data }；axiosInstance 已解包一层至 HTTP body。
export const getHostStatistics = (): Promise<{ code: number; data: HostStatistics }> => {
  return axios.get('/v1/hosts/statistics');
};

// 实例按模型类型聚合（运营概览"实例统计"分布图，R4）
export interface InstanceStatistics {
  by_model: HostStatBucket[];
}
export const getInstanceStatistics = (): Promise<{ code: number; data: InstanceStatistics }> => {
  return axios.get('/v1/instances/statistics');
};
