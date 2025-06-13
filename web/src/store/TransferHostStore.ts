import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AddHostItem, TreeData } from '@/pages/Business/Types';

interface TransferHostState {
  selectedHosts: AddHostItem[];
  selectedNode: TreeData | null;
  setTransferData: (hosts: AddHostItem[], node: TreeData | null) => void;
}

export const useTransferHostStore = create<TransferHostState>()(
  persist(
    (set) => ({
      selectedHosts: [],
      selectedNode: null,

      setTransferData: (hosts: AddHostItem[], node: TreeData | null) => {
        set({
          selectedHosts: hosts,
          selectedNode: node,
        });
      },
    }),
    {
      name: 'transfer-host',
      storage: createJSONStorage(() => sessionStorage)
    }
  )
);
