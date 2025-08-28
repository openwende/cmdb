import { CopyMenuItemKey, TransferMenuItemType } from "./Types";

/**
 * "Copy" dropdown menu items
 */
export const hostCopyMenuItems = [
  { key: CopyMenuItemKey.Id, label: 'ID' },
  { key: CopyMenuItemKey.IPv4, label: '内网IPv4' },
  { key: CopyMenuItemKey.IPv6, label: '内网IPv6' },
  {
    key: 'cloud_id_ip_group',
    label: '管控区域ID:IP',
    children: [
      { key: CopyMenuItemKey.CloudIdIPv4, label: '管控区域ID:IPv4' },
      { key: CopyMenuItemKey.CloudIdIPv6, label: '管控区域ID:IPv6' },
      { key: CopyMenuItemKey.CloudIdIPIPv4First, label: '管控区域ID:IP(IPv4优先)' },
      { key: CopyMenuItemKey.CloudIdIPIPv6First, label: '管控区域ID:IP(IPv6优先)' },
    ]
  },
  { key: CopyMenuItemKey.CloudRegion, label: '管控区域' },
  { key: CopyMenuItemKey.ModuleName, label: '模块名' },
  { key: CopyMenuItemKey.SetName, label: '集群名' },
] as const;

/**
 * Flattened list of copy keys, for easy inclusion checks
 */
export const hostCopyKeys: CopyMenuItemKey[] = hostCopyMenuItems.flatMap((item: any) =>
  item.children ? item.children.map((c: any) => c.key) : item.key
) as CopyMenuItemKey[];

/**
 * "Move to" dropdown menu items
 */
export const transferBaseMenuItems = [
  { key: TransferMenuItemType.idlePool, label: '空闲机池' },
  { key: TransferMenuItemType.businessModule, label: '业务模块' },
  { key: TransferMenuItemType.hostPool, label: '主机池' },
  { key: TransferMenuItemType.otherBusiness, label: '其他业务' },
] as const;

/**
 * Dynamic Group Constants
 */
export const QUERY_OPERATOR = Object.freeze({
  EQ: '$eq',          // Equals
  NE: '$ne',          // Not Equals
  IN: '$in',          // In
  NIN: '$nin',        // Not In
  LT: '$lt',          // Less Than
  GT: '$gt',          // Greater Than
  LTE: '$lte',        // Less Than or Equals
  GTE: '$gte',        // Greater Than or Equals
  RANGE: '$range',    // Range (constructed on the front-end, split into gte, lte on the back-end)
  LIKE: '$regex',     // Fuzzy Match
  CONTAINS: '$contains',     // Contains (case-insensitive)
  CONTAINS_CS: '$contains_s' // Contains (case-sensitive)
});
export const QUERY_OPERATOR_SYMBOL = {
  [QUERY_OPERATOR.EQ]: '=',
  [QUERY_OPERATOR.NE]: '≠',
  [QUERY_OPERATOR.IN]: 'in',
  [QUERY_OPERATOR.NIN]: 'not in',
  [QUERY_OPERATOR.GT]: '>',
  [QUERY_OPERATOR.LT]: '<',
  [QUERY_OPERATOR.GTE]: '≥',
  [QUERY_OPERATOR.LTE]: '≤',
  [QUERY_OPERATOR.LIKE]: 'like',
  [QUERY_OPERATOR.RANGE]: '≤ ≥',
  [QUERY_OPERATOR.CONTAINS]: 'contains',
  [QUERY_OPERATOR.CONTAINS_CS]: 'contains(CS)',
}
export const QUERY_OPERATOR_DESC = {
  [QUERY_OPERATOR.EQ]: '等于',
  [QUERY_OPERATOR.NE]: '不等于',
  [QUERY_OPERATOR.LT]: '小于',
  [QUERY_OPERATOR.GT]: '大于',
  [QUERY_OPERATOR.IN]: '精确',
  [QUERY_OPERATOR.NIN]: '精确',
  [QUERY_OPERATOR.RANGE]: '范围',
  [QUERY_OPERATOR.LTE]: '小于等于',
  [QUERY_OPERATOR.GTE]: '大于等于',
  [QUERY_OPERATOR.LIKE]: '模糊',
  [QUERY_OPERATOR.CONTAINS]: '匹配(大小写不敏感)',
  [QUERY_OPERATOR.CONTAINS_CS]: '匹配(大小写敏感)'
}
export const enum PROPERTY_TYPES {
  SINGLECHAR = 'singlechar',
  INT = 'int',
  FLOAT = 'float',
  ENUM = 'enum',
  DATE = 'date',
  TIME = 'time',
  LONGCHAR = 'longchar',
  OBJUSER = 'objuser',
  TIMEZONE = 'timezone',
  BOOL = 'bool',
  LIST = 'list',
  ORGANIZATION = 'organization',
  ENUMMULTI = 'enummulti',
  ENUMQUOTE = 'enumquote',
  MAP = 'map',
  OBJECT = 'object',
  ARRAY = 'array',
  TABLE = 'table',
  SERVICE_TEMPLATE = 'service-template',
  TOPOLOGY = 'topology',
  FOREIGNKEY = 'foreignkey',
  INNER_TABLE = 'innertable',
  OBJNAME = 'objname'
}
export enum BUILTIN_MODELS {
  BUSINESS_SET = 'bk_biz_set_obj',
  BUSINESS = 'biz',
  HOST = 'host',
  SET = 'set',
  PROJECT = 'bk_project'
}
export const BUILTIN_MODEL_PROPERTY_KEYS = Object.freeze({
  [BUILTIN_MODELS.BUSINESS_SET]: {
    ID: 'bk_biz_set_id',
    NAME: 'bk_biz_set_name'
  },
  [BUILTIN_MODELS.BUSINESS]: {
    ID: 'bk_biz_id',
    NAME: 'bk_biz_name'
  },
  [BUILTIN_MODELS.HOST]: {
    ID: 'bk_host_id',
    NAME: 'bk_host_name'
  },
  [BUILTIN_MODELS.PROJECT]: {
    ID: 'id',
    NAME: 'bk_project_name'
  }
})
export const availableModelIds = Object.freeze(['host', 'module', 'set'])
export const requestConfig = Object.freeze({
  mainline: Symbol('mainline'),
  property: Symbol('property'),
  details: Symbol('details'),
  create: Symbol('create'),
  update: Symbol('update')
})
const { EQ, NE, IN, NIN, LTE, GTE, RANGE, LIKE } = QUERY_OPERATOR;
export const DEFAULT_CONDITIONS_DATA = {
  [PROPERTY_TYPES.BOOL]: { operator: EQ, value: '' },
  [PROPERTY_TYPES.DATE]: { operator: RANGE, value: [] },
  [PROPERTY_TYPES.FLOAT]: { operator: EQ, value: '' },
  [PROPERTY_TYPES.INT]: { operator: EQ, value: '' },
  [PROPERTY_TYPES.TIME]: { operator: RANGE, value: [] },
  [PROPERTY_TYPES.SERVICE_TEMPLATE]: { operator: IN, value: [] }
};
export const DEFAULT_OPERATOR_MAP = {
  [PROPERTY_TYPES.BOOL]: [EQ, NE],
  [PROPERTY_TYPES.DATE]: [GTE, LTE],
  [PROPERTY_TYPES.ENUM]: [IN, NIN],
  [PROPERTY_TYPES.ENUMMULTI]: [IN, NIN],
  [PROPERTY_TYPES.ENUMQUOTE]: [IN, NIN],
  [PROPERTY_TYPES.FLOAT]: [EQ, NE, GTE, LTE, RANGE],
  [PROPERTY_TYPES.INT]: [EQ, NE, GTE, LTE, RANGE],
  [PROPERTY_TYPES.LIST]: [IN, NIN],
  [PROPERTY_TYPES.LONGCHAR]: [IN, NIN, LIKE],
  [PROPERTY_TYPES.OBJUSER]: [IN, NIN],
  [PROPERTY_TYPES.ORGANIZATION]: [IN, NIN],
  [PROPERTY_TYPES.SINGLECHAR]: [IN, NIN, LIKE],
  [PROPERTY_TYPES.TIME]: [GTE, LTE],
  [PROPERTY_TYPES.TIMEZONE]: [IN, NIN],
  [PROPERTY_TYPES.FOREIGNKEY]: [IN, NIN],
  [PROPERTY_TYPES.TABLE]: [IN, NIN],
  [PROPERTY_TYPES.SERVICE_TEMPLATE]: [IN],
  [PROPERTY_TYPES.ARRAY]: [IN, NIN, LIKE],
  [PROPERTY_TYPES.OBJECT]: [IN, NIN, LIKE],
  [PROPERTY_TYPES.MAP]: [IN, NIN]
};
