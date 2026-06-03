export interface DynamicGroupCondition {
  field: string;
  operator: string;
  value: any;
}

export interface DynamicGroupTimeConditionRule {
  field: string;
  start: string;
  end: string;
}

export interface DynamicGroupTimeCondition {
  oper: string;
  rules: DynamicGroupTimeConditionRule[];
}

export interface DynamicGroupConditionGroup {
  bk_obj_id: string;
  condition: DynamicGroupCondition[];
  time_condition?: DynamicGroupTimeCondition;
}

export interface DynamicGroupRuleInfo {
  condition: DynamicGroupConditionGroup[];
}

export interface DynamicGroupItem {
  id: string;
  business_id: number;
  bk_obj_id: string;
  target_model_uid: string;
  name: string;
  info: DynamicGroupRuleInfo;
  description?: string;
  create_user: string;
  modify_user: string;
  create_time: string;
  last_time: string;
  last_preview_count?: number;
}

export interface DynamicGroupProperty {
  id: number;
  bk_obj_id: string;
  bk_property_id: string;
  bk_property_name: string;
  bk_property_type: string;
  bk_property_group: string | null;
  bk_property_group_name?: string;
  option?: string;
  placeholder?: string;
  description?: string;
  editable?: boolean;
  ispre?: boolean;
  isrequired?: boolean;
  isreadonly?: boolean;
  isonly?: boolean;
  bk_issystem?: boolean;
  bk_isapi?: boolean;
}

export interface DynamicGroupObjectMainline {
  bk_obj_id: string;
  bk_obj_name: string;
  bk_supplier_account: string;
  bk_next_obj: string;
  bk_next_name: string;
  bk_pre_obj_id: string;
  bk_pre_obj_name: string;
}

export interface DynamicGroupPreviewItem {
  id: string;
  internalIPv4: string;
  region: string;
  cloudVendor: string;
  cloudVendorID: string;
  cloudBusiness: string;
  createTime: string;
  creator: string;
}

export interface ListDynamicGroupsResponse {
  code: number;
  data: {
    items: DynamicGroupItem[];
    total: number;
    limit: number;
    offset: number;
  };
}

export interface DynamicGroupMetaResponse {
  code: number;
  data: {
    targets: string[];
    models: DynamicGroupObjectMainline[];
    property_map: Record<string, DynamicGroupProperty[]>;
    fields?: Record<string, DynamicGroupProperty[]>;
  };
}

export interface PreviewDynamicGroupResponse {
  code: number;
  data: {
    items: DynamicGroupPreviewItem[];
    total: number;
  };
}

export interface UpsertDynamicGroupPayload {
  name: string;
  bk_obj_id: string;
  target_model_uid?: string;
  condition: DynamicGroupConditionGroup[];
  description?: string;
}

export interface PreviewDynamicGroupPayload {
  bk_obj_id: string;
  target_model_uid?: string;
  condition: DynamicGroupConditionGroup[];
  limit?: number;
}
