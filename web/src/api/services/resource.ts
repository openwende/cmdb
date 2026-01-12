import axios from '../axiosInstance';
import { ApiResponse } from '../types';
import { BusinessListParams, BusinessListResponse, BusinessDetail } from '../types/resource';

/**
 * @description API URL
 * Resource-related API endpoints
 */
const URLS = {
  /**
   * @module business
   * @description Business-related APIs
   */
  business: '/v1/businesses',
};

/**
 * @description Business-related API calls
 */
export const createBusiness = (data: BusinessDetail): Promise<ApiResponse> => {
  return axios.post(URLS.business, data);
};
export const getBusinessList = (
  params: BusinessListParams,
): Promise<ApiResponse<BusinessListResponse>> => {
  return axios.get(URLS.business, { params });
};
export const getBusinessDetail = (id: string): Promise<ApiResponse<BusinessDetail>> => {
  return axios.get(`${URLS.business}/${id}`);
};
export const updateBusiness = (id: string, data: Partial<BusinessDetail>): Promise<ApiResponse> => {
  return axios.put(`${URLS.business}/${id}`, data);
};
export const deleteBusiness = (id: string): Promise<ApiResponse> => {
  return axios.delete(`${URLS.business}/${id}`);
};
