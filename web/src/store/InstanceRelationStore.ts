import { create } from 'zustand';

import {
  RelationCapabilities,
  RelationCapabilityTarget,
  getInstanceRelationCapabilities,
} from '@/api/services/modelRelation';

interface InstanceRelationStoreState {
  instanceKey: string | null;
  detail: RelationCapabilities | null;
  capabilities: RelationCapabilityTarget[];
  loading: boolean;
  error: string | null;
  loadCapabilities: (instanceKey: string) => Promise<void>;
  reset: () => void;
}

export const useInstanceRelationStore = create<InstanceRelationStoreState>((set) => ({
  instanceKey: null,
  detail: null,
  capabilities: [],
  loading: false,
  error: null,

  loadCapabilities: async (instanceKey) => {
    set({
      instanceKey,
      loading: true,
      error: null,
    });

    try {
      const response = await getInstanceRelationCapabilities(instanceKey);
      set({
        detail: response?.data ?? null,
        capabilities: response?.data?.candidate_targets ?? [],
      });
    } catch (error) {
      console.error('Failed to load instance relation capabilities:', error);
      set({
        detail: null,
        capabilities: [],
        error: error instanceof Error ? error.message : 'Failed to load relation capabilities',
      });
    } finally {
      set({ loading: false });
    }
  },

  reset: () =>
    set({
      instanceKey: null,
      detail: null,
      capabilities: [],
      loading: false,
      error: null,
    }),
}));
