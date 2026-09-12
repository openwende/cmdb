import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSchemaCenterStore } from '@/store/SchemaCenterStore';
import axios from '@/api/axiosInstance';

vi.mock('@/api/axiosInstance', () => ({
  default: {
    get: vi.fn(async () => ({
      code: 0,
      data: {
        model_uid: 'module',
        scene: 'topology_create',
        fields: [
          {
            name: 'name',
            display_name: '名称',
            field_type: 'string',
            is_required: true,
            is_unique: false,
            is_editable: true,
            is_system: true,
            sort_order: 0,
          },
        ],
      },
    })),
  },
}));

describe('schema center store', () => {
  beforeEach(() => {
    useSchemaCenterStore.getState().reset();
    vi.clearAllMocks();
  });

  it('caches form schema by model and scene', async () => {
    await useSchemaCenterStore.getState().loadFormSchema('module', 'topology_create');

    expect(useSchemaCenterStore.getState().formSchemas['module:topology_create']).toBeDefined();
    expect(axios.get).toHaveBeenCalledWith('/v1/dynamic-models/module/form-schema', {
      params: { scene: 'topology_create' },
    });
  });
});
