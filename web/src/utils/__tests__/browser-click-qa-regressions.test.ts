import { describe, expect, it, vi } from 'vitest';
import routes from '@/routes';
import { AUDIT_TAB_KEYS } from '@/pages/Analysis/constants';
import { filterOperationDetails } from '@/pages/Analysis/utils';
import { mockOperationDetails } from '@/mock/Analysis';
import { downloadHostImportTemplate, importHostFile } from '@/api/services/business';
import axios from '@/api/axiosInstance';

vi.mock('@/api/axiosInstance', () => ({
  default: {
    get: vi.fn(async () => new Blob(['template'])),
    post: vi.fn(async () => ({ success: true })),
  },
}));

const findRoute = (path: string, items: any[] = routes): any | undefined => {
  for (const item of items) {
    if (item.path === path) {
      return item;
    }
    const child = item.children ? findRoute(path, item.children) : undefined;
    if (child) {
      return child;
    }
  }
  return undefined;
};

describe('browser click QA regressions', () => {
  it('keeps parent navigation routes wired to default child pages', () => {
    expect(findRoute('/model')?.children?.some((child: any) => child.index)).toBe(true);
    expect(findRoute('/analysis')?.children?.some((child: any) => child.index)).toBe(true);
    expect(findRoute('/admin')?.children?.some((child: any) => child.index)).toBe(true);
  });

  it('filters stale audit rows out of the default current time range', () => {
    const filtered = filterOperationDetails(mockOperationDetails, AUDIT_TAB_KEYS.HOST, {
      timeRange: ['2026-04-04', '2026-05-04'],
    });

    expect(filtered).toHaveLength(0);
  });

  it('does not leak host audit rows into business or resource tabs', () => {
    expect(filterOperationDetails(mockOperationDetails, AUDIT_TAB_KEYS.BUSINESS, {})).toHaveLength(0);
    expect(filterOperationDetails(mockOperationDetails, AUDIT_TAB_KEYS.RESOURCE, {})).toHaveLength(0);
  });

  it('submits host import files through the API instead of random mock results', async () => {
    const file = new File(['probe'], 'hosts.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    await importHostFile({
      file,
      directoryId: 12,
      uniqueKey: 'cloud_area_id_primary_ip',
      importRelated: true,
      relatedModelKeys: ['service'],
    });

    expect(axios.post).toHaveBeenCalledWith(
      '/v1/hosts/import',
      expect.any(FormData),
      expect.objectContaining({
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }),
    );

    const formData = vi.mocked(axios.post).mock.calls[0][1] as FormData;
    expect(formData.get('file')).toBe(file);
    expect(JSON.parse(String(formData.get('params')))).toEqual({
      directory_id: 12,
      unique_key: 'cloud_area_id_primary_ip',
      import_related: true,
      related_model_keys: ['service'],
    });
  });

  it('downloads host import templates from the schema-driven backend endpoint', async () => {
    const blob = await downloadHostImportTemplate({
      directoryId: 12,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(axios.get).toHaveBeenCalledWith(
      '/v1/hosts/import/template',
      expect.objectContaining({
        params: {
          directory_id: 12,
        },
        responseType: 'blob',
        headers: {
          Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      }),
    );
  });
});
