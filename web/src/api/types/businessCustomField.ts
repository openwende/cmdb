export interface BusinessFormSchemaField {
  name: string;
  display_name: string;
  field_type: string;
  is_required: boolean;
  is_unique: boolean;
  is_editable: boolean;
  is_system: boolean;
  sort_order: number;
  placeholder?: string;
  default_value?: string | number | boolean;
  options?: Record<string, unknown>;
  validators?: Record<string, unknown>;
}

export interface BusinessFormSchemaGroup {
  group_name: string;
  collapsed_by_default: boolean;
  fields: BusinessFormSchemaField[];
}

export interface BusinessFormSchemaResponse {
  code: number;
  data: {
    object_type: string;
    builtin_fields: BusinessFormSchemaField[];
    business_custom_groups: BusinessFormSchemaGroup[];
    merged_schema: BusinessFormSchemaGroup[];
  };
  message?: string;
}
