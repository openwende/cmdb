import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import TransferHost from '@/pages/Business/BusinessTopology/TransferHost';

const {
  transferTopologyHosts,
  transferTopologyHostsToPool,
  mockNavigate,
  mockLocationState,
  mockSetTransferHostData,
  storeState,
} = vi.hoisted(() => ({
  transferTopologyHosts: vi.fn(async () => ({ code: 0 })),
  transferTopologyHostsToPool: vi.fn(async () => ({ code: 0 })),
  mockNavigate: vi.fn(),
  mockLocationState: {
    search: '?node=module-3&tab=hostList',
  },
  mockSetTransferHostData: vi.fn(),
  storeState: {
    selectedHosts: [{ id: 'host-1', ip: '10.1.1.10' }] as Array<{
      id: string;
      ip: string;
      sourceModuleId?: number;
    }>,
    targetModules: [
      {
        title: 's1',
        key: 'module-4',
        nodeId: '4',
        type: 'module',
        backendType: 'module',
        parentPath: ['biz-a', 'set-a'],
      },
    ],
    transferHostType: 'businessModule',
    sourceModuleId: undefined as number | undefined,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocationState,
}));

vi.mock('@/utils/routes', () => ({
  getBusinessIdFromUrl: () => 'biz-1',
  getBusinessTopologyPath: (id: string) => `/business/${id}/topology`,
}));

vi.mock('@/api/services/business', () => ({
  transferTopologyHosts,
  transferTopologyHostsToPool,
}));

vi.mock('@/store/TransferHostStore', () => ({
  useTransferHostStore: () => ({
    ...storeState,
    setTransferHostData: mockSetTransferHostData,
  }),
}));

vi.mock('@/mock/business', () => ({
  transferTarget: { nodes: [] },
  transferWithClearServiceInstance: [],
  allHosts2: [],
}));

vi.mock('antd', () => ({
  Button: ({ children, onClick, disabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Table: () => <div data-testid="table" />,
  Collapse: ({ items }: any) => (
    <div>
      {items.map((item: any) => (
        <div key={item.key}>
          <div>{item.label}</div>
          <div>{item.children}</div>
        </div>
      ))}
    </div>
  ),
  Tabs: ({ items }: any) => <div>{items?.[0]?.children}</div>,
  Space: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  Popconfirm: ({ children }: any) => <div>{children}</div>,
  message: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@ant-design/icons', () => ({
  EditOutlined: () => null,
  InfoCircleOutlined: () => null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/AddHostModal', () => ({
  default: () => null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/AddProcessModal', () => ({
  default: () => null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/TransferHostModal', () => ({
  default: () => null,
}));

beforeAll(() => {
  class MockIntersectionObserver {
    observe() {}
    disconnect() {}
  }

  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
});

describe('topology transfer host page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.selectedHosts = [{ id: 'host-1', ip: '10.1.1.10' }];
    storeState.targetModules = [
      {
        title: 's1',
        key: 'module-4',
        nodeId: '4',
        type: 'module',
        backendType: 'module',
        parentPath: ['biz-a', 'set-a'],
      },
    ];
    storeState.transferHostType = 'businessModule';
    storeState.sourceModuleId = undefined;
    mockLocationState.search = '?node=module-3&tab=hostList';
  });

  it('calls the real transfer api when confirming module transfers', async () => {
    render(<TransferHost />);

    fireEvent.click(screen.getByText('business.topology.transferHost.buttons.confirmChange'));

    await waitFor(() => {
      expect(transferTopologyHosts).toHaveBeenCalledWith({
        host_ids: ['host-1'],
        target_module_id: 4,
      });
    });
  });

  it('returns to topology with the selected node and tab query after transfer succeeds', async () => {
    render(<TransferHost />);

    fireEvent.click(screen.getByText('business.topology.transferHost.buttons.confirmChange'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/business/biz-1/topology?node=module-3&tab=hostList',
        { replace: true },
      );
    });
  });

  it('passes source module id when confirming true module-to-module transfers', async () => {
    storeState.sourceModuleId = 3;

    render(<TransferHost />);

    fireEvent.click(screen.getByText('business.topology.transferHost.buttons.confirmChange'));

    await waitFor(() => {
      expect(transferTopologyHosts).toHaveBeenCalledWith({
        host_ids: ['host-1'],
        target_module_id: 4,
        source_module_id: 3,
      });
    });
  });

  it('uses each selected host source module when transfer starts from set or business scope', async () => {
    storeState.selectedHosts = [{ id: 'host-1', ip: '10.1.1.10', sourceModuleId: 5 }];
    storeState.sourceModuleId = undefined;

    render(<TransferHost />);

    fireEvent.click(screen.getByText('business.topology.transferHost.buttons.confirmChange'));

    await waitFor(() => {
      expect(transferTopologyHosts).toHaveBeenCalledWith({
        host_ids: ['host-1'],
        target_module_id: 4,
        source_module_id: 5,
      });
    });
  });

  it('calls the real transfer-to-pool api when confirming idle-pool removals', async () => {
    storeState.transferHostType = 'currentModule';

    render(<TransferHost />);

    fireEvent.click(screen.getByText('business.topology.transferHost.buttons.confirmChange'));

    await waitFor(() => {
      expect(transferTopologyHostsToPool).toHaveBeenCalledWith({
        host_ids: ['host-1'],
      });
    });
  });

  it('routes idle-pool moves through module transfer (not transfer-to-pool) to avoid losing hosts', async () => {
    storeState.transferHostType = 'idlePool';
    storeState.targetModules = [
      {
        title: '空闲机',
        key: 'idle_module-5',
        nodeId: '5',
        type: 'module',
        backendType: 'idle_module',
        parentPath: ['biz-a', 'idle-set'],
      },
    ];

    render(<TransferHost />);

    fireEvent.click(screen.getByText('business.topology.transferHost.buttons.confirmChange'));

    // idlePool 现走模块转移（带 target_module_id），而非上交资源池——避免主机从业务拓扑"消失"（5384616）。
    await waitFor(() => {
      expect(transferTopologyHosts).toHaveBeenCalledWith({
        host_ids: ['host-1'],
        target_module_id: 5,
      });
    });
    expect(transferTopologyHostsToPool).not.toHaveBeenCalled();
  });
});
