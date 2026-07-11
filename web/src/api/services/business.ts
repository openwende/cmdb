import axios from '../axiosInstance';
import { Property, PropertyMap } from '../../pages/Business/Types';
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

export interface ImportHostFilePayload {
  file: File;
  directoryId?: number;
  uniqueKey?: string;
  importRelated?: boolean;
  relatedModelKeys?: Array<string | number>;
}

export interface ImportHostFileResponse {
  success?: boolean;
  message?: string;
  error?: string[];
  errors?: string[];
}

export interface HostImportTemplateParams {
  directoryId?: number;
}

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
  display_id: number;
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

export interface ProcessBindInfo {
  ip: string;
  port: string;
  protocol: string;
  enable: boolean;
}

export interface ProcessTemplateSummary {
  id: number;
  name: string;
  start_param_regex?: string;
  description?: string;
}

export interface ServiceCategoryRecord {
  id: number;
  name: string;
  parent_id: number | null;
  root_id: number;
  is_builtin: boolean;
  business_id?: number | null;
}

export interface ResourceDirectoryTreeNode {
  id: number;
  name: string;
  host_count?: number;
  children?: ResourceDirectoryTreeNode[];
}

export interface ProcessRecord {
  id: number;
  process_template_id: number;
  host_id: string;
  module_id: number;
  business_id: number;
  process_name: string;
  bind_info?: ProcessBindInfo[];
  start_command?: string;
  user?: string;
  work_path?: string;
  priority?: number | null;
  proc_num?: number | null;
  description?: string;
  created_at?: string;
  updated_at?: string;
  process_template?: ProcessTemplateSummary | null;
}

export interface ListProcessesResponse {
  code: number;
  data: {
    items: ProcessRecord[];
    pagination: {
      page: number;
      page_size: number;
      total: number;
    };
  };
  message?: string;
}

export const listProcesses = async (params: {
  page: number;
  page_size: number;
  business_id?: number;
  module_id?: number;
  host_id?: string;
  process_template_id?: number;
}): Promise<ListProcessesResponse> => {
  return axios.get('/v1/processes', { params });
};

export const getProcess = async (
  id: number,
): Promise<{ code: number; data: ProcessRecord; message?: string }> => {
  return axios.get(`/v1/processes/${id}`);
};

export const updateProcess = async (
  id: number,
  payload: {
    process_name?: string;
    bind_info?: ProcessBindInfo[];
    start_command?: string;
    user?: string;
    work_path?: string;
    priority?: number | null;
    proc_num?: number | null;
    description?: string;
  },
): Promise<{ code: number; data: ProcessRecord; message?: string }> => {
  return axios.put(`/v1/processes/${id}`, payload);
};

export const deleteProcess = async (id: number): Promise<{ code: number; message?: string }> => {
  return axios.delete(`/v1/processes/${id}`);
};

export const getModuleProcessSummary = async (
  moduleId: number,
): Promise<{
  code: number;
  data: {
    total: number;
    running: number;
    stopped: number;
    unknown: number;
  };
  message?: string;
}> => {
  return axios.get(`/v1/modules/${moduleId}/process-summary`);
};

export const listHostProcessesWithStatus = async (
  hostId: string,
): Promise<{ code: number; data: Array<ProcessRecord & { status?: Record<string, any> }> }> => {
  return axios.get(`/v1/hosts/${encodeURIComponent(hostId)}/processes`);
};

export interface TopologySetItem {
  id: number;
  business_id: number;
  name: string;
  description?: string;
  env_type?: string;
  sort_order?: number;
  is_default?: boolean;
}

export interface TopologyModuleItem {
  id: number;
  set_id: number;
  business_id: number;
  name: string;
  description?: string;
  service_type?: string;
  sort_order?: number;
  is_default?: boolean;
}

/** List sets under a business: GET /v1/topology/sets?business_id= */
export const listTopologySets = async (
  businessId: number | string,
): Promise<{ code: number; data: TopologySetItem[]; message?: string }> => {
  return axios.get('/v1/topology/sets', {
    params: { business_id: businessId },
  });
};

/** List modules under a business (or set): GET /v1/topology/modules?business_id= */
export const listTopologyModules = async (
  businessId: number | string,
): Promise<{ code: number; data: TopologyModuleItem[]; message?: string }> => {
  return axios.get('/v1/topology/modules', {
    params: { business_id: businessId },
  });
};

export const createTopologySet = async (payload: CreateTopologySetPayload) => {
  return axios.post('/v1/topology/sets', payload);
};

export const createTopologyModule = async (payload: CreateTopologyModulePayload) => {
  return axios.post('/v1/topology/modules', payload);
};

export const listServiceCategories = async (
  businessId: number,
): Promise<{ code: number; data: ServiceCategoryRecord[]; message?: string }> => {
  return axios.get('/v1/service-categories', {
    params: { business_id: businessId },
  });
};

export const getResourceDirectoryTree = async (): Promise<{
  code: number;
  data: ResourceDirectoryTreeNode[];
  message?: string;
}> => {
  return axios.get('/v1/resource-pool/directories/tree');
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
    service_category_id?: number;
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
  source_module_id?: number;
}) => {
  return axios.post('/v1/topology/hosts/transfer', payload);
};

export const transferTopologyHostsToPool = async (payload: { host_ids: string[] }) => {
  return axios.post('/v1/topology/hosts/transfer-to-pool', payload);
};

export const reclaimTopologyHostsToPool = async (payload: {
  host_ids: string[];
  directory_id: number;
  remark?: string;
}) => {
  return axios.post('/v1/resource-pool/hosts/reclaim', payload);
};

/**
 * 获取主机列表
 * @param params 查询参数
 * @returns Promise<any>
 */
export const getHostList = (params: any) => {
  return axios.get(hostListApi, params);
};

export const importHostFile = async ({
  file,
  directoryId,
  uniqueKey,
  importRelated,
  relatedModelKeys,
}: ImportHostFilePayload): Promise<ImportHostFileResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append(
    'params',
    JSON.stringify({
      directory_id: directoryId,
      unique_key: uniqueKey,
      import_related: Boolean(importRelated),
      related_model_keys: relatedModelKeys || [],
    }),
  );

  return axios.post('/v1/resource-pool/hosts/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const downloadHostImportTemplate = ({
  directoryId,
}: HostImportTemplateParams = {}): Promise<Blob> => {
  return axios.get('/v1/hosts/import/template', {
    params: directoryId == null ? undefined : { directory_id: directoryId },
    responseType: 'blob',
    headers: {
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
  }) as unknown as Promise<Blob>;
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
  injectId,
}: BatchSearchOptions): Promise<PropertyMap> => {
  try {
    const entries = await Promise.all(
      params.bk_obj_id.$in.map(async (objId) => [objId, await searchObjectAttribute(objId)] as const),
    );

    const result = entries.reduce<PropertyMap>((acc, [objId, properties]) => {
      acc[objId] = properties;
      return acc;
    }, {});

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
    const response: {
      code: number;
      data: Array<{
        id: number;
        model_uid: string;
        field_uid: string;
        field_name: string;
        field_type: string;
        group_name?: string | null;
        option?: unknown;
        placeholder?: string;
        unit?: string;
        description?: string;
        is_required?: boolean;
        is_unique?: boolean;
        is_read_only?: boolean;
        is_system?: boolean;
        is_api?: boolean;
      }>;
    } = await axios.get(`/v1/dynamic-models/${encodeURIComponent(objId)}/attributes`);

    return (response.data || []).map((property) => ({
      id: property.id,
      bk_obj_id: property.model_uid || objId,
      bk_property_id: property.field_uid,
      bk_property_name: property.field_name,
      bk_property_type: property.field_type,
      bk_property_group: property.group_name || '',
      bk_property_group_name: property.group_name || '',
      option: Array.isArray(property.option) ? JSON.stringify(property.option) : '',
      placeholder: property.placeholder || '',
      unit: property.unit || '',
      description: property.description || '',
      editable: !property.is_read_only,
      isonly: Boolean(property.is_unique),
      ispre: Boolean(property.is_system),
      isreadonly: Boolean(property.is_read_only),
      isrequired: Boolean(property.is_required),
      bk_issystem: Boolean(property.is_system),
      bk_isapi: Boolean(property.is_api),
    }));
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
    const response: {
      code: number;
      data: {
        items: Array<{
          uid: string;
          display_name: string;
          parent_model_uid: string | null;
          level: number;
        }>;
      };
    } = await axios.get('/v1/mainline/models');
    const items = [...(response.data?.items || [])].sort((left, right) => left.level - right.level);
    const itemMap = new Map(items.map((item) => [item.uid, item]));

    return items.map((item, index) => {
      const nextItem = items[index + 1];
      const parentItem = item.parent_model_uid ? itemMap.get(item.parent_model_uid) : undefined;
      return {
        bk_obj_id: item.uid,
        bk_obj_name: item.display_name,
        bk_supplier_account: '0',
        bk_next_obj: nextItem?.parent_model_uid === item.uid ? nextItem.uid : '',
        bk_next_name: nextItem?.parent_model_uid === item.uid ? nextItem.display_name : '',
        bk_pre_obj_id: parentItem?.uid || '',
        bk_pre_obj_name: parentItem?.display_name || '',
      };
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
};
