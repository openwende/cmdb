import { describe, expect, it } from 'vitest';

import { adaptTopologyNode } from '@/api/adapters/topologyAdapter';
import { BackendNodeType } from '@/api/types/topology';

describe('topology adapter idle nodes', () => {
  it('normalizes default set and module nodes to idle backend types', () => {
    const idleSetNode = adaptTopologyNode({
      id: 'set_3',
      node_id: 3,
      name: '空闲机池',
      node_type: BackendNodeType.Set,
      parent_id: 'business_1',
      is_leaf: false,
      is_default: true,
      expandable: true,
      child_count: 1,
      children: [
        {
          id: 'module_2',
          node_id: 2,
          name: '空闲机',
          node_type: BackendNodeType.Module,
          parent_id: 'set_3',
          is_leaf: true,
          is_default: true,
          expandable: false,
          child_count: 0,
        },
      ],
    });

    expect(idleSetNode.key).toBe('idle_set-3');
    expect(idleSetNode.backendType).toBe(BackendNodeType.IdleSet);
    expect(idleSetNode.extra?.child_count).toBe(1);
    expect(idleSetNode.children?.[0].key).toBe('idle_module-2');
    expect(idleSetNode.children?.[0].backendType).toBe(BackendNodeType.IdleModule);
    expect(idleSetNode.children?.[0].extra?.child_count).toBe(0);
  });
});
