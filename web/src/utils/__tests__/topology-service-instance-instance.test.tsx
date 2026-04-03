import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Instance from '@/pages/Business/BusinessTopology/ServiceInstance/Instance';

const {
  t,
  listProcesses,
  getModuleProcessSummary,
  getProcess,
  openInstance,
  storeState,
} = vi.hoisted(() => ({
  t: (key: string) => key,
  listProcesses: vi.fn(async () => ({
    code: 0,
    data: {
      items: [
        {
          id: 11,
          process_name: 'real-process',
          description: 'instance drawer from api',
          bind_info: [{ ip: '10.1.1.10', port: '8080', protocol: 'TCP', enable: true }],
          created_at: '2026-04-03T11:00:00Z',
          updated_at: '2026-04-03T12:00:00Z',
          process_template: {
            id: 21,
            name: 'real-process',
            start_param_regex: '--serve',
          },
        },
      ],
      pagination: {
        page: 1,
        page_size: 20,
        total: 1,
      },
    },
  })),
  getModuleProcessSummary: vi.fn(async () => ({
    code: 0,
    data: {
      total: 2,
      running: 1,
      stopped: 1,
      unknown: 0,
    },
  })),
  getProcess: vi.fn(async (id: number) => ({
    code: 0,
    data: {
      id,
      process_name: 'real-process',
      description: 'instance drawer from api',
      bind_info: [{ ip: '10.1.1.10', port: '8080', protocol: 'TCP', enable: true }],
      created_at: '2026-04-03T11:00:00Z',
      updated_at: '2026-04-03T12:00:00Z',
      process_template: {
        id: 21,
        name: 'real-process',
        start_param_regex: '--serve',
      },
    },
  })),
  openInstance: vi.fn(async () => undefined),
  storeState: {
    detail: {
      instance_key: 'module:3',
      properties: { name: 'SmokeModule-1773163733771' },
      binding_context: {
        business_id: 'biz-1',
      },
      relation_summary: {
        total: 0,
        items: [],
      },
    },
    loading: false,
    error: null,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t,
  }),
}));

vi.mock('@/api/services/business', () => ({
  listProcesses,
  getModuleProcessSummary,
  getProcess,
  updateProcess: vi.fn(),
  deleteProcess: vi.fn(),
}));

vi.mock('@/store/InstanceSceneStore', () => ({
  useInstanceSceneStore: (selector: (state: any) => unknown) =>
    selector({
      detail: storeState.detail,
      loading: storeState.loading,
      error: storeState.error,
      openInstance,
    }),
}));

vi.mock('@/components/common/Pagination', () => ({
  default: () => <div data-testid="pagination" />,
}));

vi.mock('antd', () => {
  const getValue = (record: any, dataIndex: any) => {
    if (Array.isArray(dataIndex)) {
      return dataIndex.reduce((acc, key) => acc?.[key], record);
    }
    return dataIndex ? record?.[dataIndex] : undefined;
  };

  const renderCell = (column: any, record: any) => {
    const value = getValue(record, column.dataIndex);
    return column.render ? column.render(value, record) : value ?? '--';
  };

  const Form = ({ children }: any) => <form>{children}</form>;
  Form.Item = ({ children, label }: any) => (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );

  return {
    Table: ({ columns = [], dataSource = [], rowKey, expandable, locale }: any) => {
      if (!dataSource.length) {
        return <div>{locale?.emptyText ?? null}</div>;
      }

      return (
        <div>
          {dataSource.map((record: any, index: number) => {
            const key =
              typeof rowKey === 'function'
                ? rowKey(record)
                : typeof rowKey === 'string'
                  ? record[rowKey]
                  : index;
            const expanded =
              expandable && Array.isArray(expandable.expandedRowKeys)
                ? expandable.expandedRowKeys.includes(key)
                : false;

            return (
              <div key={String(key)}>
                {columns.map((column: any, columnIndex: number) => (
                  <div key={`${String(key)}-${column.key ?? column.dataIndex ?? columnIndex}`}>
                    {renderCell(column, record)}
                  </div>
                ))}
                {expanded ? <div>{expandable.expandedRowRender(record)}</div> : null}
              </div>
            );
          })}
        </div>
      );
    },
    Button: ({ children, onClick, disabled, type }: any) => (
      <button type="button" data-type={type} onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    Space: ({ children }: any) => <div>{children}</div>,
    Drawer: ({ open, title, children }: any) =>
      open ? (
        <div>
          <div>{title}</div>
          <div>{children}</div>
        </div>
      ) : null,
    Form,
    Input: ({ defaultValue, value, placeholder }: any) => (
      <input defaultValue={defaultValue} value={value} placeholder={placeholder} readOnly />
    ),
    Modal: ({ children, open }: any) => (open ? <div>{children}</div> : null),
    message: {
      success: vi.fn(),
      info: vi.fn(),
    },
    Popconfirm: ({ children }: any) => <div>{children}</div>,
    Tag: ({ children }: any) => <span>{children}</span>,
    Empty: ({ description }: any) => <div>{description}</div>,
    Spin: () => <div>loading</div>,
  };
});

vi.mock('@ant-design/icons', () => ({
  PlusOutlined: () => null,
  EditOutlined: () => null,
  MinusOutlined: () => null,
}));

describe('business topology service instance view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses real process summary and detail apis instead of relation-summary mock data', async () => {
    render(
      <Instance
        selectedNode={{
          title: 'SmokeModule-1773163733771',
          key: 'module-3',
          nodeId: '3',
          type: 'module',
          backendType: 'module',
        }}
        selectedRowKeys={[]}
        setSelectedRowKeys={() => undefined}
        expandAll
        setExpandAll={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(getModuleProcessSummary).toHaveBeenCalledWith(3);
    });

    expect(openInstance).toHaveBeenCalledWith('module:3');
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('real-process')).toBeInTheDocument();

    fireEvent.click(screen.getByText('real-process'));

    await waitFor(() => {
      expect(getProcess).toHaveBeenCalledWith(11);
    });

    expect(
      screen.getByText((content) => content.includes('instance drawer from api')),
    ).toBeInTheDocument();
  });
});
