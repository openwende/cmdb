import { GetTopologyTreeRequest, GetTopologyTreeResponse } from './topology';

export interface MainlineModel {
  uid: string;
  display_name: string;
  classification: string;
  icon?: string;
  description?: string;
  scope: 'none' | 'business' | 'global';
  level?: number;
  parent_model_uid?: string;
  is_builtin: boolean;
  is_topology_builtin: boolean;
}

export interface GetMainlineModelsResponse {
  code: number;
  data: {
    items: MainlineModel[];
  };
  message?: string;
}

export interface MainlineModelResponse {
  code: number;
  data: MainlineModel;
  message?: string;
}

export interface CreateMainlineModelPayload {
  uid: string;
  display_name: string;
  classification?: string;
  icon?: string;
  description?: string;
  scope?: 'none' | 'business' | 'global';
  level?: number;
  parent_model_uid?: string;
}

export interface UpdateMainlineModelPayload {
  display_name?: string;
  classification?: string;
  icon?: string;
  description?: string;
  scope?: 'none' | 'business' | 'global';
  level?: number;
  parent_model_uid?: string;
}

export interface TopologySettings {
  max_topology_level: number;
  idle_set_name: string;
  idle_module_name: string;
}

export interface GetTopologySettingsResponse {
  code: number;
  data: TopologySettings;
  message?: string;
}

export interface CreateMainlineNodePayload {
  business_id: string;
  model_uid: string;
  parent_model_uid?: string;
  parent_ref_id?: string;
  name: string;
  sort_order?: number;
  properties?: Record<string, unknown>;
}

export interface UpdateMainlineNodePayload {
  name?: string;
  sort_order?: number;
  properties?: Record<string, unknown>;
}

export interface MoveMainlineNodePayload {
  target_parent_model_uid: string;
  target_parent_ref_id: string;
}

export interface MainlineNodeResponse {
  code: number;
  data: {
    id: number;
    business_id: string;
    parent_id?: number | null;
    model_name: string;
    ref_id: string;
    name: string;
    path: string;
    level: number;
    sort_order: number;
    is_default: boolean;
    extra?: Record<string, unknown>;
    created_at?: string;
    updated_at?: string;
  };
  message?: string;
}

export type GetMainlineTreeRequest = GetTopologyTreeRequest;
export type GetMainlineTreeResponse = GetTopologyTreeResponse;
