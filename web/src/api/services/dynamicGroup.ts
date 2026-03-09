import axios from '../axiosInstance';
import {
  DynamicGroupItem,
  DynamicGroupMetaResponse,
  ListDynamicGroupsResponse,
  PreviewDynamicGroupResponse,
  PreviewDynamicGroupPayload,
  UpsertDynamicGroupPayload,
} from '../types/dynamicGroup';

export const listDynamicGroups = async (
  businessID: string,
  params?: { limit?: number; offset?: number; target?: string; keyword?: string },
): Promise<ListDynamicGroupsResponse> => {
  return axios.get(`/v1/businesses/${businessID}/dynamic-groups`, { params });
};

export const getDynamicGroupMeta = async (
  businessID: string,
): Promise<DynamicGroupMetaResponse> => {
  return axios.get(`/v1/businesses/${businessID}/dynamic-groups/meta`);
};

export const createDynamicGroup = async (
  businessID: string,
  payload: UpsertDynamicGroupPayload,
): Promise<{ code: number; data: DynamicGroupItem; message?: string }> => {
  return axios.post(`/v1/businesses/${businessID}/dynamic-groups`, payload);
};

export const updateDynamicGroup = async (
  businessID: string,
  groupID: string,
  payload: UpsertDynamicGroupPayload,
): Promise<{ code: number; data: DynamicGroupItem; message?: string }> => {
  return axios.put(`/v1/businesses/${businessID}/dynamic-groups/${groupID}`, payload);
};

export const deleteDynamicGroup = async (
  businessID: string,
  groupID: string,
): Promise<{ code: number; data: { message: string } }> => {
  return axios.delete(`/v1/businesses/${businessID}/dynamic-groups/${groupID}`);
};

export const previewDynamicGroup = async (
  businessID: string,
  payload: PreviewDynamicGroupPayload,
): Promise<PreviewDynamicGroupResponse> => {
  return axios.post(`/v1/businesses/${businessID}/dynamic-groups/preview`, payload);
};
