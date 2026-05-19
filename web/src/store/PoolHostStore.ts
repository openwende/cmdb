import { create } from 'zustand';

import axios from '@/api/axiosInstance';

interface PoolHostQuery {
  directoryId?: number;
  page: number;
  pageSize: number;
}

interface RawPoolHost {
  id: string;
  display_id?: number;
  primary_ip?: string;
  ip_addresses?: string[];
  status?: string;
  cloud_area_id?: string | null;
  cloud_area?: { id: string; name: string } | null;
}

interface PoolHostRow {
  host: {
    bk_host_id: string;
    bk_host_display_id?: number | string;
    bk_host_innerip: string;
    bk_host_innerip_v6: string;
    bk_cloud_host_status: string;
    bk_cloud_id: Array<{
      bk_inst_id: string;
      bk_inst_name: string;
    }>;
  };
  module: Array<{
    bk_module_id: number | null;
    topo_module_name: string;
  }>;
  set: Array<{
    bk_set_id: number | null;
  }>;
}

interface PoolHostStoreState {
  query: PoolHostQuery;
  hosts: PoolHostRow[];
  total: number;
  loading: boolean;
  error: string | null;
  setQuery: (query: Partial<PoolHostQuery>) => void;
  fetchHosts: () => Promise<void>;
  removeHosts: (ids: string[]) => void;
  reset: () => void;
}

const DEFAULT_QUERY: PoolHostQuery = {
  page: 1,
  pageSize: 20,
};

const adaptPoolHost = (item: RawPoolHost, directoryId?: number): PoolHostRow => {
  const ipv6 = item.ip_addresses?.find((address) => address.includes(':')) || '';
  const cloudID = item.cloud_area_id || '';
  const cloudName = item.cloud_area?.name || cloudID;

  return {
    host: {
      bk_host_id: item.id,
      bk_host_display_id: item.display_id ?? item.id,
      bk_host_innerip: item.primary_ip || '',
      bk_host_innerip_v6: ipv6,
      bk_cloud_host_status: item.status || '--',
      bk_cloud_id: cloudID
        ? [
            {
              bk_inst_id: cloudID,
              bk_inst_name: cloudName,
            },
          ]
        : [],
    },
    module: directoryId
      ? [
          {
            bk_module_id: directoryId,
            topo_module_name: `资源池##${directoryId}`,
          },
        ]
      : [],
    set: directoryId
      ? [
          {
            bk_set_id: directoryId,
          },
        ]
      : [],
  };
};

export const usePoolHostStore = create<PoolHostStoreState>((set, get) => ({
  query: DEFAULT_QUERY,
  hosts: [],
  total: 0,
  loading: false,
  error: null,

  setQuery: (query) =>
    set((state) => ({
      query: {
        ...state.query,
        ...query,
      },
    })),

  fetchHosts: async () => {
    const { query } = get();
    set({
      loading: true,
      error: null,
    });

    try {
      const response = await axios.get('/v1/resource-pool/hosts', {
        params: {
          page: query.page,
          page_size: query.pageSize,
          ...(query.directoryId ? { directory_id: query.directoryId } : {}),
        },
      });

      const items = (response?.data?.items || []) as RawPoolHost[];
      set({
        hosts: items.map((item) => adaptPoolHost(item, query.directoryId)),
        total: response?.data?.pagination?.total || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to fetch pool hosts:', error);
      set({
        hosts: [],
        total: 0,
        error: error instanceof Error ? error.message : 'Failed to fetch pool hosts',
        loading: false,
      });
    }
  },

  removeHosts: (ids) =>
    set((state) => {
      const idSet = new Set(ids);
      const nextHosts = state.hosts.filter((h) => !idSet.has(String(h.host.bk_host_id)));
      return {
        hosts: nextHosts,
        total: Math.max(0, state.total - (state.hosts.length - nextHosts.length)),
      };
    }),

  reset: () =>
    set({
      query: DEFAULT_QUERY,
      hosts: [],
      total: 0,
      loading: false,
      error: null,
    }),
}));
