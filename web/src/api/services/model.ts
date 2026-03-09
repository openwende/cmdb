import axios from '../axiosInstance';
import {
  CreateModelAttributePayload,
  CreateModelGroupPayload,
  CreateModelInstancePayload,
  CreateModelPayload,
  ModelAttribute,
  ModelGroup,
  ListModelInstancesParams,
  ListModelInstancesResponse,
  ModelDefinition,
  ModelDetailResponse,
  ModelInstance,
} from '../types/model';

const URLS = {
  models: '/v1/models',
};

export const listModels = (): Promise<ModelDefinition[]> => {
  return axios.get(URLS.models);
};

export const listModelGroups = (): Promise<ModelGroup[]> => {
  return axios.get(`${URLS.models}/groups`);
};

export const createModelGroup = (data: CreateModelGroupPayload): Promise<ModelGroup> => {
  return axios.post(`${URLS.models}/groups`, data);
};

export const getModelDetail = (name: string): Promise<ModelDetailResponse> => {
  return axios.get(`${URLS.models}/${name}`);
};

export const createModel = (data: CreateModelPayload): Promise<ModelDefinition> => {
  return axios.post(URLS.models, data);
};

export const createModelAttribute = (
  name: string,
  data: CreateModelAttributePayload,
): Promise<ModelAttribute> => {
  return axios.post(`${URLS.models}/${name}/attributes`, data);
};

export const listModelInstances = (
  name: string,
  params: ListModelInstancesParams,
): Promise<ListModelInstancesResponse> => {
  return axios.get(`${URLS.models}/${name}/instances`, { params });
};

export const createModelInstance = (
  name: string,
  data: CreateModelInstancePayload,
): Promise<ModelInstance> => {
  return axios.post(`${URLS.models}/${name}/instances`, data);
};
