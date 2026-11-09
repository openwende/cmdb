import { beforeEach, describe, expect, it } from 'vitest';

import { useDirectoryStore } from '@/store/DirectoryStore';
import { usePoolHostStore } from '@/store/PoolHostStore';

describe('resource pool scene store', () => {
  beforeEach(() => {
    useDirectoryStore.getState().reset();
    usePoolHostStore.getState().reset();
  });

  it('refreshes host list when active directory changes', async () => {
    await useDirectoryStore.getState().setActiveDirectory(1);

    expect(usePoolHostStore.getState().query.directoryId).toBe(1);
  });
});
