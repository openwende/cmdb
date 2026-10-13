import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostList from '@/pages/Resource/Host/HostList';

const {
  t,
  getHostList,
  mockNavigate,
  mockFetchDirectories,
  mockSetPoolHostQuery,
  mockFetchPoolHosts,
} = vi.hoisted(() => ({
  t: (key: string) => key,
  getHostList: vi.fn(async () => ({
    total: 1,
    page: 1,
    page_size: 20,
    hosts: [{ id: 'should-not-appear', primary_ip: '10.0.0.99' }],
  })),
  mockNavigate: vi.fn(),
  mockFetchDirectories: vi.fn(async () => {}),
  mockSetPoolHostQuery: vi.fn(),
  mockFetchPoolHosts: vi.fn(async () => {}),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
}));

vi.mock('antd', () => ({
  Table: ({ dataSource = [] }: any) => (
    <div>
      {dataSource.map((record: any) => (
        <div key={record.host.bk_host_id}>
          <span>{record.host.bk_host_id}</span>
          <span>{record.host.bk_host_innerip}</span>
        </div>
      ))}
    </div>
  ),
  Button: ({ children }: any) => <button type="button">{children}</button>,
  Checkbox: ({ children }: any) => <label>{children}</label>,
  Input: { Search: () => <div /> },
  Dropdown: ({ children }: any) => <div>{children}</div>,
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  Modal: { confirm: vi.fn() },
  Tooltip: ({ children }: any) => <div>{children}</div>,
  Empty: ({ description }: any) => <div>{description}</div>,
}));

vi.mock('@ant-design/icons', () => ({
  DownOutlined: () => null,
  ExclamationCircleFilled: () => null,
  HistoryOutlined: () => null,
  InboxOutlined: () => null,
  CloseOutlined: () => null,
}));

vi.mock('@/api/services/business', () => ({
  getHostList,
}));

vi.mock('@/store/DirectoryStore', () => ({
  useDirectoryStore: (selector: (state: any) => unknown) =>
    selector({
      directories: [{ bk_module_id: 1, bk_module_name: '空闲机池' }],
      fetchDirectories: mockFetchDirectories,
    }),
}));

vi.mock('@/store/PoolHostStore', () => ({
  usePoolHostStore: (selector: (state: any) => unknown) =>
    selector({
      hosts: [
        {
          host: {
            bk_host_id: 'pool-host-1',
            bk_host_innerip: '10.1.1.1',
            bk_host_innerip_v6: '',
            bk_cloud_host_status: 'running',
            bk_cloud_id: [],
          },
          module: [{ bk_module_id: 1, topo_module_name: '资源池##1' }],
          set: [{ bk_set_id: 1 }],
        },
      ],
      total: 1,
      loading: false,
      query: { page: 1, pageSize: 20 },
      setQuery: mockSetPoolHostQuery,
      fetchHosts: mockFetchPoolHosts,
    }),
}));

vi.mock('@/store/AuthStore', () => ({
  useAuthStore: (selector: any) => selector({ canWrite: () => true }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('')],
}));

vi.mock('@/pages/Resource/Host/components/AssignModal', () => ({
  default: () => null,
}));

vi.mock('@/pages/Resource/Host/components/ImportHost', () => ({
  default: () => null,
}));

vi.mock('@/pages/Resource/Host/components/HostDetailDrawer', () => ({
  default: () => null,
}));

vi.mock('@/pages/Resource/Host/hooks/useHostDetailDeepLink', () => ({
  useHostDetailDeepLink: () => ({
    displayId: null,
    open: vi.fn(),
    close: vi.fn(),
    notFound: vi.fn(),
  }),
}));

vi.mock('@/components/common/Pagination', () => ({
  default: () => <div data-testid="pagination" />,
}));

vi.mock('@/pages/Resource/utils', () => ({
  getHostCopyValue: vi.fn(() => ''),
  checkHostsInHostPool: vi.fn(() => []),
}));

describe('resource pool — pool-only view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders pool hosts and does not call the assigned-host API', async () => {
    render(<HostList selectedId={1} />);

    await waitFor(() => {
      expect(screen.getByText('pool-host-1')).toBeInTheDocument();
    });

    expect(getHostList).not.toHaveBeenCalled();
  });

  it('shows bulk actions in the toolbar instead of the directory context header', async () => {
    render(<HostList selectedId={1} />);

    await waitFor(() => {
      expect(screen.getByText('resource.host.actions.assign')).toBeInTheDocument();
    });

    expect(screen.getByText('resource.host.actions.copy')).toBeInTheDocument();
    expect(screen.getByText('resource.host.actions.more')).toBeInTheDocument();
    expect(screen.queryByText('空闲机池')).not.toBeInTheDocument();
  });
});
