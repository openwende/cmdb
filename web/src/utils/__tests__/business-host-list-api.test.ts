import { describe, expect, it, vi } from 'vitest';

import axios from '@/api/axiosInstance';
import { getHostList } from '@/api/services/business';

vi.mock('@/api/axiosInstance', () => ({
  default: {
    get: vi.fn(async () => ({
      total: 0,
      page: 1,
      page_size: 20,
      hosts: [],
    })),
  },
}));

describe('business service host list api', () => {
  it('uses the unified host endpoint', async () => {
    const params = { params: { page: 1, page_size: 20 } };

    await getHostList(params);

    expect(axios.get).toHaveBeenCalledWith('/v1/hosts', params);
  });
});
