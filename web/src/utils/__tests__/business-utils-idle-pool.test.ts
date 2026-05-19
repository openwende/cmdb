import { describe, expect, it } from 'vitest';

import { checkHostsInIdlePool } from '@/pages/Business/utils';

describe('business topology host utilities', () => {
  it('ignores selected host ids that are no longer in the current list', () => {
    const result = checkHostsInIdlePool(['missing-host'], [], 5);

    expect(result).toEqual([]);
  });
});
