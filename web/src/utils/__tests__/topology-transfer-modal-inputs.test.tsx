import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostList from '@/pages/Business/BusinessTopology/HostList';
import { TopoTreeNodeType } from '@/pages/Business/Types';

const { t, getTopologyNodeHosts, mockNavigate, mockSetTransferHostData } = vi.hoisted(() => ({
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
            name: 'SmokeModule-1773163733771',
          },
          set: {
            id: 4,
            name: 'ProbeSet-renamed',
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
  reclaimTopologyHostsToPool: vi.fn(async () => ({ code: 0 })),
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
  Checkbox: ({ checked, onChange, children, ...props }: any) => (
    <label>
      <input type="checkbox" checked={checked} onChange={(event) => onChange?.(event)} {...props} />
      {children}
    </label>
  ),
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
  default: ({ visible, selectedHosts }: any) =>
    visible ? (
      <div>selected-hosts:{selectedHosts.map((host: any) => host.ip).join(',')}</div>
    ) : null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/ReleaseHostModal', () => ({
  default: () => null,
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

describe('business topology transfer modal inputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes selected hosts into the transfer modal even before idle metadata is loaded', async () => {
    render(
      <HostList
        selectedNode={{
          title: 's1',
          key: 'module-3',
          nodeId: '3',
          type: TopoTreeNodeType.Module,
          backendType: 'module',
        }}
        parentNodes={[
          {
            title: 'ProbeSet-renamed',
            key: 'set-4',
            nodeId: '4',
            type: TopoTreeNodeType.Set,
            backendType: 'set',
          },
        ]}
        onTopologyChanged={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText('10.1.1.10').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText('select-hosts'));
    fireEvent.click(screen.getByText('businessModule'));

    expect(screen.getByText('selected-hosts:10.1.1.10')).toBeInTheDocument();
  });
});
