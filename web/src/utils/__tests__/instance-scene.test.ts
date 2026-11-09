import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useInstanceSceneStore } from '@/store/InstanceSceneStore';
import { getAggregateInstanceDetail } from '@/api/services/modelInstance';

vi.mock('@/api/services/modelInstance', () => ({
  getAggregateInstanceDetail: vi.fn(async (instanceKey: string) => ({
    code: 0,
    data: {
      instance_key: instanceKey,
      model: { model_uid: 'host', display_name: 'Host' },
      properties: { name: 'host-1' },
      binding_context: { topology_bound: false },
      allowed_actions: ['bind_topology'],
    },
  })),
}));

describe('instance scene store', () => {
  beforeEach(() => {
    useInstanceSceneStore.getState().reset();
    vi.clearAllMocks();
  });

  it('loads aggregate instance detail once for both model and topology entry points', async () => {
    await useInstanceSceneStore.getState().openInstance('host:1');

    expect(useInstanceSceneStore.getState().detail?.instance_key).toBe('host:1');
    expect(getAggregateInstanceDetail).toHaveBeenCalledWith('host:1');
  });
});
