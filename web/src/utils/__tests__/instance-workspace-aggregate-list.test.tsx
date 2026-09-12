import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import InstanceWorkspace from '@/pages/Resource/Model/components/InstanceWorkspace';

const {
  mockOpenInstance,
  mockResetInstanceScene,
  mockLoadInstanceCapabilities,
  mockResetInstanceCapabilities,
  listAggregateInstances,
} = vi.hoisted(() => ({
  mockOpenInstance: vi.fn(async () => {}),
  mockResetInstanceScene: vi.fn(),
  mockLoadInstanceCapabilities: vi.fn(async () => {}),
  mockResetInstanceCapabilities: vi.fn(),
  listAggregateInstances: vi.fn(async () => ({
    code: 0,
    data: {
      items: [
        {
          instance_key: 'set:2',
          model: {
            model_uid: 'set',
            display_name: '集群',
          },
          properties: {
            name: 'SmokeSet3',
            description: 'topology smoke set',
          },
          binding_context: {
            source: 'mainline',
            topology_bound: true,
            business_id: 'biz-1',
            ref_id: '2',
          },
          allowed_actions: ['view_relations', 'view_history'],
        },
      ],
      pagination: {
        total: 1,
        page: 1,
        page_size: 20,
        total_page: 1,
      },
    },
  })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('antd', () => {
  const Button = ({ children, onClick, disabled }: any) => (
    <button onClick={onClick} disabled={disabled} type="button">
      {children}
    </button>
  );

  const Table = ({ dataSource = [], columns = [], locale }: any) => {
    if (!dataSource.length) {
      return <div>{locale?.emptyText || 'empty'}</div>;
    }

    return (
      <div>
        {dataSource.map((record: any, rowIndex: number) => (
          <div key={record.instance_key || record.id || rowIndex}>
            {columns.map((column: any, columnIndex: number) => {
              const value = column.dataIndex ? record[column.dataIndex] : undefined;
              const content = column.render ? column.render(value, record, rowIndex) : value;
              return <div key={column.key || column.dataIndex || columnIndex}>{content}</div>;
            })}
          </div>
        ))}
      </div>
    );
  };

  const Tabs = ({ items = [], activeKey }: any) => {
    const activeItem = items.find((item: any) => item.key === activeKey) || items[0];
    return <div>{activeItem?.children || null}</div>;
  };

  const Drawer = ({ open, children }: any) => (open ? <div>{children}</div> : null);

  const DescriptionsItem = ({ children }: any) => <div>{children}</div>;
  const Descriptions = ({ children }: any) => <div>{children}</div>;
  Descriptions.Item = DescriptionsItem;

  return {
    Alert: ({ message }: any) => <div>{message}</div>,
    Button,
    Descriptions,
    Drawer,
    Empty: ({ description }: any) => <div>{description}</div>,
    Popconfirm: ({ children }: any) => <div>{children}</div>,
    Select: () => <div />,
    Space: ({ children }: any) => <div>{children}</div>,
    Spin: ({ children }: any) => <div>{children}</div>,
    Table,
    Tabs,
    Tag: ({ children }: any) => <span>{children}</span>,
    message: {
      error: vi.fn(),
      success: vi.fn(),
      warning: vi.fn(),
    },
  };
});

vi.mock('@/api', () => ({
  listAggregateInstances,
  createModelInstance: vi.fn(async () => ({})),
  listModelInstanceRelations: vi.fn(async () => ({ code: 0, data: { items: [] } })),
  listModelInstanceHistory: vi.fn(async () => ({
    code: 0,
    data: { items: [], pagination: { total: 0, page: 1, page_size: 10, total_page: 0 } },
  })),
  getModelInstanceTopology: vi.fn(async () => ({ code: 0, data: { nodes: [], edges: [] } })),
  createModelInstanceRelation: vi.fn(async () => ({ code: 0, data: { message: 'ok' } })),
  deleteModelInstanceRelation: vi.fn(async () => ({ code: 0, data: { message: 'ok' } })),
}));

vi.mock('@/pages/Resource/Model/context', () => ({
  useModelPageContext: () => ({
    detailModel: {
      id: 'model-set',
      name: 'set',
      display_name: '集群',
      classification: 'business',
      icon: 'cluster',
      is_builtin: true,
      is_mainline: true,
      mainline_scope: 'business',
      is_topology_builtin: true,
    },
    attributes: [],
    allModels: [
      {
        id: 'model-set',
        name: 'set',
        display_name: '集群',
        classification: 'business',
        icon: 'cluster',
        is_builtin: true,
        is_mainline: true,
        mainline_scope: 'business',
        is_topology_builtin: true,
      },
    ],
    businesses: [],
    parentModelName: 'business',
    parentModelDisplayName: '业务',
    refreshDetail: vi.fn(async () => {}),
  }),
}));

vi.mock('@/store/InstanceSceneStore', () => ({
  useInstanceSceneStore: (selector: (state: any) => unknown) =>
    selector({
      loading: false,
      detail: null,
      openInstance: mockOpenInstance,
      reset: mockResetInstanceScene,
    }),
}));

vi.mock('@/store/InstanceRelationStore', () => ({
  useInstanceRelationStore: (selector: (state: any) => unknown) =>
    selector({
      detail: null,
      capabilities: [],
      loading: false,
      loadCapabilities: mockLoadInstanceCapabilities,
      reset: mockResetInstanceCapabilities,
    }),
}));

vi.mock('@/components/common/Pagination', () => ({
  default: () => <div data-testid="pagination" />,
}));

vi.mock('@/pages/Resource/Model/components/CreateInstanceDrawer', () => ({
  default: () => null,
}));

describe('instance workspace aggregate list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders aggregate instance rows and opens the drawer with instance_key', async () => {
    render(<InstanceWorkspace />);

    expect(await screen.findByText('SmokeSet3')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'resource.model.actions.viewInstanceDetail' }),
    );

    await waitFor(() => {
      expect(mockOpenInstance).toHaveBeenCalledWith('set:2');
    });
  });
});
