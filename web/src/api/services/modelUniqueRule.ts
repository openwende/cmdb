import axios from '../axiosInstance';
import {
  CreateModelUniqueRulePayload,
  ListModelUniqueRulesResponse,
  ModelUniqueRule,
  UpdateModelUniqueRulePayload,
} from '../types/modelUniqueRule';

export const listModelUniqueRules = async (
  modelUID: string,
): Promise<ListModelUniqueRulesResponse> => {
  return axios.get(`/v1/dynamic-models/${modelUID}/unique-rules`);
};

export const createModelUniqueRule = async (
  modelUID: string,
  payload: CreateModelUniqueRulePayload,
): Promise<{ code: number; data: ModelUniqueRule; message?: string }> => {
  return axios.post(`/v1/dynamic-models/${modelUID}/unique-rules`, payload);
};

export const updateModelUniqueRule = async (
  modelUID: string,
  id: number,
  payload: UpdateModelUniqueRulePayload,
): Promise<{ code: number; data: ModelUniqueRule; message?: string }> => {
  return axios.put(`/v1/dynamic-models/${modelUID}/unique-rules/${id}`, payload);
};

export const deleteModelUniqueRule = async (
  modelUID: string,
  id: number,
): Promise<{ code: number; data: { message: string } }> => {
  return axios.delete(`/v1/dynamic-models/${modelUID}/unique-rules/${id}`);
};
