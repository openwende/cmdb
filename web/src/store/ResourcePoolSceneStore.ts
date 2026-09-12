import { create } from 'zustand';

import { TabsKey } from '@/pages/Resource/Types';

interface ResourcePoolSceneStoreState {
  tab: TabsKey;
  setTab: (tab: TabsKey) => void;
  reset: () => void;
}

export const useResourcePoolSceneStore = create<ResourcePoolSceneStoreState>((set) => ({
  tab: TabsKey.Unassigned,

  setTab: (tab) => set({ tab }),

  reset: () =>
    set({
      tab: TabsKey.Unassigned,
    }),
}));
