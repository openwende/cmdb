import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import AuditTable from '@/pages/Analysis/Audit/AuditList';
import { processDetailList } from '@/pages/Analysis/utils';

const { getResourceDirectoryTree } = vi.hoisted(() => ({
  getResourceDirectoryTree: vi.fn(),
}));

vi.mock('react-i18next', async () => {
  const i18next = (await import('i18next')).default;
  const zhCN = (await import('@/locales/zh-CN.json')).default;
  const instance = i18next.createInstance();
  await instance.init({
    resources: { 'zh-CN': { translation: zhCN } },
    lng: 'zh-CN',
    interpolation: { escapeValue: false },
  });
  const t = instance.getFixedT('zh-CN');
  return { useTranslation: () => ({ t }) };
});

vi.mock('@/api/services/business', () => ({
  getResourceDirectoryTree,
}));

const RECLAIM_622 = {
  id: 622,
  audit_type: 'host',
  user: 'chenjing',
  resource_type: 'host',
  action: 'update',
  operation_detail: {
    details: {
      pre_data: {
        business_id: '1029',
        business_name: '数据中台',
        host_name: 'data-etl-05',
        module_id: 109,
        module_ids: [109],
        module_names: ['待回收'],
        primary_ip: '10.40.1.15',
      },
      cur_data: {
        directory_id: 4,
        host_name: 'data-etl-05',
        primary_ip: '10.40.1.15',
        source: 'reclaim',
      },
      update_fields: ['directory_id', 'source'],
    },
    bk_obj_id: 'host',
  },
  operation_time: '2026-09-14 09:30:00',
  bk_biz_id: 0,
  biz_name: '',
  resource_id: 81,
  resource_name: '10.40.1.15',
};

const renderList = () =>
  render(
    <AuditTable
      data={processDetailList([RECLAIM_622])}
      loading={false}
      showFilters={false}
      pagination={{ total: 1, pageSize: 20, page: 1, onChange: vi.fn(), onSizeChange: vi.fn() }}
    />,
  );

describe('audit change column', () => {
  beforeAll(() => {
    // AntD 的响应式断点依赖 matchMedia，jsdom 没有
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  });

  beforeEach(() => {
    getResourceDirectoryTree.mockReset();
  });

  it('resolves the directory name and shows the move in the list and the drawer', async () => {
    getResourceDirectoryTree.mockResolvedValue({ code: 0, data: [{ id: 4, name: '高配计算' }] });
    renderList();

    await waitFor(() =>
      expect(screen.getAllByText('数据中台 / 待回收 → 资源池 / 高配计算').length).toBeGreaterThan(
        0,
      ),
    );
    expect(screen.getAllByText('回收到资源池').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2026-09-14 17:30:00').length).toBeGreaterThan(0);
    expect(getResourceDirectoryTree).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByText('10.40.1.15')[0]);
    const flow = await screen.findByRole('region', { name: '流向' });
    expect(flow).toHaveTextContent('数据中台 / 待回收');
    expect(flow).toHaveTextContent('资源池 / 高配计算');
  });

  it('falls back to the directory id when the directory tree request fails', async () => {
    getResourceDirectoryTree.mockRejectedValue(new Error('network'));
    renderList();

    await waitFor(() => expect(getResourceDirectoryTree).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText('数据中台 / 待回收 → 资源池 / 目录 #4').length).toBeGreaterThan(0);
  });
});
