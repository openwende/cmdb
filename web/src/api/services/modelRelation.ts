import axios from '../axiosInstance';
import {
  AvailableRelationsResponse,
  CreateModelAssociationPayload,
  ListModelAssociationsResponse,
  ModelAssociation,
  UpdateModelAssociationPayload,
} from '../types/modelRelation';

export const listModelAssociations = async (
  modelUID: string,
): Promise<ListModelAssociationsResponse> => {
  return axios.get(`/v1/dynamic-models/${modelUID}/associations`);
};

export const getAvailableRelations = async (
  modelUID: string,
): Promise<AvailableRelationsResponse> => {
  return axios.get(`/v1/dynamic-models/${modelUID}/available-relations`);
};

export const createModelAssociation = async (
  modelUID: string,
  payload: CreateModelAssociationPayload,
): Promise<{ code: number; data: ModelAssociation; message?: string }> => {
  return axios.post(`/v1/dynamic-models/${modelUID}/associations`, payload);
};

export const updateModelAssociation = async (
  modelUID: string,
  id: number,
  payload: UpdateModelAssociationPayload,
): Promise<{ code: number; data: ModelAssociation; message?: string }> => {
  return axios.put(`/v1/dynamic-models/${modelUID}/associations/${id}`, payload);
};

export const deleteModelAssociation = async (
  modelUID: string,
  id: number,
): Promise<{ code: number; data: { message: string } }> => {
  return axios.delete(`/v1/dynamic-models/${modelUID}/associations/${id}`);
};
