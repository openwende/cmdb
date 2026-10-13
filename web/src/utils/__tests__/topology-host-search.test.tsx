import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostList from '@/pages/Business/BusinessTopology/HostList';
import { TopoTreeNodeType } from '@/pages/Business/Types';

/**
 * AC3b：业务拓扑主机列表的搜索改成回车 / 点搜索按钮才触发，按键过程中不请求；
 * 搜索后页码回到第 1 页。
 */
const { t, getTopologyNodeHosts } = vi.hoisted(() => ({
  // 引用稳定：真实 useTranslation 的 t 不会每次渲染都变
  t: (key: string) => key,
  getTopologyNodeHosts: vi.fn(async () => ({
    code: 0,
    data: {
      items: [
        {
          host_id: 'uuid-43',
          display_id: 43,
          inner_ipv4: '10.20.1.11',
          inner_ipv6: '',
          cloud_area: null,
          module: { id: 97, name: '支付网关' },
          set: { id: 35, name: '生产集群' },
          status: 'running',
        },
      ],
      pagination: { page: 1, page_size: 20, total: 60, total_page: 3 },
    },
  })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('@/utils/routes', () => ({
  getBusinessIdFromUrl: () => 1027,
  getTransferHostPath: (id: number) => `/business/${id}/topology/transferHost`,
}));

vi.mock('@/api/services/business', () => ({
  getTopologyNodeHosts,
  reclaimTopologyHostsToPool: vi.fn(),
  transferTopologyHosts: vi.fn(),
}));

vi.mock('@/store/TransferHostStore', () => ({
  useTransferHostStore: () => ({ idleSetID: null, setTransferHostData: vi.fn() }),
}));

vi.mock('@/store/AuthStore', () => ({
  useAuthStore: (selector: any) => selector({ canWrite: () => true }),
}));

vi.mock('antd', () => ({
  Table: ({ dataSource = [], columns = [] }: any) => (
    <div>
      {dataSource.map((record: any) => (
        <div key={record.host.bk_host_id}>
          <span>{columns[0].render(record.host.display_id, record)}</span>
          <span>{record.host.bk_host_innerip}</span>
        </div>
      ))}
    </div>
  ),
  Button: ({ children, onClick, disabled, 'aria-label': ariaLabel }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  ),
  Dropdown: ({ children }: any) => <div>{children}</div>,
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
  Tooltip: ({ children }: any) => <div>{children}</div>,
  Empty: ({ description }: any) => <div>{description}</div>,
  Checkbox: () => null,
  Spin: () => null,
  Typography: { Text: ({ children }: any) => <span>{children}</span> },
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@ant-design/icons', () => ({ DownOutlined: () => null }));

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
  default: ({ onChange, pageSize }: any) => (
    <button type="button" onClick={() => onChange(2, pageSize)}>
      go-page-2
    </button>
  ),
}));

vi.mock('@/components/common/EmptySearchResult', () => ({
  default: () => <div>empty-search</div>,
}));

// 抽屉本身另有测试；这里只看列表把哪台主机交给了抽屉
vi.mock('@/pages/Resource/Host/components/HostDetailDrawer', () => ({
  default: ({ displayId, onClose }: any) =>
    displayId === null ? null : (
      <div data-testid="host-detail-drawer">
        {displayId}
        <button type="button" onClick={onClose}>
          close-detail
        </button>
      </div>
    ),
}));

const moduleNode = {
  title: '支付网关',
  key: 'module-97',
  nodeId: '97',
  type: TopoTreeNodeType.Module,
  backendType: 'module',
};

const renderList = () =>
  render(<HostList selectedNode={moduleNode} parentNodes={[]} onTopologyChanged={() => {}} />);

const lastParams = () => {
  const calls = getTopologyNodeHosts.mock.calls as unknown as Array<[string, any]>;
  return calls[calls.length - 1][1];
};

const searchBox = () => screen.getByLabelText('business.topology.hostList.search.placeholder');

describe('business topology host search (AC3b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not request while typing, only on Enter', async () => {
    renderList();
    await waitFor(() => expect(getTopologyNodeHosts).toHaveBeenCalledTimes(1));

    fireEvent.change(searchBox(), { target: { value: '1' } });
    fireEvent.change(searchBox(), { target: { value: '10.20' } });
    // 按键过程中不发请求
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getTopologyNodeHosts).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(searchBox(), { key: 'Enter' });
    await waitFor(() => expect(getTopologyNodeHosts).toHaveBeenCalledTimes(2));
    expect(lastParams()).toEqual({ page: 1, page_size: 20, keyword: '10.20' });
  });

  it('sends no keyword when the box is empty or blank', async () => {
    renderList();
    await waitFor(() => expect(getTopologyNodeHosts).toHaveBeenCalledTimes(1));
    expect(lastParams()).toEqual({ page: 1, page_size: 20 });

    fireEvent.change(searchBox(), { target: { value: 'pay' } });
    fireEvent.keyDown(searchBox(), { key: 'Enter' });
    await waitFor(() => expect(lastParams()).toMatchObject({ keyword: 'pay' }));

    // 删成空白后回车：恢复全部，不带 keyword
    fireEvent.change(searchBox(), { target: { value: '   ' } });
    fireEvent.keyDown(searchBox(), { key: 'Enter' });
    await waitFor(() => expect(lastParams()).toEqual({ page: 1, page_size: 20 }));
  });

  it('goes back to page 1 when searching from page 2', async () => {
    renderList();
    await waitFor(() => expect(screen.getAllByText('10.20.1.11').length).toBeGreaterThan(0));

    fireEvent.click(screen.getByText('go-page-2'));
    await waitFor(() => expect(lastParams()).toMatchObject({ page: 2 }));

    fireEvent.change(searchBox(), { target: { value: 'pay' } });
    fireEvent.keyDown(searchBox(), { key: 'Enter' });
    await waitFor(() => expect(lastParams()).toEqual({ page: 1, page_size: 20, keyword: 'pay' }));
  });

  it('opens the host detail drawer from the host ID cell', async () => {
    renderList();
    const idLink = await screen.findByRole('button', { name: 'resource.host.aria.openDetail' });
    expect(idLink).toHaveTextContent('43');
    expect(screen.queryByTestId('host-detail-drawer')).not.toBeInTheDocument();

    fireEvent.click(idLink);
    expect(screen.getByTestId('host-detail-drawer')).toHaveTextContent('43');

    fireEvent.click(screen.getByText('close-detail'));
    expect(screen.queryByTestId('host-detail-drawer')).not.toBeInTheDocument();
  });
});
