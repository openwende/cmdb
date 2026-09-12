import axios from '../axiosInstance';
import { BusinessFormSchemaResponse } from '../types/businessCustomField';

export const getBusinessFormSchema = async (
  businessID: string,
  objectType: 'set' | 'module' | 'host',
): Promise<BusinessFormSchemaResponse> => {
  return axios.get(`/v1/businesses/${businessID}/form-schema/${objectType}`);
};
