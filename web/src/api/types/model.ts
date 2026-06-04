export interface ModelDefinition {
  id: string;
  name: string;
  display_name: string;
  classification: string;
  group_id?: string | null;
  group_name?: string;
  group_display_name?: string;
  icon: string;
  is_builtin: boolean;
  is_mainline: boolean;
  mainline_scope: string;
  mainline_level?: number | null;
  is_topology_builtin: boolean;
  mainline_parent_model_id?: string | null;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DynamicModelDefinition {
  id: number;
  uid: string;
  name: string;
  description?: string;
  icon?: string;
  is_paused?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ModelAttribute {
  id: string;
  model_id: string;
  name: string;
  display_name: string;
  field_type: string;
  is_required: boolean;
  is_unique: boolean;
  is_editable: boolean;
  is_system: boolean;
  sort_order: number;
  options?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
}

export interface ModelAttributeOptions {
  enum_values?: string[];
  default?: string | number | boolean;
  placeholder?: string;
  help_text?: string;
  preview?: string;
}

export interface ModelDetailResponse {
  model: ModelDefinition;
  attributes: ModelAttribute[];
}

export interface CreateModelPayload {
  name: string;
  display_name: string;
  classification: string;
  group_id?: string;
  icon?: string;
  description?: string;
  is_mainline: boolean;
  mainline_scope?: string;
  mainline_level?: number;
  mainline_parent_model?: string;
}

export interface ModelGroup {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  sort_order: number;
  is_builtin: boolean;
  model_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateModelGroupPayload {
  name: string;
  display_name: string;
  description?: string;
  sort_order: number;
}

export interface CreateModelAttributePayload {
  name: string;
  display_name: string;
  field_type: string;
  is_required: boolean;
  is_unique: boolean;
  is_editable?: boolean;
  sort_order: number;
  options: ModelAttributeOptions;
}

export interface ModelInstance {
  id: string;
  model_id: string;
  tenant_id: string;
  business_id?: number | null;
  properties: Record<string, unknown>;
  path?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  model_name?: string;
}

export interface ListModelInstancesParams {
  page: number;
  page_size: number;
}

export interface ListModelInstancesResponse {
  // R8：后端收口为统一分页 envelope（旧为 {data:[],meta}）。
  code: number;
  data: {
    items: ModelInstance[];
    pagination: { page: number; page_size: number; total: number };
  };
}

export interface CreateModelInstancePayload {
  properties: Record<string, unknown>;
  business_id?: number;
  mainline_parent_ref_id?: string;
}
