import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNodeDetailStore } from '@/store/NodeDetailStore';
import { useTopologySceneStore } from '@/store/TopologySceneStore';
import { getTopologyNodeDetail } from '@/api/services/business';

vi.mock('@/api/services/business', () => ({
  getTopologyNodeDetail: vi.fn(async (nodeId: string) => ({
    code: 0,
    data: {
      node_id: nodeId,
      model_uid: 'module',
      allowed_actions: ['move'],
      path: [{ node_id: 'business-1', node_type: 'business', name: 'biz', model_uid: 'business' }],
    },
  })),
}));

describe('topology scene store', () => {
  beforeEach(() => {
    useTopologySceneStore.getState().reset();
    useNodeDetailStore.getState().reset();
    vi.clearAllMocks();
  });

  it('loads node detail after selectNode', async () => {
    const store = useTopologySceneStore.getState();

    await store.selectNode('module-1');

    expect(useNodeDetailStore.getState().selectedNodeId).toBe('module-1');
    expect(useNodeDetailStore.getState().detail?.model_uid).toBe('module');
    expect(getTopologyNodeDetail).toHaveBeenCalledWith('module-1');
  });
});
