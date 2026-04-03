import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostList from '@/pages/Business/BusinessTopology/HostList';
import { TopoTreeNodeType } from '@/pages/Business/Types';

const {
  t,
  getTopologyNodeHosts,
  transferTopologyHostsToPool,
  mockNavigate,
  mockSetTransferHostData,
} = vi.hoisted(() => ({
  t: (key: string) => key,
  getTopologyNodeHosts: vi.fn(async () => ({
    code: 0,
    data: {
      items: [
        {
          host_id: 'real-host-1',
          inner_ipv4: '10.1.1.10',
          inner_ipv6: '',
          cloud_area: {
            id: 'cloud-1',
            name: '默认云区域',
          },
          module: {
            id: 3,
            name: 'SmokeModule',
          },
          set: {
            id: 4,
            name: 'ProbeSet',
          },
          status: 'running',
        },
      ],
      pagination: {
        page: 1,
        page_size: 20,
        total: 1,
        total_page: 1,
      },
    },
  })),
  transferTopologyHostsToPool: vi.fn(async () => ({ code: 0 })),
  mockNavigate: vi.fn(),
  mockSetTransferHostData: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('node=set-4')],
}));

vi.mock('@/utils/routes', () => ({
  getBusinessIdFromUrl: () => 'biz-1',
  getTransferHostPath: (bizID: string) => `/business/${bizID}/topology/transfer-host`,
}));

vi.mock('@/api/services/business', () => ({
  getTopologyNodeHosts,
  transferTopologyHostsToPool,
}));

vi.mock('@/store/TransferHostStore', () => ({
  useTransferHostStore: () => ({
    idleSetID: null,
    setTransferHostData: mockSetTransferHostData,
  }),
}));

vi.mock('antd', () => ({
  Table: ({ dataSource = [], rowSelection }: any) => (
    <div>
      {dataSource.map((record: any) => (
        <div key={record.host.bk_host_id}>{record.host.bk_host_innerip}</div>
      ))}
      <button
        type="button"
        onClick={() =>
          rowSelection?.onChange?.(dataSource.map((record: any) => record.host.bk_host_id))
        }
      >
        select-hosts
      </button>
    </div>
  ),
  Button: ({ children, onClick, disabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Dropdown: ({ children, menu }: any) => (
    <div>
      {children}
      {menu?.items?.map((item: any) => (
        <button key={item.key} type="button" onClick={() => menu.onClick?.({ key: item.key })}>
          {item.key}
        </button>
      ))}
    </div>
  ),
  Input: { Search: () => <div /> },
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  Tooltip: ({ children }: any) => <div>{children}</div>,
  Empty: ({ children, description }: any) => (
    <div>
      <div>{description}</div>
      {children}
    </div>
  ),
  Typography: {
    Text: ({ children }: any) => <span>{children}</span>,
  },
}));

vi.mock('@ant-design/icons', () => ({
  DownOutlined: () => null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/AddHostModal', () => ({
  default: () => null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/TransferHostModal', () => ({
  default: () => null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/ReleaseHostModal', () => ({
  default: ({ visible, onConfirm }: any) =>
    visible ? (
      <button type="button" onClick={() => onConfirm(1)}>
        confirm-release
      </button>
    ) : null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/CreateNodeModal', () => ({
  default: () => null,
}));

vi.mock('@/components/common/Pagination', () => ({
  default: () => <div data-testid="pagination" />,
}));

vi.mock('@/components/common/EmptySearchResult', () => ({
  default: () => <div>empty-search</div>,
}));

describe('business topology release host modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the transfer-to-pool api when releasing selected hosts', async () => {
    render(
      <HostList
        selectedNode={{
          title: 'SmokeModule',
          key: 'module-3',
          nodeId: '3',
          type: TopoTreeNodeType.Module,
          backendType: 'module',
          children: [],
        }}
        parentNodes={[]}
        onTopologyChanged={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('10.1.1.10')).toBeInTheDocument();
    });

    expect(screen.queryByText('otherBusiness')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('select-hosts'));
    fireEvent.click(screen.getByText('hostPool'));
    fireEvent.click(screen.getByText('confirm-release'));

    await waitFor(() => {
      expect(transferTopologyHostsToPool).toHaveBeenCalledWith({
        host_ids: ['real-host-1'],
      });
    });
  });
});
