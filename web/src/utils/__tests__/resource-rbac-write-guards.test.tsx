import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BusinessList from '@/pages/Resource/Business/BusinessList';
import HostList from '@/pages/Resource/Host/HostList';
import ModelList from '@/pages/Resource/Model/ModelList';

let mockCanWrite = false;
const mockNavigate = vi.fn();
const mockFetchHosts = vi.fn();
const mockFetchDirectories = vi.fn();
const mockSetPoolHostQuery = vi.fn();
const mockDirectories: any[] = [];
const mockPoolHosts = [
  {
    host: {
      bk_host_id: 'host-1',
      bk_host_innerip: '10.0.0.1',
      bk_host_innerip_v6: '',
      bk_cloud_host_status: 'running',
      bk_cloud_id: [],
    },
    module: [],
    set: [],
    business_ids: [],
    module_ids: [],
  },
];
const mockPoolHostQuery = {
  page: 1,
  pageSize: 20,
  directoryId: 1,
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ search: '' }),
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('@/store/AuthStore', () => ({
  useAuthStore: (selector: any) => {
    const state = {
      canWrite: () => mockCanWrite,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/api', () => ({
  getBusinessList: vi.fn(async () => ({
    data: {
      items: [
        {
          id: 1001,
          name: 'ProbeBiz',
          sres: ['alice'],
          lifecycle: 'active',
          created_at: '2026-04-23T08:00:00Z',
          created_by: 'admin',
          updated_at: '2026-04-23T09:00:00Z',
        },
      ],
    },
  })),
  updateBusiness: vi.fn(),
  getHostList: vi.fn(async () => ({
    hosts: [],
    total: 0,
  })),
  createModel: vi.fn(),
  listModelGroups: vi.fn(async () => [
    {
      id: 'group-1',
      display_name: '基础模型',
      model_count: 1,
    },
  ]),
  listModels: vi.fn(async () => [
    {
      id: 'model-1',
      name: 'service',
      display_name: '服务',
      classification: 'instance',
      group_id: 'group-1',
      group_display_name: '基础模型',
      group_name: 'basic',
      icon: '',
      is_mainline: false,
      mainline_scope: '',
      mainline_level: null,
      updated_at: '2026-04-23T09:00:00Z',
      description: 'service model',
    },
  ]),
}));

vi.mock('@/store/DirectoryStore', () => ({
  useDirectoryStore: (selector: any) => {
    const state = {
      directories: mockDirectories,
      fetchDirectories: mockFetchDirectories,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/store/PoolHostStore', () => ({
  usePoolHostStore: (selector: any) => {
    const state = {
      hosts: mockPoolHosts,
      total: 1,
      loading: false,
      query: mockPoolHostQuery,
      setQuery: mockSetPoolHostQuery,
      fetchHosts: mockFetchHosts,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/store/TransferHostStore', () => ({
  useTransferHostStore: () => ({
    idleSetID: null,
    setTransferHostData: vi.fn(),
  }),
}));

vi.mock('@/pages/Resource/utils', () => ({
  getHostCopyValue: vi.fn(() => '10.0.0.1'),
  checkHostsInHostPool: vi.fn(() => []),
}));

vi.mock('@/pages/Business/utils', () => ({
  checkHostsInIdlePool: vi.fn(() => []),
}));

vi.mock('@/utils/routes', () => ({
  getTransferHostPath: '/business/mock/topology/transfer-host',
}));

vi.mock('@/pages/Resource/Host/components/AssignModal', () => ({
  default: () => null,
}));

vi.mock('@/pages/Resource/Host/components/ImportHost', () => ({
  default: () => null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/TransferHostModal', () => ({
  default: () => null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/ReleaseHostModal', () => ({
  default: () => null,
}));

vi.mock('@/pages/Resource/Business/components/ModifyDrawer', () => ({
  default: () => null,
}));

vi.mock('@/pages/Resource/Model/components/CreateModelDrawer', () => ({
  default: () => null,
}));

vi.mock('@/components/common/Pagination', () => ({
  default: () => null,
}));

vi.mock('@/components/common/ConfirmModal', () => ({
  default: () => null,
}));

vi.mock('antd', () => {
  const Select = ({ children, value, onChange }: any) => (
    <select value={value} onChange={(event) => onChange?.(event.target.value)}>
      {children}
    </select>
  );
  Select.Option = ({ children, value }: any) => <option value={value}>{children}</option>;

  const Space = ({ children, className }: any) => <div className={className}>{children}</div>;
  Space.Compact = ({ children }: any) => <div>{children}</div>;

  const Table = ({ dataSource = [], columns = [], rowSelection, rowKey, locale }: any) => {
    const getKey = (record: any, index: number) => {
      if (typeof rowKey === 'function') return rowKey(record);
      if (typeof rowKey === 'string') return record[rowKey];
      return record.id ?? index;
    };

    return (
      <div>
        {rowSelection ? (
          <button
            type="button"
            data-testid="select-all-hosts"
            onClick={() => rowSelection.onChange?.(dataSource.map(getKey), dataSource)}
          >
            select-all
          </button>
        ) : null}
        {!dataSource.length ? (
          <div>{locale?.emptyText ?? 'empty'}</div>
        ) : (
          dataSource.map((record: any, index: number) => (
            <div key={getKey(record, index)}>
              {columns.map((column: any, columnIndex: number) => {
                const value = column.dataIndex ? record[column.dataIndex] : undefined;
                const content = column.render ? column.render(value, record, index) : value;
                return <div key={column.key || column.dataIndex || columnIndex}>{content}</div>;
              })}
            </div>
          ))
        )}
      </div>
    );
  };

  return {
    Table,
    Button: ({ children, onClick, disabled, className, icon, ...props }: any) => (
      <button type="button" onClick={onClick} disabled={disabled} className={className} {...props}>
        {icon}
        {children}
      </button>
    ),
    Input: {
      Search: ({ value, onChange, placeholder }: any) => (
        <input aria-label={placeholder} value={value} onChange={onChange} />
      ),
    },
    Dropdown: ({ children }: any) => <div>{children}</div>,
    Tooltip: ({ children }: any) => <div>{children}</div>,
    Checkbox: ({ children, checked, onChange }: any) => (
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={children} />
    ),
    Space,
    Select,
    DatePicker: {
      RangePicker: () => <div>range-picker</div>,
    },
    Spin: () => <div>loading</div>,
    Empty: ({ description }: any) => <div>{description}</div>,
    Tag: ({ children }: any) => <span>{children}</span>,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
    Modal: {
      confirm: vi.fn(),
    },
  };
});

vi.mock('@ant-design/icons', () => ({
  HistoryOutlined: () => null,
  DownOutlined: () => null,
  ExclamationCircleFilled: () => null,
  UnorderedListOutlined: () => null,
  AppstoreOutlined: () => null,
  ApartmentOutlined: () => null,
  InboxOutlined: () => null,
  CloseOutlined: () => null,
}));

describe('resource page RBAC write guards', () => {
  beforeEach(() => {
    mockCanWrite = false;
    vi.clearAllMocks();
  });

  it('disables business write actions for viewer users', async () => {
    render(<BusinessList />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'resource.business.actions.create' }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'resource.business.actions.create' })).toBeDisabled();
    // batchEdit 入口已被产品下线（BusinessList 中整段注释，见 0cbac30），viewer 自然看不到。
    expect(screen.queryByText('resource.business.actions.batchEdit')).not.toBeInTheDocument();
    expect(screen.queryByText('resource.business.actions.archive')).not.toBeInTheDocument();
  });

  it('blocks host write entry points for viewer users', async () => {
    render(<HostList selectedId={1} />);

    await waitFor(() => {
      expect(screen.getByTestId('select-all-hosts')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('select-all-hosts'));

    expect(
      screen.queryByRole('button', { name: 'resource.host.actions.importHost' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resource.host.actions.assign/ })).toBeDisabled();
    expect(screen.queryByText('resource.host.actions.more')).not.toBeInTheDocument();
  });

  it('disables model management actions for viewer users', async () => {
    render(<ModelList />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'resource.model.actions.create' }),
      ).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'resource.model.actions.create' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'resource.model.actions.manageGroups' }),
    ).toBeDisabled();
  });
});
