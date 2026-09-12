import axios from '../axiosInstance';
import {
  CreateMainlineModelPayload,
  CreateMainlineNodePayload,
  GetMainlineModelsResponse,
  MainlineModelResponse,
  GetMainlineTreeRequest,
  GetMainlineTreeResponse,
  GetTopologySettingsResponse,
  MainlineNodeResponse,
  MoveMainlineNodePayload,
  UpdateMainlineModelPayload,
  UpdateMainlineNodePayload,
} from '../types/mainline';

export const getMainlineModels = async (): Promise<GetMainlineModelsResponse> => {
  return axios.get('/v1/mainline/models');
};

export const createMainlineModel = async (
  payload: CreateMainlineModelPayload,
): Promise<MainlineModelResponse> => {
  return axios.post('/v1/mainline/models', payload);
};

export const updateMainlineModel = async (
  uid: string,
  payload: UpdateMainlineModelPayload,
): Promise<MainlineModelResponse> => {
  return axios.put(`/v1/mainline/models/${uid}`, payload);
};

export const getMainlineTopologyTree = async (
  params?: GetMainlineTreeRequest,
): Promise<GetMainlineTreeResponse> => {
  return axios.get('/v1/mainline/tree', { params });
};

export const getTopologySettings = async (): Promise<GetTopologySettingsResponse> => {
  return axios.get('/v1/mainline/settings/topology');
};

export const createMainlineNode = async (
  payload: CreateMainlineNodePayload,
): Promise<MainlineNodeResponse> => {
  return axios.post('/v1/mainline/nodes', payload);
};

export const updateMainlineNode = async (
  modelUID: string,
  refID: string,
  payload: UpdateMainlineNodePayload,
): Promise<MainlineNodeResponse> => {
  return axios.put(`/v1/mainline/nodes/${modelUID}/${refID}`, payload);
};

export const deleteMainlineNode = async (
  modelUID: string,
  refID: string,
): Promise<{ code: number; data: { message: string } }> => {
  return axios.delete(`/v1/mainline/nodes/${modelUID}/${refID}`);
};

export const moveMainlineNode = async (
  modelUID: string,
  refID: string,
  payload: MoveMainlineNodePayload,
): Promise<MainlineNodeResponse> => {
  return axios.post(`/v1/mainline/nodes/${modelUID}/${refID}/move`, payload);
};
