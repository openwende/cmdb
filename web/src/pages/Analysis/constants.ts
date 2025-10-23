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
  COMMON_ACTIONS[0],
  COMMON_ACTIONS[1],
  { label: '归档', value: 'archive' },
  { label: '恢复', value: 'restore' },
];
export const HOST_ACTIONS = [
  ...COMMON_ACTIONS,
  { label: '分配到业务', value: 'assign_to_business' },
  { label: '归还到资源池', value: 'return_to_pool' },
  { label: '转移模块', value: 'transfer_module' },
];

// Create action value to label mapping from all actions
export const ACTION_LABELS = [
  ...COMMON_ACTIONS,
  ...BUSINESS_ACTIONS,
  ...HOST_ACTIONS,
].reduce((acc, action) => {
  acc[action.value] = action.label;
  return acc;
}, {} as Record<string, string>);

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

