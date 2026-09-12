import { describe, expect, it, vi } from 'vitest';

import axios from '@/api/axiosInstance';
import {
  deleteTopologyModule,
  deleteTopologySet,
  transferTopologyHosts,
  updateTopologyModule,
  updateTopologySet,
} from '@/api/services/business';

vi.mock('@/api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(async () => ({ code: 0 })),
    put: vi.fn(async () => ({ code: 0 })),
    delete: vi.fn(async () => ({ code: 0 })),
  },
}));

describe('topology edit api', () => {
  it('updates topology set through the v1 topology endpoint', async () => {
    await updateTopologySet(4, { name: 'ProbeSet-renamed' });

    expect(axios.put).toHaveBeenCalledWith('/v1/topology/sets/4', {
      name: 'ProbeSet-renamed',
    });
  });

  it('updates topology module through the v1 topology endpoint', async () => {
    await updateTopologyModule(4, { name: 's1-renamed' });

    expect(axios.put).toHaveBeenCalledWith('/v1/topology/modules/4', {
      name: 's1-renamed',
    });
  });

  it('deletes topology set through the v1 topology endpoint', async () => {
    await deleteTopologySet(4);

    expect(axios.delete).toHaveBeenCalledWith('/v1/topology/sets/4');
  });

  it('deletes topology module through the v1 topology endpoint', async () => {
    await deleteTopologyModule(9);

    expect(axios.delete).toHaveBeenCalledWith('/v1/topology/modules/9');
  });

  it('transfers hosts into a topology module through the transfer endpoint', async () => {
    await transferTopologyHosts({
      host_ids: ['host-1'],
      target_module_id: 4,
    });

    expect(axios.post).toHaveBeenCalledWith('/v1/topology/hosts/transfer', {
      host_ids: ['host-1'],
      target_module_id: 4,
    });
  });
});
