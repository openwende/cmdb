import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostList from '@/pages/Business/BusinessTopology/HostList';
import { TopoTreeNodeType } from '@/pages/Business/Types';

const {
  t,
  getTopologyNodeHosts,
  reclaimTopologyHostsToPool,
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
  reclaimTopologyHostsToPool: vi.fn(async () => ({ code: 0 })),
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
  reclaimTopologyHostsToPool,
}));

vi.mock('@/store/TransferHostStore', () => ({
  useTransferHostStore: () => ({
    idleSetID: null,
    setTransferHostData: mockSetTransferHostData,
  }),
}));

vi.mock('@/store/AuthStore', () => ({
  useAuthStore: (selector: any) =>
    selector
      ? selector({
          canWrite: () => true,
        })
      : {
          canWrite: () => true,
        },
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
  Checkbox: ({ checked, onChange, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange?.({ target: { checked: event.target.checked } })}
      {...props}
    />
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
  Spin: () => <div data-testid="spin" />,
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

vi.mock('@/pages/Resource/Host/components/HostDetailDrawer', () => ({
  default: () => null,
}));

describe('business topology release host modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the resource-pool reclaim api with the selected directory when releasing hosts', async () => {
    render(
      <HostList
        selectedNode={{
          title: '空闲机',
          key: 'idle_module-5',
          nodeId: '5',
          type: TopoTreeNodeType.Module,
          backendType: 'idle_module',
          children: [],
        }}
        parentNodes={[]}
        onTopologyChanged={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('10.1.1.10').length).toBeGreaterThan(0);
    });

    expect(screen.queryByText('otherBusiness')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('select-hosts'));
    fireEvent.click(screen.getByText('hostPool'));
    fireEvent.click(screen.getByText('confirm-release'));

    await waitFor(() => {
      expect(reclaimTopologyHostsToPool).toHaveBeenCalledWith({
        host_ids: ['real-host-1'],
        directory_id: 1,
      });
    });
  });
});
