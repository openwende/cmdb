export enum DynamicGroupConditionType {
  IMMUTABLE = 'condition',
  VARIABLE = 'varCondition'
}

export interface Property {
  id: string;
  bk_obj_id: string;
  bk_property_id: string;
  bk_property_name: string;
  bk_property_type: string;
  bk_property_index?: number;
  option?: any[];
  placeholder?: string;
  conditionType?: DynamicGroupConditionType;
  isonly?: boolean;
  ispre?: boolean;
  bk_isapi?: boolean;
  bk_issystem?: boolean;
  isreadonly?: boolean;
  editable?: boolean;
  bk_property_group?: string | null;
  _is_inject_?: boolean;
}

export interface DynamicGroupProperty {
  id: string;
  bk_obj_id: string;
  bk_property_id: string;
  bk_property_name: string;
  bk_property_type: string;
  bk_property_group?: string;
  bk_property_group_name?: string;
  option?: any[];
  placeholder?: string;
  unit?: string;
  description?: string;
  editable?: boolean;
  ispre?: boolean;
  isrequired?: boolean;
  isreadonly?: boolean;
  isonly?: boolean;
  bk_issystem?: boolean;
  bk_isapi?: boolean;
  ismultiple?: boolean;
}

export interface Condition {
  property: Property;
  operator: string;
  value: any;
}

export interface Model {
  bk_obj_id: string;
  bk_obj_name: string;
  desc?: string;
}

export interface DynamicGroupFormData {
  name: string;
  bk_obj_id: string;
}

export interface DynamicGroupDetails {
  id?: string | number;
  name: string;
  bk_obj_id: string;
  info: {
    [DynamicGroupConditionType.IMMUTABLE]: any[];
    [DynamicGroupConditionType.VARIABLE]: any[];
  };
}

export const DYNAMIC_GROUP_COND_NAMES = {
  [DynamicGroupConditionType.IMMUTABLE]: '锁定条件',
  [DynamicGroupConditionType.VARIABLE]: '可变条件'
};

export const BUILTIN_MODELS = {
  HOST: 'host',
  SET: 'set',
  MODULE: 'module'
};

export const QUERY_OPERATOR = {
  EQ: '$eq',
  NE: '$ne',
  IN: '$in',
  NIN: '$nin',
  LIKE: '$like',
  CONTAINS: '$contains',
  CONTAINS_CS: '$contains_cs',
  GTE: '$gte',
  LTE: '$lte',
  RANGE: '$range'
};
