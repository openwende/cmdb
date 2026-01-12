import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { TransferHostItem, TransferHostType, TreeData } from '@/pages/Business/Types';

interface TransferHostState {
  selectedHosts: TransferHostItem[];
  targetModules: TreeData[];
  idleSetID: number | null;
  transferHostType?: TransferHostType;
  setIdleSetID: (id: number) => void;
  setTransferHostData: (
    hosts: TransferHostItem[],
    node: TreeData[],
    transferType?: TransferHostType,
  ) => void;
}

export const useTransferHostStore = create<TransferHostState>()(
  persist(
    (set) => ({
      selectedHosts: [],
      targetModules: [],
      idleSetID: null,

      setTransferHostData: (
        hosts: TransferHostItem[],
        modules: TreeData[],
        transferType?: TransferHostType,
      ) => {
        set({
          selectedHosts: hosts,
          targetModules: modules,
          transferHostType: transferType,
        });
      },

      setIdleSetID: (id: number) => {
        set({
          idleSetID: id,
        });
      },
    }),
    {
      name: 'transfer-host',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
