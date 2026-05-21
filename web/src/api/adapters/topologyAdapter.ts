/**
 * 拓扑树数据适配器
 * 负责将后端返回的数据格式转换为前端需要的格式
 */

import { BackendTopologyNode, BackendNodeType } from '../types/topology';
import { MainlineModel } from '../types/mainline';
import { TreeData, TopoTreeNodeType } from '@/pages/Business/Types';

const DEFAULT_OBJECT_NAMES: Partial<Record<BackendNodeType, string>> = {
  [BackendNodeType.Business]: '业务',
  [BackendNodeType.Set]: '集群',
  [BackendNodeType.Module]: '模块',
  [BackendNodeType.IdleSet]: '空闲机池',
  [BackendNodeType.IdleModule]: '模块',
};

const REQUIRED_IDLE_MODULES = [
  { title: '待回收', id: 1 },
  { title: '故障机', id: 2 },
  { title: '空闲机', id: 3 },
] as const;

const REQUIRED_IDLE_MODULE_TITLES: string[] = REQUIRED_IDLE_MODULES.map((module) => module.title);

const getSyntheticIdleModuleNodeID = (idleSetNodeID: number | string, syntheticID: number) => {
  const parentID = Number(idleSetNodeID);

  if (!Number.isFinite(parentID) || parentID <= 0) {
    return String(syntheticID);
  }

  return String(parentID * 1000 + syntheticID);
};

const getIdleModuleOrder = (title: TreeData['title']) => {
  const index = REQUIRED_IDLE_MODULE_TITLES.indexOf(String(title));
  return index === -1 ? REQUIRED_IDLE_MODULE_TITLES.length : index;
};

const sortBusinessChildren = (children: TreeData[]): TreeData[] =>
  children
    .map((child, index) => ({ child, index }))
    .sort((left, right) => {
      const leftIsIdleSet = left.child.backendType === BackendNodeType.IdleSet;
      const rightIsIdleSet = right.child.backendType === BackendNodeType.IdleSet;

      if (leftIsIdleSet !== rightIsIdleSet) {
        return leftIsIdleSet ? -1 : 1;
      }

      return left.index - right.index;
    })
    .map(({ child }) => child);

const toDisplayLabel = (value?: string): string => {
  if (!value) {
    return '节点';
  }

  const normalized = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (!normalized) {
    return '节点';
  }

  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const normalizeBackendNodeType = (node: BackendTopologyNode): string => {
  if (node.is_default && node.node_type === BackendNodeType.Set) {
    return BackendNodeType.IdleSet;
  }

  if (node.is_default && node.node_type === BackendNodeType.Module) {
    return BackendNodeType.IdleModule;
  }

  return node.node_type;
};

/**
 * 将后端节点类型映射到前端节点类型
 */
const mapNodeType = (backendType: string): string => {
  const typeMap: Partial<Record<BackendNodeType, string>> = {
    [BackendNodeType.Business]: TopoTreeNodeType.Biz,
    [BackendNodeType.Set]: TopoTreeNodeType.Set,
    [BackendNodeType.Module]: TopoTreeNodeType.Module,
    [BackendNodeType.IdleSet]: TopoTreeNodeType.Idle,
    [BackendNodeType.IdleModule]: TopoTreeNodeType.Module,
  };

  return typeMap[backendType as BackendNodeType] || backendType;
};

/**
 * 获取节点的对象名称（中文描述）
 */
const getObjName = (
  nodeType: string,
  icon?: string,
  mainlineModelMap?: Record<string, MainlineModel>,
): string => {
  const modelMeta = mainlineModelMap?.[nodeType];
  if (modelMeta?.display_name) {
    return modelMeta.display_name;
  }

  if (nodeType in DEFAULT_OBJECT_NAMES) {
    return DEFAULT_OBJECT_NAMES[nodeType as BackendNodeType] || '节点';
  }

  return toDisplayLabel(icon || nodeType);
};

/**
 * 生成前端需要的节点 key
 * 格式: "biz-1001" 或 "set-123" 或 "module-456"
 */
const generateNodeKey = (node: BackendTopologyNode): string => {
  return `${normalizeBackendNodeType(node)}-${node.node_id}`;
};

/**
 * 将后端拓扑节点转换为前端 TreeData 格式
 */
export const adaptTopologyNode = (
  backendNode: BackendTopologyNode,
  mainlineModelMap?: Record<string, MainlineModel>,
): TreeData => {
  const backendNodeType = normalizeBackendNodeType(backendNode);
  const frontendType = mapNodeType(backendNodeType);
  const key = generateNodeKey(backendNode);

  const treeData: TreeData = {
    title: backendNode.name,
    key: key,
    type: frontendType,
    objName: getObjName(backendNodeType, backendNode.icon, mainlineModelMap),
    nodeId: String(backendNode.node_id),
    backendType: backendNodeType,
    icon: backendNode.icon,
    isLeaf: backendNode.is_leaf,
    expandable: backendNode.expandable,
    extra: {
      ...backendNode.extra,
      child_count: backendNode.child_count,
      is_default: backendNode.is_default,
    },
  };

  // 如果有子节点，递归转换
  if (backendNode.children && backendNode.children.length > 0) {
    treeData.children = backendNode.children.map((child) =>
      adaptTopologyNode(child, mainlineModelMap),
    );
  }

  if (backendNodeType === BackendNodeType.IdleSet) {
    const existingChildren = treeData.children || [];
    const existingTitles = new Set(existingChildren.map((child) => String(child.title)));
    const syntheticChildren = REQUIRED_IDLE_MODULES.filter(
      (module) => !existingTitles.has(module.title),
    ).map((module) => {
      const syntheticNodeID = getSyntheticIdleModuleNodeID(backendNode.node_id, module.id);
      return {
        title: module.title,
        key: `idle_module-${syntheticNodeID}`,
        type: TopoTreeNodeType.Module,
        objName: getObjName(BackendNodeType.IdleModule, undefined, mainlineModelMap),
        nodeId: syntheticNodeID,
        backendType: BackendNodeType.IdleModule,
        icon: 'module',
        isLeaf: true,
        expandable: false,
        extra: {
          child_count: 0,
          host_count: 0,
          is_default: true,
          isSyntheticIdleModule: true,
          synthetic_idle_module_id: module.id,
        },
      };
    });

    treeData.children = [...syntheticChildren, ...existingChildren].sort((left, right) => {
      return getIdleModuleOrder(left.title) - getIdleModuleOrder(right.title);
    });
    treeData.isLeaf = false;
    treeData.expandable = true;
    treeData.extra = {
      ...treeData.extra,
      child_count: treeData.children.length,
    };
  }

  if (backendNodeType === BackendNodeType.Business && treeData.children?.length) {
    treeData.children = sortBusinessChildren(treeData.children);
  }

  return treeData;
};

/**
 * 将后端拓扑树数组转换为前端格式
 */
export const adaptTopologyTree = (
  backendTree: BackendTopologyNode[],
  mainlineModels?: MainlineModel[],
): TreeData[] => {
  const mainlineModelMap = (mainlineModels || []).reduce<Record<string, MainlineModel>>(
    (acc, model) => {
      acc[model.uid] = model;
      return acc;
    },
    {},
  );

  return backendTree.map((node) => adaptTopologyNode(node, mainlineModelMap));
};

/**
 * 从节点 key 中解析出节点类型和 ID
 * 例如: "biz-uuid" => { type: "biz", id: "uuid" }
 */
export const parseNodeKey = (key: string): { type: string; id: string } => {
  const parts = key.split('-');
  if (parts.length < 2) {
    return { type: '', id: '' };
  }

  const type = parts[0];
  const id = parts[1];

  return { type, id };
};
