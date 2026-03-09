import { create } from 'zustand';

import { TopoTreeNodeType, TreeData } from '@/pages/Business/Types';
import { useNodeDetailStore } from '@/store/NodeDetailStore';

interface TopologySceneStoreState {
  selectedNodeId: string | null;
  selectedNode: TreeData | null;
  parentNodes: TreeData[];
  selectNode: (node: TreeData | string, parentNodes?: TreeData[]) => Promise<void>;
  reset: () => void;
}

const normalizeNodeDetailId = (node: TreeData): string => {
  const modelUID =
    node.backendType || (node.type === TopoTreeNodeType.Biz ? 'business' : node.type);
  const rawNodeID = node.nodeId || node.key.split('-').slice(1).join('-');

  return `${modelUID}-${rawNodeID}`;
};

export const useTopologySceneStore = create<TopologySceneStoreState>((set) => ({
  selectedNodeId: null,
  selectedNode: null,
  parentNodes: [],

  selectNode: async (node, parentNodes = []) => {
    const nodeId = typeof node === 'string' ? node : normalizeNodeDetailId(node);

    set({
      selectedNodeId: nodeId,
      selectedNode: typeof node === 'string' ? null : node,
      parentNodes,
    });

    await useNodeDetailStore.getState().loadNodeDetail(nodeId);
  },

  reset: () =>
    set({
      selectedNodeId: null,
      selectedNode: null,
      parentNodes: [],
    }),
}));
