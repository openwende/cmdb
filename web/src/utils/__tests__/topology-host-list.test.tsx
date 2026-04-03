import { render, screen, waitFor } from '@testing-library/react';
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
            name: 'ProbeSet-1773163724333',
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
}));

vi.mock('@/mock/business', () => ({
  allHosts2: [
    {
      host: {
        bk_host_id: 1,
        bk_host_innerip: '192.168.0.2',
        bk_host_innerip_v6: '',
        bk_cloud_id: [{ bk_inst_id: 90000001, bk_inst_name: '未分配' }],
      },
      module: [{ bk_module_name: 'game', topo_module_name: 'game' }],
      set: [{ bk_set_id: 2, bk_set_name: '2' }],
    },
  ],
}));

vi.mock('@/store/TransferHostStore', () => ({
  useTransferHostStore: () => ({
    idleSetID: null,
    setTransferHostData: mockSetTransferHostData,
  }),
}));

vi.mock('antd', () => ({
  Table: ({ dataSource = [] }: any) => (
    <div>
      {dataSource.map((record: any) => (
        <div key={record.host.bk_host_id}>
          <span>{record.host.bk_host_id}</span>
          <span>{record.host.bk_host_innerip}</span>
          <span>{record.module[0]?.bk_module_name || record.module[0]?.topo_module_name || '--'}</span>
          <span>{record.set[0]?.bk_set_name || '--'}</span>
        </div>
      ))}
    </div>
  ),
  Button: ({ children }: any) => <button type="button">{children}</button>,
  Dropdown: ({ children }: any) => <div>{children}</div>,
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

describe('business topology host list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads set hosts from topology host api instead of legacy mock rows', async () => {
    render(
      <HostList
        selectedNode={{
          title: 'ProbeSet-1773163724333',
          key: 'set-4',
          nodeId: '4',
          type: TopoTreeNodeType.Set,
          backendType: 'set',
          children: [
            {
              title: 'SmokeModule-1773163733771',
              key: 'module-3',
              nodeId: '3',
              type: TopoTreeNodeType.Module,
              backendType: 'module',
            },
          ],
        }}
        parentNodes={[]}
        onTopologyChanged={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('real-host-1')).toBeInTheDocument();
    });

    expect(getTopologyNodeHosts).toHaveBeenCalledWith('set-4', {
      page: 1,
      page_size: 20,
      keyword: '',
    });
    expect(screen.getByText('SmokeModule-1773163733771')).toBeInTheDocument();
    expect(screen.getByText('ProbeSet-1773163724333')).toBeInTheDocument();
    expect(screen.queryByText('game')).not.toBeInTheDocument();
    expect(screen.queryByText('otherBusiness')).not.toBeInTheDocument();
  });
});
