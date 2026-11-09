export interface ModelUniqueRule {
  id: number;
  model_uid: string;
  name: string;
  is_default: boolean;
  is_auxiliary: boolean;
  enabled: boolean;
  ignore_if_all_empty: boolean;
  description?: string;
  fields: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ListModelUniqueRulesResponse {
  code: number;
  data: {
    items: ModelUniqueRule[];
  };
  message?: string;
}

export interface CreateModelUniqueRulePayload {
  name: string;
  is_default: boolean;
  is_auxiliary: boolean;
  enabled: boolean;
  ignore_if_all_empty: boolean;
  description?: string;
  fields: string[];
}

export interface UpdateModelUniqueRulePayload {
  name: string;
  is_auxiliary: boolean;
  enabled: boolean;
  ignore_if_all_empty: boolean;
  description?: string;
  fields: string[];
}
