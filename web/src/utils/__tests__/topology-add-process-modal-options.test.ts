import { describe, expect, it } from 'vitest';

import { normalizeListenIpOptions } from '@/pages/Business/BusinessTopology/components/AddProcessModal';

describe('topology add process modal listen ip options', () => {
  it('deduplicates and removes empty ip values', () => {
    expect(
      normalizeListenIpOptions(['10.0.0.1', '', '10.0.0.1', undefined, '2001:db8::1']),
    ).toEqual(['10.0.0.1', '2001:db8::1']);
  });
});
