import axios from '../axiosInstance';
import { Property, PropertyMap } from '../../pages/Business/Types';
import { dynamicGroupCondition, objectmainline } from '../../mock/business';
import { ObjectMainLine } from '../../pages/Business/Types';
import { createIdProperty } from '@/pages/Business/utils';

interface BatchSearchOptions {
  params: {
    bk_biz_id?: number;
    bk_obj_id: { $in: string[] };
    bk_supplier_account: string;
  };
  config?: {
    requestId?: symbol;
    fromCache?: boolean;
  };
  injectId?: string;
}

import {
  CreateTopologyModulePayload,
  CreateTopologySetPayload,
  GetTopologyTreeRequest,
  GetTopologyTreeResponse,
} from '../types/topology';

// --- API Endpoints ---
const hostListApi = '/v1/hosts';

// --- Business & Business Set List ---
/**
 * 获取业务列表
 * @returns Promise<any>
 */
export const getBusinessList = async () => {
  try {
    const response: any = await axios.get('/v1/businesses');
    return response;
  } catch (error) {
    console.error('Failed to fetch business list:', error);
    throw error;
  }
};

/**
 * 获取业务集列表
 * @returns Promise<any>
 */
export const getBusinessSetList = async () => {
  try {
    const response: any = await axios.get('/v1/business-sets');
    return response;
  } catch (error) {
    console.error('Failed to fetch business set list:', error);
    throw error;
  }
};

// --- Business Topology ---
/**
 * 获取业务拓扑树
 * @param params 查询参数
 * @returns Promise<GetTopologyTreeResponse>
 */
export const getTopologyTree = async (
  params?: GetTopologyTreeRequest,
): Promise<GetTopologyTreeResponse> => {
  try {
    const response: GetTopologyTreeResponse = await axios.get('/v1/topology/tree', {
      params,
    });
    return response;
  } catch (error) {
    console.error('Failed to fetch topology tree:', error);
    throw error;
  }
};

export interface TopologyNodePathItem {
  node_id: string;
  node_type: string;
  name: string;
  model_uid?: string;
}

export interface TopologyNodeDetail {
  node_id: string;
  node_type?: string;
  name?: string;
  model_uid: string;
  path: TopologyNodePathItem[];
  statistics?: Record<string, any>;
  allowed_actions: string[];
  form_schema_ref?: string;
  binding_summary?: Record<string, any>;
}

export const getTopologyNodeDetail = async (
  nodeId: string,
): Promise<{ code: number; data: TopologyNodeDetail; message?: string }> => {
  return axios.get(`/v1/topology/nodes/${encodeURIComponent(nodeId)}`);
};

export interface TopologyNodeHostItem {
  host_id: string;
  inner_ipv4: string;
  inner_ipv6: string;
  cloud_area?: {
    id: string;
    name: string;
  } | null;
  module?: {
    id: number;
    name: string;
  } | null;
  set?: {
    id: number;
    name: string;
  } | null;
  status: string;
}

export interface TopologyNodeHostsResponse {
  code: number;
  data: {
    items: TopologyNodeHostItem[];
    pagination: {
      page: number;
      page_size: number;
      total: number;
      total_page: number;
    };
  };
  message?: string;
}

export const getTopologyNodeHosts = async (
  nodeId: string,
  params: {
    page: number;
    page_size: number;
    keyword?: string;
  },
): Promise<TopologyNodeHostsResponse> => {
  return axios.get(`/v1/topology/nodes/${encodeURIComponent(nodeId)}/hosts`, {
    params,
  });
};

export const createTopologySet = async (payload: CreateTopologySetPayload) => {
  return axios.post('/v1/topology/sets', payload);
};

export const createTopologyModule = async (payload: CreateTopologyModulePayload) => {
  return axios.post('/v1/topology/modules', payload);
};

export const updateTopologySet = async (
  id: number,
  payload: {
    name?: string;
    description?: string;
    env_type?: string;
    sort_order?: number;
  },
) => {
  return axios.put(`/v1/topology/sets/${id}`, payload);
};

export const updateTopologyModule = async (
  id: number,
  payload: {
    name?: string;
    description?: string;
    service_type?: string;
    sort_order?: number;
  },
) => {
  return axios.put(`/v1/topology/modules/${id}`, payload);
};

export const deleteTopologySet = async (id: number) => {
  return axios.delete(`/v1/topology/sets/${id}`);
};

export const deleteTopologyModule = async (id: number) => {
  return axios.delete(`/v1/topology/modules/${id}`);
};

export const transferTopologyHosts = async (payload: {
  host_ids: string[];
  target_module_id: number;
}) => {
  return axios.post('/v1/topology/hosts/transfer', payload);
};

export const transferTopologyHostsToPool = async (payload: { host_ids: string[] }) => {
  return axios.post('/v1/topology/hosts/transfer-to-pool', payload);
};

/**
 * 获取主机列表
 * @param params 查询参数
 * @returns Promise<any>
 */
export const getHostList = (params: any) => {
  return axios.get(hostListApi, params);
};

// --- Dyniamic Group ---
/**
 * 批量查询对象属性模型
 * @param objIds 模型ID数组，如 ['host', 'set', 'module']
 * @param bizId 业务ID（可选）
 * @returns Promise<PropertyMap>
 */
export const batchSearchObjectAttribute = async ({
  params,
  config,
  injectId,
}: BatchSearchOptions): Promise<PropertyMap> => {
  try {
    // TODO: api
    // $http.post('find/objectattr/web', params, config)
    console.log(config);
    const mockData = dynamicGroupCondition;

    const result: any = {};
    params.bk_obj_id.$in.forEach((objId: string) => {
      result[objId] = [];
    });
    mockData.forEach((property) => {
      result[property.bk_obj_id].push(property);
    });
    Object.keys(result).forEach((objId) => {
      if (injectId === objId) {
        const alreadyInject = result[objId].some((property: Property) => property._is_inject_);
        if (!alreadyInject) {
          result[objId].unshift(createIdProperty(objId));
        }
      }
    });
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
/**
 * 查询单个对象的属性模型
 * @param objId 模型ID
 * @param bizId 业务ID（可选）
 * @returns Promise<PropertyModel[]>
 */
export const searchObjectAttribute = async (
  objId: string,
  _bizId?: number, // 使用下划线前缀表示未使用的参数
): Promise<Property[]> => {
  try {
    // const params = {
    //   bk_obj_id: objId,
    //   ...(bizId && { bk_biz_id: bizId })
    // };

    const mockData = dynamicGroupCondition;
    const result: Property[] = [];

    if (mockData && Array.isArray(mockData)) {
      mockData.forEach((property: any) => {
        if (property.bk_obj_id === objId) {
          // 转换mock数据格式为PropertyModel格式
          const formattedProperty: Property = {
            ...property,
            option: Array.isArray(property.option)
              ? JSON.stringify(property.option)
              : property.option || '',
          };
          result.push(formattedProperty);
        }
      });
    }

    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
/**
 * 获取可用的模型列表
 * @returns Promise<string[]>
 */
export const getAvailableModels = async (): Promise<ObjectMainLine[]> => {
  try {
    // TODO: api
    // await axios.post('/find/objectmainline');
    return objectmainline;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
