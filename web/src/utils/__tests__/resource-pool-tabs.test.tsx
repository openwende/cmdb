import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostList from '@/pages/Resource/Host/HostList';
import { TabsKey } from '@/pages/Resource/Types';

const {
  t,
  getHostList,
  mockNavigate,
  mockFetchDirectories,
  mockSetPoolHostQuery,
  mockFetchPoolHosts,
  mockSetTransferHostData,
} = vi.hoisted(() => ({
  t: (key: string) => key,
  getHostList: vi.fn(async () => ({
    total: 1,
    page: 1,
    page_size: 20,
    hosts: [
      {
        id: 'real-host-1',
        primary_ip: '10.0.0.10',
        ip_addresses: [],
        status: 'running',
        cloud_area_id: 'cloud-1',
        business_ids: ['biz-1'],
        module_ids: [101],
      },
    ],
  })),
  mockNavigate: vi.fn(),
  mockFetchDirectories: vi.fn(async () => {}),
  mockSetPoolHostQuery: vi.fn(),
  mockFetchPoolHosts: vi.fn(async () => {}),
  mockSetTransferHostData: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t,
  }),
}));

vi.mock('antd', () => ({
  Table: ({ dataSource = [] }: any) => (
    <div>
      {dataSource.map((record: any) => (
        <div key={record.host.bk_host_id}>
          <span>{record.host.bk_host_id}</span>
          <span>{record.host.bk_host_innerip}</span>
          <span>{record.module[0]?.topo_module_name || '--'}</span>
        </div>
      ))}
    </div>
  ),
  Button: ({ children }: any) => <button type="button">{children}</button>,
  Input: { Search: () => <div /> },
  Dropdown: ({ children }: any) => <div>{children}</div>,
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  Modal: { confirm: vi.fn() },
  Tooltip: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@ant-design/icons', () => ({
  DownOutlined: () => null,
  ExclamationCircleFilled: () => null,
  HistoryOutlined: () => null,
}));

vi.mock('@/mock/resource', () => ({
  assignedListMock: [
    {
      host: {
        bk_host_id: 'mock-host-1',
        bk_host_innerip: '10.0.0.2',
        bk_host_innerip_v6: '',
        bk_cloud_host_status: '--',
        bk_cloud_id: [],
      },
      module: [
        {
          bk_module_id: 2,
          topo_module_name: 'business2/set2/module2',
        },
      ],
      set: [],
    },
  ],
  allListMock: [],
}));

vi.mock('@/api/services/business', () => ({
  getHostList,
}));

vi.mock('@/store/TransferHostStore', () => ({
  useTransferHostStore: () => ({
    idleSetID: null,
    setTransferHostData: mockSetTransferHostData,
  }),
}));

vi.mock('@/store/DirectoryStore', () => ({
  useDirectoryStore: (selector: (state: any) => unknown) =>
    selector({
      directories: [],
      fetchDirectories: mockFetchDirectories,
    }),
}));

vi.mock('@/store/PoolHostStore', () => ({
  usePoolHostStore: (selector: (state: any) => unknown) =>
    selector({
      hosts: [],
      total: 0,
      loading: false,
      query: {
        page: 1,
        pageSize: 20,
      },
      setQuery: mockSetPoolHostQuery,
      fetchHosts: mockFetchPoolHosts,
    }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('')],
}));

vi.mock('@/pages/Resource/Host/components/AssignModal', () => ({
  default: () => null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/TransferHostModal', () => ({
  default: () => null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/ReleaseHostModal', () => ({
  default: () => null,
}));

vi.mock('@/pages/Resource/Host/components/ImportHost', () => ({
  default: () => null,
}));

vi.mock('@/components/common/Pagination', () => ({
  default: () => <div data-testid="pagination" />,
}));

describe('resource pool tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads assigned tab from the real host API instead of mock rows', async () => {
    render(<HostList tabKey={TabsKey.Assigned} />);

    await waitFor(() => {
      expect(screen.getByText('real-host-1')).toBeInTheDocument();
    });

    expect(screen.queryByText('business2/set2/module2')).not.toBeInTheDocument();
  });
});
