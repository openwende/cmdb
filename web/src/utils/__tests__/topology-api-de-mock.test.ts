import { beforeEach, describe, expect, it, vi } from 'vitest';

import axios from '@/api/axiosInstance';
import {
  batchSearchObjectAttribute,
  getAvailableModels,
  getResourceDirectoryTree,
  listServiceCategories,
  searchObjectAttribute,
} from '@/api/services/business';

vi.mock('@/api/axiosInstance', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('topology de-mock api layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads service categories from the backend', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ code: 0, data: [] });

    await listServiceCategories('biz-1');

    expect(axios.get).toHaveBeenCalledWith('/v1/service-categories', {
      params: { business_id: 'biz-1' },
    });
  });

  it('loads the resource directory tree from the backend', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({ code: 0, data: [] });

    await getResourceDirectoryTree();

    expect(axios.get).toHaveBeenCalledWith('/v1/resource-pool/directories/tree');
  });

  it('maps dynamic model attributes into topology property models', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      code: 0,
      data: [
        {
          id: 1,
          model_uid: 'module',
          field_uid: 'name',
          field_name: '名称',
          field_type: 'string',
          is_required: true,
          is_unique: false,
          is_read_only: false,
          placeholder: '请输入名称',
          unit: '',
        },
      ],
    });

    await expect(searchObjectAttribute('module')).resolves.toEqual([
      expect.objectContaining({
        bk_obj_id: 'module',
        bk_property_id: 'name',
        bk_property_name: '名称',
        bk_property_type: 'string',
      }),
    ]);
  });

  it('loads attribute maps for multiple objects and preserves injected ids', async () => {
    vi.mocked(axios.get)
      .mockResolvedValueOnce({
        code: 0,
        data: [
          {
            id: 1,
            model_uid: 'module',
            field_uid: 'name',
            field_name: '名称',
            field_type: 'string',
            is_required: true,
            is_unique: false,
            is_read_only: false,
            placeholder: '',
            unit: '',
          },
        ],
      })
      .mockResolvedValueOnce({
        code: 0,
        data: [
          {
            id: 2,
            model_uid: 'host',
            field_uid: 'inner_ip',
            field_name: '内网 IP',
            field_type: 'string',
            is_required: false,
            is_unique: false,
            is_read_only: false,
            placeholder: '',
            unit: '',
          },
        ],
      });

    const result = await batchSearchObjectAttribute({
      params: {
        bk_obj_id: { $in: ['module', 'host'] },
        bk_supplier_account: '0',
      },
      injectId: 'module',
    });

    expect(result.module[0]).toEqual(expect.objectContaining({ _is_inject_: true }));
    expect(result.host[0]).toEqual(
      expect.objectContaining({
        bk_property_id: 'inner_ip',
      }),
    );
  });

  it('maps mainline models into the legacy dynamic-group chain shape', async () => {
    vi.mocked(axios.get).mockResolvedValueOnce({
      code: 0,
      data: {
        items: [
          { uid: 'biz', display_name: '业务', parent_model_uid: null, level: 0 },
          { uid: 'set', display_name: '集群', parent_model_uid: 'biz', level: 1 },
          { uid: 'module', display_name: '模块', parent_model_uid: 'set', level: 2 },
        ],
      },
    });

    await expect(getAvailableModels()).resolves.toEqual([
      {
        bk_obj_id: 'biz',
        bk_obj_name: '业务',
        bk_supplier_account: '0',
        bk_next_obj: 'set',
        bk_next_name: '集群',
        bk_pre_obj_id: '',
        bk_pre_obj_name: '',
      },
      {
        bk_obj_id: 'set',
        bk_obj_name: '集群',
        bk_supplier_account: '0',
        bk_next_obj: 'module',
        bk_next_name: '模块',
        bk_pre_obj_id: 'biz',
        bk_pre_obj_name: '业务',
      },
      {
        bk_obj_id: 'module',
        bk_obj_name: '模块',
        bk_supplier_account: '0',
        bk_next_obj: '',
        bk_next_name: '',
        bk_pre_obj_id: 'set',
        bk_pre_obj_name: '集群',
      },
    ]);
  });
});
