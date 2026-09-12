import { create } from 'zustand';

import axios from '@/api/axiosInstance';
import { usePoolHostStore } from '@/store/PoolHostStore';

interface RawDirectoryNode {
  id: number;
  name: string;
  host_count?: number;
  children?: RawDirectoryNode[];
}

interface DirectoryItem {
  bk_module_id: number;
  bk_module_name: string;
  host_count: number;
  children: RawDirectoryNode[];
}

interface DirectoryStoreState {
  directories: DirectoryItem[];
  activeDirectoryId: number;
  loading: boolean;
  error: string | null;
  fetchDirectories: () => Promise<void>;
  setActiveDirectory: (id: number) => Promise<void>;
  reset: () => void;
}

const flattenDirectories = (nodes: RawDirectoryNode[]): DirectoryItem[] => {
  return nodes.flatMap((node) => [
    {
      bk_module_id: node.id,
      bk_module_name: node.name,
      host_count: node.host_count || 0,
      children: node.children || [],
    },
    ...flattenDirectories(node.children || []),
  ]);
};

export const useDirectoryStore = create<DirectoryStoreState>((set) => ({
  directories: [],
  activeDirectoryId: 0,
  loading: false,
  error: null,

  fetchDirectories: async () => {
    set({
      loading: true,
      error: null,
    });

    try {
      const response = await axios.get('/v1/resource-pool/directories/tree');
      const directories = flattenDirectories(response?.data || []);
      const nextActiveDirectoryId = directories[0]?.bk_module_id || 0;

      set((state) => ({
        directories,
        activeDirectoryId: state.activeDirectoryId || nextActiveDirectoryId,
      }));

      if (nextActiveDirectoryId > 0 && usePoolHostStore.getState().query.directoryId == null) {
        usePoolHostStore.getState().setQuery({
          directoryId: nextActiveDirectoryId,
        });
      }
    } catch (error) {
      console.error('Failed to fetch directories:', error);
      set({
        directories: [],
        error: error instanceof Error ? error.message : 'Failed to fetch directories',
      });
    } finally {
      set({ loading: false });
    }
  },

  setActiveDirectory: async (id) => {
    set({ activeDirectoryId: id });
    usePoolHostStore.getState().setQuery({
      directoryId: id > 0 ? id : undefined,
      page: 1,
    });
  },

  reset: () =>
    set({
      directories: [],
      activeDirectoryId: 0,
      loading: false,
      error: null,
    }),
}));
