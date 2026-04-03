import { describe, expect, it } from 'vitest';

import { flattenDirectoryTreeOptions } from '@/pages/Business/BusinessTopology/components/ReleaseHostModal';

describe('release host modal directory options', () => {
  it('flattens nested resource directory trees into select options', () => {
    const options = flattenDirectoryTreeOptions([
      {
        id: 1,
        name: '默认目录',
        children: [{ id: 2, name: '华南', children: [] }],
      },
    ]);

    expect(options).toEqual([
      { value: 1, label: '默认目录' },
      { value: 2, label: '华南' },
    ]);
  });
});
