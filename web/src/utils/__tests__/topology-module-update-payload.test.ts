import { describe, expect, it } from 'vitest';

import { buildModuleUpdatePayload } from '@/pages/Business/BusinessTopology/components/ModuleNodeInfo';

describe('topology module update payload', () => {
  it('uses the leaf service category id when saving a module', () => {
    expect(
      buildModuleUpdatePayload(
        { bkModuleName: 'gateway-v2' },
        [10, 11],
        { service_category_id: '2' },
      ),
    ).toEqual({
      name: 'gateway-v2',
      service_category_id: 11,
    });
  });
});
