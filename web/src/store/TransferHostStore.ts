import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AddHostItem, TreeData } from '@/pages/Business/Types';

interface TransferHostState {
  selectedHosts: AddHostItem[];
  targetModules: TreeData[];
  setTransferHostData: (hosts: AddHostItem[], node: TreeData[]) => void;
}

export const useTransferHostStore = create<TransferHostState>()(
  persist(
    (set) => ({
      selectedHosts: [],
      targetModules: [],

      setTransferHostData: (hosts: AddHostItem[], modules: TreeData[]) => {
        set({
          selectedHosts: hosts,
          targetModules: modules,
        });
      }
    }),
    {
      name: 'transfer-host',
      storage: createJSONStorage(() => sessionStorage)
    }
  )
);
