import { create } from 'zustand';

import { getTopologyNodeDetail, TopologyNodeDetail } from '@/api/services/business';

interface NodeDetailStoreState {
  selectedNodeId: string | null;
  detail: TopologyNodeDetail | null;
  loading: boolean;
  error: string | null;
  loadNodeDetail: (nodeId: string) => Promise<void>;
  reset: () => void;
}

export const useNodeDetailStore = create<NodeDetailStoreState>((set) => ({
  selectedNodeId: null,
  detail: null,
  loading: false,
  error: null,

  loadNodeDetail: async (nodeId) => {
    set({
      selectedNodeId: nodeId,
      loading: true,
      error: null,
    });

    try {
      const response = await getTopologyNodeDetail(nodeId);
      set({
        detail: response?.data ?? null,
      });
    } catch (error) {
      console.error('Failed to load topology node detail:', error);
      set({
        detail: null,
        error: error instanceof Error ? error.message : 'Failed to load node detail',
      });
    } finally {
      set({ loading: false });
    }
  },

  reset: () =>
    set({
      selectedNodeId: null,
      detail: null,
      loading: false,
      error: null,
    }),
}));
