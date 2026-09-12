import { create } from 'zustand';

import {
  RelationCapabilities,
  RelationCapabilityTarget,
  getModelRelationCapabilities,
} from '@/api/services/modelRelation';

interface ModelRelationStoreState {
  modelUID: string | null;
  detail: RelationCapabilities | null;
  capabilities: RelationCapabilityTarget[];
  loading: boolean;
  error: string | null;
  loadCapabilities: (modelUID: string) => Promise<void>;
  reset: () => void;
}

export const useModelRelationStore = create<ModelRelationStoreState>((set) => ({
  modelUID: null,
  detail: null,
  capabilities: [],
  loading: false,
  error: null,

  loadCapabilities: async (modelUID) => {
    set({
      modelUID,
      loading: true,
      error: null,
    });

    try {
      const response = await getModelRelationCapabilities(modelUID);
      set({
        detail: response?.data ?? null,
        capabilities: response?.data?.candidate_targets ?? [],
      });
    } catch (error) {
      console.error('Failed to load model relation capabilities:', error);
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
      modelUID: null,
      detail: null,
      capabilities: [],
      loading: false,
      error: null,
    }),
}));
