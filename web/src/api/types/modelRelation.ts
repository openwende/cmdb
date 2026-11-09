export interface DynamicModelSummary {
  id: number;
  uid: string;
  name: string;
  description?: string;
  icon?: string;
  is_paused?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AssociationType {
  id: number;
  uid: string;
  name: string;
  source_to_dest_desc?: string;
  dest_to_source_desc?: string;
  is_builtin: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ModelAssociation {
  id: number;
  source_model_uid: string;
  target_model_uid: string;
  association_uid: string;
  mapping: '1:1' | '1:N' | 'N:N';
  on_delete: 'cascade' | 'restrict' | 'set_null';
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ListModelAssociationsResponse {
  code: number;
  data: {
    items: ModelAssociation[];
  };
  message?: string;
}

export interface AvailableRelationsResponse {
  code: number;
  data: {
    source_model: DynamicModelSummary;
    target_models: DynamicModelSummary[];
    association_types: AssociationType[];
    existing: ModelAssociation[];
  };
  message?: string;
}

export interface CreateModelAssociationPayload {
  target_model_uid: string;
  association_uid: string;
  mapping?: '1:1' | '1:N' | 'N:N';
  on_delete?: 'cascade' | 'restrict' | 'set_null';
  description?: string;
}

export interface UpdateModelAssociationPayload {
  target_model_uid?: string;
  association_uid?: string;
  mapping?: '1:1' | '1:N' | 'N:N';
  on_delete?: 'cascade' | 'restrict' | 'set_null';
  description?: string;
}
