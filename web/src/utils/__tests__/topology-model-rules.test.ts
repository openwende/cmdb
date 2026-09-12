import { describe, expect, it } from 'vitest';

import { getBusinessTopologyChildModels } from '@/pages/Business/BusinessTopology/modelRules';

describe('business topology model rules', () => {
  it('always exposes builtin set under business', () => {
    const models = getBusinessTopologyChildModels('business');

    expect(models.map((model) => model.uid)).toContain('set');
  });

  it('always exposes builtin module under set and idle_set', () => {
    expect(getBusinessTopologyChildModels('set').map((model) => model.uid)).toContain('module');
    expect(getBusinessTopologyChildModels('idle_set').map((model) => model.uid)).toContain(
      'module',
    );
  });

  it('merges custom child models without duplicating builtin ones', () => {
    const models = getBusinessTopologyChildModels('set', () => [
      {
        uid: 'module',
        display_name: '模块',
        classification: 'business',
        scope: 'business',
        is_builtin: true,
        is_topology_builtin: true,
      },
      {
        uid: 'rack',
        display_name: '机架',
        classification: 'business',
        scope: 'business',
        parent_model_uid: 'set',
        is_builtin: false,
        is_topology_builtin: false,
      },
    ]);

    expect(models.map((model) => model.uid)).toEqual(['module', 'rack']);
  });
});
