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

export interface AggregateInstanceDetail {
  instance_key: string;
  model?: {
    model_uid: string;
    display_name?: string;
    icon?: string;
  };
  properties?: Record<string, unknown> | null;
  binding_context?: Record<string, unknown> | null;
  relation_summary?: {
    total?: number;
    items?: unknown[];
  } | null;
  history_summary?: {
    total?: number;
    items?: unknown[];
  } | null;
  allowed_actions?: string[];
}

export const getModelInstanceDetail = async (
  modelUID: string,
  instanceID: string | number,
): Promise<GetModelInstanceDetailResponse> => {
  return axios.get(`/v1/dynamic-models/${modelUID}/instances/${instanceID}`);
};

export const getAggregateInstanceDetail = async (
  instanceKey: string,
): Promise<{ code: number; data: AggregateInstanceDetail; message?: string }> => {
  return axios.get(`/v1/instances/${encodeURIComponent(instanceKey)}`);
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
