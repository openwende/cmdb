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
  reclaimTopologyHostsToPool: vi.fn(async () => ({ code: 0 })),
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
  Table: ({ dataSource = [], rowSelection, rowKey, locale }: any) => {
    const selectedKeys = rowSelection?.selectedRowKeys ?? [];
    const resolvedKey = (record: any) =>
      typeof rowKey === 'function' ? rowKey(record) : record[rowKey ?? 'key'];
    const allKeys = dataSource.map((record: any) => resolvedKey(record));
    const allChecked = allKeys.length > 0 && selectedKeys.length === allKeys.length;

    if (!dataSource.length) {
      return <div>{locale?.emptyText ?? null}</div>;
    }

    return (
      <div>
        <label>
          <input
            data-testid="host-select-all"
            type="checkbox"
            checked={allChecked}
            onChange={(event) => rowSelection?.onChange?.(event.target.checked ? allKeys : [])}
          />
          select-all
        </label>
        {dataSource.map((record: any) => {
          const key = resolvedKey(record);
          const checked = selectedKeys.includes(key);
          return (
            <div key={key}>
              <label>
                <input
                  aria-label={`select-host-${key}`}
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => {
                    const nextKeys = event.target.checked
                      ? [...selectedKeys, key]
                      : selectedKeys.filter((item: unknown) => item !== key);
                    rowSelection?.onChange?.(nextKeys);
                  }}
                />
                select-host
              </label>
              <span>{record.host.bk_host_id}</span>
              <span>{record.host.bk_host_innerip}</span>
              <span>
                {record.module[0]?.bk_module_name || record.module[0]?.topo_module_name || '--'}
              </span>
              <span>{record.set[0]?.bk_set_name || '--'}</span>
            </div>
          );
        })}
      </div>
    );
  },
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Dropdown: ({ children, disabled, menu }: any) => (
    <div>
      {children}
      <div>
        {menu?.items?.map((item: any) => (
          <button
            key={item.key}
            data-testid={`dropdown-item-${item.key}`}
            disabled={disabled || item.disabled}
            onClick={() => menu.onClick?.({ key: item.key })}
            type="button"
          >
            {typeof item.label === 'string' ? item.label : item.key}
          </button>
        ))}
      </div>
    </div>
  ),
  Input: {
    Search: ({ value, onChange, onSearch, placeholder }: any) => (
      <input
        aria-label={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onSearch?.((event.target as HTMLInputElement).value);
          }
        }}
      />
    ),
  },
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  Tooltip: ({ children }: any) => <div>{children}</div>,
  Empty: ({ children, description }: any) => (
    <div>
      <div>{description}</div>
      {children}
    </div>
  ),
  Checkbox: ({ checked, onChange, children, ...props }: any) => (
    <label>
      <input type="checkbox" checked={checked} onChange={(event) => onChange?.(event)} {...props} />
      {children}
    </label>
  ),
  Spin: () => <div data-testid="spin" />,
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

  it('does not load or display hosts on set nodes', async () => {
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

    expect(getTopologyNodeHosts).not.toHaveBeenCalled();
    expect(screen.queryByText('real-host-1')).not.toBeInTheDocument();
    expect(screen.queryByText('10.1.1.10')).not.toBeInTheDocument();
    expect(screen.queryByText('game')).not.toBeInTheDocument();
    expect(screen.queryByText('otherBusiness')).not.toBeInTheDocument();
    expect(screen.queryByText('business.topology.workspace.currentNode')).not.toBeInTheDocument();
    expect(screen.queryByText('business.topology.workspace.hostList')).not.toBeInTheDocument();
    expect(
      screen.getAllByText('business.topology.hostList.empty.selectModuleFirst').length,
    ).toBeGreaterThan(0);
  });

  it('keeps bulk actions in the top toolbar after the add button and enables them when hosts are selected', async () => {
    render(
      <HostList
        selectedNode={{
          title: 'SmokeModule-1773163733771',
          key: 'module-3',
          nodeId: '3',
          type: TopoTreeNodeType.Module,
          backendType: 'module',
        }}
        parentNodes={[
          {
            title: 'ProbeSet-1773163724333',
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
      expect(screen.getByText('real-host-1')).toBeInTheDocument();
    });

    const toolbarButtonsBefore = screen.getAllByRole('button').map((button) => button.textContent);
    expect(toolbarButtonsBefore).toContain('business.topology.hostList.buttons.add');
    expect(toolbarButtonsBefore).toContain('business.topology.hostList.buttons.transferTo ');
    expect(toolbarButtonsBefore).toContain('business.topology.hostList.buttons.appendTo ');
    expect(toolbarButtonsBefore).toContain('business.topology.hostList.buttons.removeFrom ');
    expect(toolbarButtonsBefore).toContain('business.topology.hostList.buttons.copy ');
    expect(toolbarButtonsBefore).not.toContain('business.topology.hostList.buttons.edit');

    fireEvent.click(screen.getByLabelText('select-host-real-host-1'));

    expect(
      screen.getByText(
        'business.topology.hostList.pagination.selected 1 business.topology.hostList.pagination.items',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('business.topology.hostList.buttons.transferTo')).toBeInTheDocument();
    expect(screen.getByText('business.topology.hostList.buttons.appendTo')).toBeInTheDocument();
    expect(screen.getByText('business.topology.hostList.buttons.removeFrom')).toBeInTheDocument();
    expect(screen.queryByTestId('hostlist-floating-actions')).not.toBeInTheDocument();
  });

  it('only allows adding hosts on module nodes', async () => {
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

    expect(
      screen.getByRole('button', { name: 'business.topology.hostList.buttons.add' }),
    ).toBeDisabled();
    expect(getTopologyNodeHosts).not.toHaveBeenCalled();
    expect(screen.queryByText('real-host-1')).not.toBeInTheDocument();
  });

  it('allows releasing selected hosts from idle modules to host pool even when the row has no set metadata', async () => {
    getTopologyNodeHosts.mockResolvedValueOnce({
      code: 0,
      data: {
        items: [
          {
            host_id: 'idle-host-1',
            inner_ipv4: '10.252.2.142',
            inner_ipv6: '',
            cloud_area: {
              id: 'cloud-1',
              name: '默认云区域',
            },
            module: {
              id: 5,
              name: '空闲机',
            },
            set: undefined as any,
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
    });

    render(
      <HostList
        selectedNode={{
          title: '空闲机',
          key: 'idle_module-5',
          nodeId: '5',
          type: TopoTreeNodeType.Module,
          backendType: 'idle_module',
        }}
        parentNodes={[]}
        onTopologyChanged={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('idle-host-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('select-host-idle-host-1'));

    expect(screen.getByTestId('dropdown-item-hostPool')).toBeEnabled();
    expect(screen.getByTestId('dropdown-item-idlePool')).toBeDisabled();
  });
});
