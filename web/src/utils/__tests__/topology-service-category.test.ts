import { describe, expect, it } from 'vitest';

import { buildServiceCategoryOptions } from '@/pages/Business/BusinessTopology/components/ServiceCategory';

describe('topology service category options', () => {
  it('groups builtin and business categories into a two-level cascader tree', () => {
    const options = buildServiceCategoryOptions([
      { id: 1, name: 'Default', parent_id: null, root_id: 1, is_builtin: true },
      { id: 2, name: 'Default', parent_id: 1, root_id: 1, is_builtin: true },
      { id: 10, name: 'Database', parent_id: null, root_id: 10, is_builtin: false },
      { id: 11, name: 'MySQL', parent_id: 10, root_id: 10, is_builtin: false },
    ]);

    expect(options).toEqual([
      {
        value: 1,
        label: 'Default',
        children: [{ value: 2, label: 'Default' }],
      },
      {
        value: 10,
        label: 'Database',
        children: [{ value: 11, label: 'MySQL' }],
      },
    ]);
  });
});
