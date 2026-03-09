import { create } from 'zustand';

import { getMainlineModels, getTopologySettings } from '@/api/services/mainline';
import { MainlineModel, TopologySettings } from '@/api/types/mainline';

interface MainlineStoreState {
  mainlineModels: MainlineModel[];
  topologySettings: TopologySettings | null;
  loadingModels: boolean;
  loadingSettings: boolean;
  initializedModels: boolean;
  initializedSettings: boolean;
  getModelByUID: (uid?: string | null) => MainlineModel | undefined;
  getChildModels: (parentUID?: string | null) => MainlineModel[];
  loadMainlineModels: (force?: boolean) => Promise<void>;
  loadTopologySettings: (force?: boolean) => Promise<void>;
  reset: () => void;
}

export const useMainlineStore = create<MainlineStoreState>((set, get) => ({
  mainlineModels: [],
  topologySettings: null,
  loadingModels: false,
  loadingSettings: false,
  initializedModels: false,
  initializedSettings: false,

  getModelByUID: (uid) => {
    if (!uid) {
      return undefined;
    }
    return get().mainlineModels.find((model) => model.uid === uid);
  },

  getChildModels: (parentUID) => {
    if (!parentUID) {
      return [];
    }

    return get()
      .mainlineModels
      .filter((model) => model.parent_model_uid === parentUID && model.uid !== 'host')
      .sort((left, right) => {
        const leftLevel = left.level || 0;
        const rightLevel = right.level || 0;
        return leftLevel - rightLevel || left.display_name.localeCompare(right.display_name);
      });
  },

  loadMainlineModels: async (force = false) => {
    const state = get();
    if (state.loadingModels || (state.initializedModels && !force)) {
      return;
    }

    set({ loadingModels: true });
    try {
      const response = await getMainlineModels();
      set({
        mainlineModels: response?.data?.items ?? [],
        initializedModels: true,
      });
    } catch (error) {
      console.error('Failed to load mainline models:', error);
      set({ initializedModels: true });
    } finally {
      set({ loadingModels: false });
    }
  },

  loadTopologySettings: async (force = false) => {
    const state = get();
    if (state.loadingSettings || (state.initializedSettings && !force)) {
      return;
    }

    set({ loadingSettings: true });
    try {
      const response = await getTopologySettings();
      set({
        topologySettings: response?.data ?? null,
        initializedSettings: true,
      });
    } catch (error) {
      console.error('Failed to load topology settings:', error);
      set({ initializedSettings: true });
    } finally {
      set({ loadingSettings: false });
    }
  },

  reset: () =>
    set({
      mainlineModels: [],
      topologySettings: null,
      loadingModels: false,
      loadingSettings: false,
      initializedModels: false,
      initializedSettings: false,
    }),
}));
