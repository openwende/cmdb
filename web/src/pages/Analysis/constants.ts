// Audit page constants
export const AUDIT_TAB_KEYS = {
  HOST: 'host',
  BUSINESS: 'business',
  RESOURCE: 'resource',
} as const;

// Operation target options for business tab
export const BUSINESS_OPERATION_TARGETS = [
  { label: '模块', value: 'module' },
  { label: '集群', value: 'cluster' },
  { label: '节点', value: 'node' },
  { label: '服务实例', value: 'service_instance' },
  { label: '动态分组', value: 'dynamic_group' },
];

// Operation target options for resource tab
export const RESOURCE_OPERATION_TARGETS = [
  { label: '业务', value: 'business' },
  { label: '项目', value: 'project' },
];

// Action options
export const COMMON_ACTIONS = [
  { label: '新增', value: 'create' },
  { label: '修改', value: 'update' },
  { label: '删除', value: 'delete' },
];

export const BUSINESS_ACTIONS = [
  { label: '新增', value: 'create' },
  { label: '修改', value: 'update' },
  { label: '归档', value: 'archive' },
  { label: '恢复', value: 'restore' },
];

// Host actions (for host tab)
export const HOST_ACTIONS = [
  { label: '新增', value: 'create' },
  { label: '修改', value: 'update' },
  { label: '删除', value: 'delete' },
  { label: '分配到业务', value: 'assign_to_business' },
  { label: '归还到资源池', value: 'return_to_pool' },
  { label: '转移模块', value: 'transfer_module' },
];

// Account filter options
export const ACCOUNT_FILTER_OPTIONS = [
  { label: '包含', value: 'include' },
  { label: '不包含', value: 'exclude' },
];

// Instance filter options
export const INSTANCE_FILTER_OPTIONS = [
  { label: '名称', value: 'name' },
  { label: 'ID', value: 'id' },
];

export type AuditTabKey = typeof AUDIT_TAB_KEYS[keyof typeof AUDIT_TAB_KEYS];
