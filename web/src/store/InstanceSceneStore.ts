import { create } from 'zustand';

import { AggregateInstanceDetail, getAggregateInstanceDetail } from '@/api/services/modelInstance';

interface InstanceSceneStoreState {
  instanceKey: string | null;
  detail: AggregateInstanceDetail | null;
  loading: boolean;
  error: string | null;
  openInstance: (instanceKey: string) => Promise<void>;
  reset: () => void;
}

export const useInstanceSceneStore = create<InstanceSceneStoreState>((set) => ({
  instanceKey: null,
  detail: null,
  loading: false,
  error: null,

  openInstance: async (instanceKey) => {
    set({
      instanceKey,
      loading: true,
      error: null,
    });

    try {
      const response = await getAggregateInstanceDetail(instanceKey);
      set({
        detail: response?.data ?? null,
      });
    } catch (error) {
      console.error('Failed to open aggregate instance:', error);
      set({
        detail: null,
        error: error instanceof Error ? error.message : 'Failed to open instance',
      });
    } finally {
      set({ loading: false });
    }
  },

  reset: () =>
    set({
      instanceKey: null,
      detail: null,
      loading: false,
      error: null,
    }),
}));
