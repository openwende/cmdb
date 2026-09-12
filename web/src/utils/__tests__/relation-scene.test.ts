import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useInstanceRelationStore } from '@/store/InstanceRelationStore';
import { getInstanceRelationCapabilities } from '@/api/services/modelRelation';

vi.mock('@/api/services/modelRelation', () => ({
  getInstanceRelationCapabilities: vi.fn(async (instanceKey: string) => ({
    code: 0,
    data: {
      instance_key: instanceKey,
      allowed_actions: ['create_relation'],
      constraints: {
        associations: [],
      },
      candidate_targets: [],
      conflict_details: [],
      impact_summary: {},
    },
  })),
}));

describe('relation scene store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads instance relation capabilities before creating a relation', async () => {
    await useInstanceRelationStore.getState().loadCapabilities('host:1');

    expect(useInstanceRelationStore.getState().capabilities.length).toBeGreaterThanOrEqual(0);
    expect(getInstanceRelationCapabilities).toHaveBeenCalledWith('host:1');
  });
});
