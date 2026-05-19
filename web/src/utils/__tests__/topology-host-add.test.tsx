import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostList from '@/pages/Business/BusinessTopology/HostList';
import { TopoTreeNodeType } from '@/pages/Business/Types';

const {
  t,
  getTopologyNodeHosts,
  transferTopologyHosts,
  mockNavigate,
  mockSetTransferHostData,
  messageSuccess,
  messageError,
} = vi.hoisted(() => ({
  t: (key: string, vars?: Record<string, unknown>) =>
    key === 'business.topology.addHostModal.messages.addSuccess'
      ? `added-${vars?.count ?? 0}`
      : key,
  getTopologyNodeHosts: vi.fn(async () => ({
    code: 0,
    data: {
      items: [],
      pagination: {
        page: 1,
        page_size: 20,
        total: 0,
        total_page: 0,
      },
    },
  })),
  transferTopologyHosts: vi.fn(async () => ({ code: 0 })),
  mockNavigate: vi.fn(),
  mockSetTransferHostData: vi.fn(),
  messageSuccess: vi.fn(),
  messageError: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('node=module-4')],
}));

vi.mock('@/utils/routes', () => ({
  getBusinessIdFromUrl: () => 'biz-1',
  getTransferHostPath: (bizID: string) => `/business/${bizID}/topology/transfer-host`,
}));

vi.mock('@/api/services/business', () => ({
  getTopologyNodeHosts,
  reclaimTopologyHostsToPool: vi.fn(async () => ({ code: 0 })),
  transferTopologyHosts,
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
  Table: () => <div />,
  Button: ({ children, onClick, disabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Dropdown: ({ children }: any) => <div>{children}</div>,
  Input: {
    Search: ({ value = '', onChange, onSearch, placeholder }: any) => (
      <div>
        <input aria-label={placeholder} value={value} onChange={(event) => onChange?.(event)} />
        <button type="button" onClick={() => onSearch?.(value)}>
          search
        </button>
      </div>
    ),
  },
  message: { success: messageSuccess, error: messageError, warning: vi.fn() },
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
  default: ({ visible, onConfirm }: any) =>
    visible ? (
      <button type="button" onClick={() => onConfirm([{ id: 'host-1', ip: '10.1.1.10' }])}>
        confirm-add-host
      </button>
    ) : null,
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

describe('business topology host add flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transfers selected hosts directly into the current module', async () => {
    const onTopologyChanged = vi.fn();

    render(
      <HostList
        selectedNode={{
          title: 's1',
          key: 'module-4',
          nodeId: '4',
          type: TopoTreeNodeType.Module,
          backendType: 'module',
        }}
        parentNodes={[]}
        onTopologyChanged={onTopologyChanged}
      />,
    );

    fireEvent.click(screen.getByText('business.topology.hostList.buttons.add'));
    fireEvent.click(screen.getByText('confirm-add-host'));

    await waitFor(() => {
      expect(transferTopologyHosts).toHaveBeenCalledWith({
        host_ids: ['host-1'],
        target_module_id: 4,
      });
    });

    expect(onTopologyChanged).toHaveBeenCalled();
    expect(messageSuccess).toHaveBeenCalledWith('added-1');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
