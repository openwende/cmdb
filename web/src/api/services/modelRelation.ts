import axios from '../axiosInstance';
import {
  AvailableRelationsResponse,
  CreateModelAssociationPayload,
  ListModelAssociationsResponse,
  ModelAssociation,
  UpdateModelAssociationPayload,
} from '../types/modelRelation';

export interface RelationCapabilityConstraint {
  target_model_uid: string;
  association_uid: string;
  mapping: '1:1' | '1:N' | 'N:N';
  on_delete: 'cascade' | 'restrict' | 'set_null';
}

export interface RelationCapabilityTarget {
  association_uid: string;
  mapping?: '1:1' | '1:N' | 'N:N';
  on_delete?: 'cascade' | 'restrict' | 'set_null';
  target_model_uid?: string;
  target_model_name?: string;
  resource_id?: number;
  name?: string;
  model_uid?: string;
  relation_allowed?: boolean;
}

export interface RelationCapabilities {
  model_uid?: string;
  instance_key?: string;
  allowed_actions?: string[];
  constraints?: {
    associations?: RelationCapabilityConstraint[];
  } | null;
  candidate_targets?: RelationCapabilityTarget[];
  conflict_details?: Record<string, unknown>[];
  impact_summary?: Record<string, unknown>;
}

export interface RelationCapabilitiesResponse {
  code: number;
  data: RelationCapabilities;
  message?: string;
}

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

export const getModelRelationCapabilities = async (
  modelUID: string,
): Promise<RelationCapabilitiesResponse> => {
  return axios.get(`/v1/dynamic-models/${modelUID}/relation-capabilities`);
};

export const getInstanceRelationCapabilities = async (
  instanceKey: string,
): Promise<RelationCapabilitiesResponse> => {
  return axios.get(`/v1/instances/${encodeURIComponent(instanceKey)}/relation-capabilities`);
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
