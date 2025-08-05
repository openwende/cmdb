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
export const DYNAMIC_GROUP_CONDITION_TYPES = {
    VARIABLE: 'variable_condition',
    LOCKED: 'condition'
} as const;

export const DYNAMIC_GROUP_OPERATORS = {
    EQ: '$eq',
    NE: '$ne',
    IN: '$in',
    NIN: '$nin',
    LIKE: '$like',
    REGEX: '$regex',
    RANGE: '$range',
    GTE: '$gte',
    LTE: '$lte'
} as const;

export const DYNAMIC_GROUP_FIELD_TYPES = {
    SINGLECHAR: 'singlechar',
    LONGCHAR: 'longchar',
    INT: 'int',
    FLOAT: 'float',
    ENUM: 'enum',
    ENUMMULTI: 'enummulti',
    BOOL: 'bool',
    DATE: 'date',
    TIME: 'time',
    USER: 'objuser',
    SERVICE_TEMPLATE: 'service-template'
} as const;

export const DYNAMIC_GROUP_OBJECT_TYPES = {
    HOST: 'host',
    MODULE: 'module',
    SET: 'set'
} as const;

export const OPERATOR_LABELS = {
    [DYNAMIC_GROUP_OPERATORS.EQ]: '等于',
    [DYNAMIC_GROUP_OPERATORS.NE]: '不等于',
    [DYNAMIC_GROUP_OPERATORS.IN]: '包含',
    [DYNAMIC_GROUP_OPERATORS.NIN]: '不包含',
    [DYNAMIC_GROUP_OPERATORS.LIKE]: '包含',
    [DYNAMIC_GROUP_OPERATORS.REGEX]: '正则',
    [DYNAMIC_GROUP_OPERATORS.RANGE]: '范围',
    [DYNAMIC_GROUP_OPERATORS.GTE]: '大于等于',
    [DYNAMIC_GROUP_OPERATORS.LTE]: '小于等于'
} as const;