import { AddHostItem, TreeData } from '@/pages/Business/Types';
import { create } from 'zustand';

interface TransferHostState {
  selectedHosts: AddHostItem[];
  selectedNode: TreeData | null;
  setTransferData: (hosts: AddHostItem[], node: TreeData | null) => void;
  clearTransferData: () => void;
}

export const useTransferHostStore = create<TransferHostState>((set) => ({
  selectedHosts: [],
  selectedNode: null,

  setTransferData: (hosts: AddHostItem[], node: TreeData | null) => {
    set({
      selectedHosts: hosts,
      selectedNode: node
    });
  },

  clearTransferData: () => {
    set({
      selectedHosts: [],
      selectedNode: null,
    });
  },
}));