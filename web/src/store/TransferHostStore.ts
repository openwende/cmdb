import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AddHostItem, TreeData } from '@/pages/Business/Types';

interface TransferHostState {
  selectedHosts: AddHostItem[];
  targetModules: TreeData[];
  idleSetID: number | null;
  setIdleSetID: (id: number) => void;
  setTransferHostData: (hosts: AddHostItem[], node: TreeData[]) => void;
}

export const useTransferHostStore = create<TransferHostState>()(
  persist(
    (set) => ({
      selectedHosts: [],
      targetModules: [],
      idleSetID: null,

      setTransferHostData: (hosts: AddHostItem[], modules: TreeData[]) => {
        set({
          selectedHosts: hosts,
          targetModules: modules,
        });
      },

      setIdleSetID: (id: number) => {
        set({
          idleSetID: id
        })
      }
    }),
    {
      name: 'transfer-host',
      storage: createJSONStorage(() => sessionStorage)
    }
  )
);
