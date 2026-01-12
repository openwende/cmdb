// Audit page constants
export const AUDIT_TAB_KEYS = {
  HOST: 'host',
  BUSINESS: 'business',
  RESOURCE: 'resource',
} as const;

// Operation target options for business tab - returns array with translated labels
export const getBusinessOperationTargets = (t: (key: string) => string) => [
  { label: t('analysis.audit.operationTargets.module'), value: 'module' },
  { label: t('analysis.audit.operationTargets.cluster'), value: 'cluster' },
  { label: t('analysis.audit.operationTargets.node'), value: 'node' },
  { label: t('analysis.audit.operationTargets.serviceInstance'), value: 'service_instance' },
  { label: t('analysis.audit.operationTargets.dynamicGroup'), value: 'dynamic_group' },
];

// Operation target options for resource tab - returns array with translated labels
export const getResourceOperationTargets = (t: (key: string) => string) => [
  { label: t('analysis.audit.operationTargets.business'), value: 'business' },
  { label: t('analysis.audit.operationTargets.project'), value: 'project' },
];

// Action options - returns array with translated labels
export const getCommonActions = (t: (key: string) => string) => [
  { label: t('analysis.audit.actions.create'), value: 'create' },
  { label: t('analysis.audit.actions.update'), value: 'update' },
  { label: t('analysis.audit.actions.delete'), value: 'delete' },
];
export const getBusinessActions = (t: (key: string) => string) => {
  const common = getCommonActions(t);
  return [
    common[0],
    common[1],
    { label: t('analysis.audit.actions.archive'), value: 'archive' },
    { label: t('analysis.audit.actions.restore'), value: 'restore' },
  ];
};
export const getHostActions = (t: (key: string) => string) => {
  const common = getCommonActions(t);
  return [
    ...common,
    { label: t('analysis.audit.actions.assignToBusiness'), value: 'assign_to_business' },
    { label: t('analysis.audit.actions.returnToPool'), value: 'return_to_pool' },
    { label: t('analysis.audit.actions.transferModule'), value: 'transfer_module' },
  ];
};

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

// Account filter options - returns array with translated labels
export const getAccountFilterOptions = (t: (key: string) => string) => [
  { label: t('analysis.audit.accountFilter.include'), value: 'include' },
  { label: t('analysis.audit.accountFilter.exclude'), value: 'exclude' },
];

// Instance filter options - returns array with translated labels
export const getInstanceFilterOptions = (t: (key: string) => string) => [
  { label: t('analysis.audit.instanceFilter.name'), value: 'name' },
  { label: t('analysis.audit.instanceFilter.id'), value: 'id' },
];

// Statistics dialog modes
export const DIALOG_MODE = {
  ADD: 'add',
  EDIT: 'edit',
} as const;
