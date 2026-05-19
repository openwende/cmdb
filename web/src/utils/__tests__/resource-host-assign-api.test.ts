import { beforeEach, describe, expect, it, vi } from 'vitest';

import axios from '@/api/axiosInstance';
import { assignHostsToBusinessIdlePool } from '@/api/services/resource';

vi.mock('@/api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('resource host assignment api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allocates resource-pool hosts to the real idle module', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      code: 0,
      data: [
        {
          node_id: '1000',
          node_type: 'business',
          children: [
            {
              node_id: 4,
              node_type: 'module',
              is_default: true,
              extra: { bk_module_id: 5 },
            },
          ],
        },
      ],
    });
    vi.mocked(axios.post).mockResolvedValueOnce({
      code: 0,
      data: { total: 1, successful: 1, failed: 0 },
    });

    await assignHostsToBusinessIdlePool(1000, ['host-1']);

    expect(axios.post).toHaveBeenNthCalledWith(1, '/v1/resource-pool/hosts/allocate', {
      target_module_id: 5,
      host_ids: ['host-1'],
    });
    expect(axios.post).toHaveBeenCalledTimes(1);
  });

  it('initializes business topology when no idle module is returned yet', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({ code: 0, data: [] })
      .mockResolvedValueOnce({
        code: 0,
        data: [{ node_id: 7, node_type: 'idle_module', is_default: true }],
      });
    vi.mocked(axios.post)
      .mockResolvedValueOnce({ code: 0, data: { message: 'ok' } })
      .mockResolvedValueOnce({ code: 0, data: { total: 1, successful: 1, failed: 0 } });

    await assignHostsToBusinessIdlePool(1000, ['host-1']);

    expect(axios.post).toHaveBeenNthCalledWith(1, '/v1/topology/businesses/1000/initialize');
    expect(axios.post).toHaveBeenNthCalledWith(2, '/v1/resource-pool/hosts/allocate', {
      target_module_id: 7,
      host_ids: ['host-1'],
    });
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});
