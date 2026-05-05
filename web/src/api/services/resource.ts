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
export const updateBusiness = (
  id: number,
  data: UpdateBusinessRequest,
): Promise<ApiResponse> => {
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

export const batchCreateHosts = (
  hosts: BatchCreateHostItem[],
): Promise<BatchCreateHostsResult> => {
  return axios.post(URLS.hostsBatch, {
    hosts,
    skip_errors: true,
    use_default_cloud_area: true,
  });
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

