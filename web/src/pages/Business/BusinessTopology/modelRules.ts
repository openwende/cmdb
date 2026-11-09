import { MainlineModel } from '@/api/types/mainline';

const builtinChildModels: Record<string, MainlineModel[]> = {
  business: [
    {
      uid: 'set',
      display_name: '集群',
      classification: 'business',
      icon: 'cluster',
      description: '业务下的集群节点',
      scope: 'business',
      level: 1,
      parent_model_uid: 'business',
      is_builtin: true,
      is_topology_builtin: true,
    },
  ],
  set: [
    {
      uid: 'module',
      display_name: '模块',
      classification: 'business',
      icon: 'module',
      description: '集群下的模块节点',
      scope: 'business',
      level: 2,
      parent_model_uid: 'set',
      is_builtin: true,
      is_topology_builtin: true,
    },
  ],
  idle_set: [
    {
      uid: 'module',
      display_name: '模块',
      classification: 'business',
      icon: 'module',
      description: '空闲机池下的模块节点',
      scope: 'business',
      level: 2,
      parent_model_uid: 'set',
      is_builtin: true,
      is_topology_builtin: true,
    },
  ],
};

export const getBusinessTopologyChildModels = (
  parentModelUID?: string | null,
  getDynamicChildModels?: (parentUID?: string | null) => MainlineModel[],
): MainlineModel[] => {
  if (!parentModelUID) {
    return [];
  }

  const builtin = builtinChildModels[parentModelUID] || [];
  const dynamic = getDynamicChildModels ? getDynamicChildModels(parentModelUID) : [];
  const merged = new Map<string, MainlineModel>();

  [...builtin, ...dynamic].forEach((model) => {
    if (!merged.has(model.uid)) {
      merged.set(model.uid, model);
    }
  });

  return Array.from(merged.values());
};
