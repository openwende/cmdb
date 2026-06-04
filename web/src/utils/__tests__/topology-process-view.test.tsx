import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Process from '@/pages/Business/BusinessTopology/ServiceInstance/Process';

const { t, listProcesses, getProcess } = vi.hoisted(() => ({
  t: (key: string) => key,
  listProcesses: vi.fn(async () => ({
    code: 0,
    data: {
      items: [
        {
          id: 11,
          process_name: 'real-process',
          description: 'loaded from api',
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
  getProcess: vi.fn(async (id: number) => ({
    code: 0,
    data: {
      id,
      process_name: 'real-process',
      description: 'loaded from api',
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
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t,
  }),
}));

vi.mock('@/api/services/business', () => ({
  listProcesses,
  getProcess,
  updateProcess: vi.fn(),
  deleteProcess: vi.fn(),
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
    Form: ({ children }: any) => <form>{children}</form>,
    Input: ({ defaultValue, value, placeholder }: any) => (
      <input defaultValue={defaultValue} value={value} placeholder={placeholder} readOnly />
    ),
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
    Popconfirm: ({ children }: any) => <div>{children}</div>,
    // 进程表空数据初次渲染走 locale.emptyText=<TableEmpty/>，后者用 antd Empty。
    Empty: ({ description }: any) => <div>{description}</div>,
  };
});

describe('business topology process view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads grouped processes from the real process api instead of mock rows', async () => {
    render(
      <Process
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
      expect(screen.getAllByText('real-process').length).toBeGreaterThan(0);
    });

    expect(listProcesses).toHaveBeenCalledWith({
      module_id: 3,
      page: 1,
      page_size: 20,
    });
    expect(screen.queryByText('devTest')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('SmokeModule-1773163733771'));

    await waitFor(() => {
      expect(getProcess).toHaveBeenCalledWith(11);
    });

    expect(
      screen.getByText((content) => content.includes('loaded from api')),
    ).toBeInTheDocument();
    expect(screen.getByText('10.1.1.10')).toBeInTheDocument();
    expect(screen.getByText('8080')).toBeInTheDocument();
  });
});
