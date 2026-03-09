import { QUERY_OPERATOR } from './constants';

// Business topology
export enum CreateMode {
  Template = 'template',
  Direct = 'direct',
}
export interface CascaderOption {
  value: string;
  label: string;
  children?: CascaderOption[];
}
// Data type from api for tree
export interface RawNodeData {
  bk_inst_name?: string;
  bk_set_name?: string;
  bk_module_name?: string;
  bk_obj_id?: string;
  bk_inst_id?: number;
  bk_set_id?: number;
  bk_module_id?: number;
  bk_obj_name?: string;
  child?: RawNodeData[];
  module?: RawNodeData[];
}

/**
 * TypeScript definitions for the Host List tab
 */

// Dropdown menu type
export enum DropdownMenuType {
  Transfer = 'transfer',
  Append = 'append',
  Remove = 'remove',
  Copy = 'copy',
  More = 'more',
  Instance = 'instance',
}
// "Transfer To" dropdown menu item type
export enum TransferMenuItemType {
  idlePool = 'idlePool',
  businessModule = 'businessModule',
  hostPool = 'hostPool',
  otherBusiness = 'otherBusiness',
}
export type TransferHostType =
  | keyof typeof TransferMenuItemType
  | AppendMenuItemKey
  | RemoveMenuItemKey
  | 'addHost';
export enum AppendMenuItemKey {
  AppendToBusinessModule = 'AppendToBusinessModule',
}
export enum RemoveMenuItemKey {
  CurrentModule = 'currentModule',
}
// "Copy" dropdown menu item key
export enum CopyMenuItemKey {
  Id = 'id',
  IPv4 = 'ipv4',
  IPv6 = 'ipv6',
  CloudIdIPv4 = 'cloudIdIpv4',
  CloudIdIPv6 = 'cloudIdIpv6',
  CloudIdIPIPv4First = 'cloudIdIpIpv4First',
  CloudIdIPIPv6First = 'cloudIdIpIpv6First',
  CloudRegion = 'cloudRegion',
  ModuleName = 'moduleName',
  SetName = 'setName',
}
export enum MoreMenuItemKey {
  ExportSelected = 'exportSelected',
  ExportAll = 'exportAll',
  ImportExcel = 'importExcel',
}
export enum InstanceMenuItemKey {
  BatchDelete = 'batchDelete',
  CopyIP = 'copyIP',
  EditLabel = 'editLabel',
}
// The type of the tail element in the tree node
export enum TailEleType {
  All = 'all',
  Count = 'count',
  None = 'none',
}
export interface TreeData {
  title: React.ReactNode;
  key: string;
  type: string;
  objName?: string;
  children?: TreeData[];
  parentPath?: string[];
  nodeId?: string;
  backendType?: string;
  icon?: string;
  isLeaf?: boolean;
  expandable?: boolean;
  extra?: Record<string, any>;
}
export enum TopoTreeNodeType {
  Biz = 'biz',
  Set = 'set',
  Module = 'module',
  Idle = 'idle',
}
export interface TransferHostItem {
  id: React.Key;
  ip: string;
  inIdlePool?: boolean;
  cloudInfo?: string;
}

/**
 * Dynamic Group Types
 */
export interface DynamicGroupProperty {
  id: number;
  bk_obj_id: string;
  bk_property_id: string;
  bk_property_name: string;
  bk_property_type: string;
  bk_property_group: string;
  bk_property_group_name: string;
  option?: any;
  placeholder?: string;
  unit?: string;
  description?: string;
  editable: boolean;
  ispre: boolean;
  isrequired: boolean;
  isreadonly: boolean;
  isonly: boolean;
  bk_issystem: boolean;
  bk_isapi: boolean;
  ismultiple?: boolean;
}
export interface DynamicGroupCondition {
  field: string;
  operator: string;
  value: any;
}
export interface DynamicGroupConditionGroup {
  bk_obj_id: string;
  condition: DynamicGroupCondition[];
  time_condition?: {
    oper: string;
    rules: {
      field: string;
      start: string;
      end: string;
    }[];
  };
}
export interface DynamicGroupFormData {
  name: string;
  bk_obj_id: string;
  bk_biz_id?: number;
  condition: DynamicGroupConditionGroup[];
  variable_condition?: DynamicGroupConditionGroup[];
}
export interface PropertyCondition {
  id: string;
  property: DynamicGroupProperty;
  operator: string;
  value: any;
  conditionType: 'condition' | 'variable_condition';
  isVariable?: boolean;
}
export interface DynamicGroupPreviewData {
  count: number;
  info: any[];
}
export interface ObjectMainLine {
  bk_obj_id: string;
  bk_obj_name: string;
  bk_supplier_account: string;
  bk_next_obj: string;
  bk_next_name: string;
  bk_pre_obj_id: string;
  bk_pre_obj_name: string;
}
export enum ConditionType {
  IMMUTABLE = 'condition',
  VARIABLE = 'varCondition',
}
export interface Property {
  id: number;
  bk_obj_id: string;
  bk_property_id: string;
  bk_property_name: string;
  bk_property_type: string;
  bk_property_group: string | null;
  bk_supplier_account?: string;
  creator?: string;
  description?: string;
  editable?: boolean;
  isonly?: boolean;
  ispre?: boolean;
  isreadonly?: boolean;
  isrequired?: boolean;
  option?: string;
  unit?: string;
  placeholder?: string;
  bk_asst_obj_id?: string;
  bk_biz_id?: number;
  create_time?: string;
  last_time?: string;
  bk_property_group_name?: string;
  bk_property_index?: number;
  _is_inject_?: boolean;
  bk_isapi?: boolean;
  bk_issystem?: boolean;
  conditionType?: ConditionType;
}
export interface PropertyMap {
  [objId: string]: Property[];
}
export type OperatorType = (typeof QUERY_OPERATOR)[keyof typeof QUERY_OPERATOR];
export interface Condition {
  property: Property;
  operator: OperatorType;
  value: any;
}
