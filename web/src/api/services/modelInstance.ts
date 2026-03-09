import axios from '../axiosInstance';
import {
  CreateInstanceRelationPayload,
  GetModelInstanceDetailResponse,
  GetModelInstanceTopologyParams,
  GetModelInstanceTopologyResponse,
  ListModelInstanceHistoryParams,
  ListModelInstanceHistoryResponse,
  ListModelInstanceRelationsParams,
  ListModelInstanceRelationsResponse,
} from '../types/modelInstance';

export const getModelInstanceDetail = async (
  modelUID: string,
  instanceID: string | number,
): Promise<GetModelInstanceDetailResponse> => {
  return axios.get(`/v1/dynamic-models/${modelUID}/instances/${instanceID}`);
};

export const listModelInstanceRelations = async (
  modelUID: string,
  instanceID: string | number,
  params?: ListModelInstanceRelationsParams,
): Promise<ListModelInstanceRelationsResponse> => {
  return axios.get(`/v1/dynamic-models/${modelUID}/instances/${instanceID}/relations`, { params });
};

export const createModelInstanceRelation = async (
  payload: CreateInstanceRelationPayload,
): Promise<{ code: number; data: { message: string } }> => {
  return axios.post('/v1/dynamic-models/relations', payload);
};

export const deleteModelInstanceRelation = async (
  relationID: number,
): Promise<{ code: number; data: { message: string } }> => {
  return axios.delete(`/v1/dynamic-models/relations/${relationID}`);
};

export const getModelInstanceTopology = async (
  modelUID: string,
  instanceID: string | number,
  params?: GetModelInstanceTopologyParams,
): Promise<GetModelInstanceTopologyResponse> => {
  return axios.get(`/v1/dynamic-models/${modelUID}/instances/${instanceID}/topology`, { params });
};

export const listModelInstanceHistory = async (
  modelUID: string,
  instanceID: string | number,
  params: ListModelInstanceHistoryParams,
): Promise<ListModelInstanceHistoryResponse> => {
  return axios.get(`/v1/dynamic-models/${modelUID}/instances/${instanceID}/history`, { params });
};
