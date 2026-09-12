import { describe, expect, it } from 'vitest';

import { filterDirectoriesByKeyword } from '@/pages/Resource/Host/Directory/search';
import {
  formatBatchImportErrors,
  getImportResponseErrors,
} from '@/pages/Resource/Host/components/ImportHost/errors';

describe('resource host directory and import regressions', () => {
  it('filters directories by keyword without changing the original list', () => {
    const directories = [
      { bk_module_id: 1, bk_module_name: '默认目录', host_count: 1 },
      { bk_module_id: 2, bk_module_name: 'test1', host_count: 0 },
    ];

    expect(filterDirectoriesByKeyword(directories, 'test')).toEqual([directories[1]]);
    expect(filterDirectoriesByKeyword(directories, '  默认  ')).toEqual([directories[0]]);
    expect(filterDirectoriesByKeyword(directories, '不存在')).toEqual([]);
    expect(filterDirectoriesByKeyword(directories, '')).toBe(directories);
  });

  it('formats backend batch import errors before falling back to frontend text', () => {
    expect(
      formatBatchImportErrors([
        {
          error: 'IP 地址重复',
          host_name: 'existing-host',
          index: 0,
        },
      ]),
    ).toEqual(['行 2 (existing-host): IP 地址重复']);
  });

  it('extracts backend import error messages from failed responses', () => {
    expect(
      getImportResponseErrors({
        response: {
          data: {
            errors: [
              {
                error: '主机名不能为空',
                index: 1,
              },
            ],
          },
        },
      }),
    ).toEqual(['行 3: 主机名不能为空']);

    expect(
      getImportResponseErrors({
        response: {
          data: {
            message: '文件格式不正确',
          },
        },
      }),
    ).toEqual(['文件格式不正确']);

    expect(getImportResponseErrors({ response: { data: {} } })).toBeUndefined();
  });
});
