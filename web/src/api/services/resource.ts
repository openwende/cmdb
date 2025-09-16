import axios from '../axiosInstance';
import { BusinessListParams, BusinessListResponse, CreateBusinessParams } from '../types/resource';

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
export const createBusiness = (data: CreateBusinessParams) => {
    return axios.post(URLS.business, data);
}
export const getBusinessList = (params: BusinessListParams): Promise<BusinessListResponse> => {
    return axios.get(URLS.business, { params });
};
export const getBusinessDetail = (id: string) => {
    return axios.get(`${URLS.business}/${id}`);
}
export const updateBusiness = (id: string, data: Partial<CreateBusinessParams>) => {
    return axios.put(`${URLS.business}/${id}`, data);
}
export const deleteBusiness = (id: string) => {
    return axios.delete(`${URLS.business}/${id}`);
}