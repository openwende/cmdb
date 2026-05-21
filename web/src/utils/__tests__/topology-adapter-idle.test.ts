import { describe, expect, it } from 'vitest';

import { adaptTopologyNode, adaptTopologyTree } from '@/api/adapters/topologyAdapter';
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
    expect(idleSetNode.extra?.child_count).toBe(3);
    expect(idleSetNode.children?.map((node) => node.title)).toEqual(['待回收', '故障机', '空闲机']);
    expect(idleSetNode.children?.[0].extra?.isSyntheticIdleModule).toBe(true);
    expect(idleSetNode.children?.[1].extra?.isSyntheticIdleModule).toBe(true);
    expect(idleSetNode.children?.[0].key).toBe('idle_module-3001');
    expect(idleSetNode.children?.[0].nodeId).toBe('3001');
    expect(idleSetNode.children?.[1].key).toBe('idle_module-3002');
    expect(idleSetNode.children?.[1].nodeId).toBe('3002');
    expect(idleSetNode.children?.[2].key).toBe('idle_module-2');
    expect(idleSetNode.children?.[2].backendType).toBe(BackendNodeType.IdleModule);
    expect(idleSetNode.children?.[2].extra?.child_count).toBe(0);
  });

  it('keeps the idle pool as the first business child regardless of backend order', () => {
    const [businessNode] = adaptTopologyTree([
      {
        id: 'business_1',
        node_id: 1,
        name: 'Smoke Business',
        node_type: BackendNodeType.Business,
        parent_id: '',
        is_leaf: false,
        is_default: false,
        expandable: true,
        child_count: 2,
        children: [
          {
            id: 'set_4',
            node_id: 4,
            name: '业务集群',
            node_type: BackendNodeType.Set,
            parent_id: 'business_1',
            is_leaf: true,
            is_default: false,
            expandable: false,
            child_count: 0,
          },
          {
            id: 'set_3',
            node_id: 3,
            name: '空闲机池',
            node_type: BackendNodeType.Set,
            parent_id: 'business_1',
            is_leaf: false,
            is_default: true,
            expandable: true,
            child_count: 1,
            children: [],
          },
        ],
      },
    ]);

    expect(businessNode.children?.map((node) => node.title)).toEqual(['空闲机池', '业务集群']);
    expect(businessNode.children?.[0].backendType).toBe(BackendNodeType.IdleSet);
  });
});
