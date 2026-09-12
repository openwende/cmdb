import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TransferHostModal from '@/pages/Business/BusinessTopology/components/TransferHostModal';

const { getTopologyTree, businessStoreState } = vi.hoisted(() => ({
  getTopologyTree: vi.fn(async () => ({
    code: 0,
    data: [
      {
        id: 'business_biz-1',
        node_id: 'biz-1',
        name: 'Biz One',
        node_type: 'business',
        parent_id: '',
        is_leaf: false,
        is_default: false,
        expandable: true,
        child_count: 1,
        children: [
          {
            id: 'set_4',
            node_id: 4,
            name: 'Set From API',
            node_type: 'set',
            parent_id: 'business_biz-1',
            is_leaf: false,
            is_default: false,
            expandable: true,
            child_count: 1,
            children: [
              {
                id: 'module_9',
                node_id: 9,
                name: 'Module From API',
                node_type: 'module',
                parent_id: 'set_4',
                is_leaf: true,
                is_default: false,
                expandable: false,
                child_count: 0,
              },
            ],
          },
        ],
      },
    ],
  })),
  businessStoreState: {
    currentBusiness: { id: 'biz-1', name: 'Biz One', type: 'business' },
    businessList: [
      { id: 'biz-1', name: 'Biz One', type: 'business' },
      { id: 'biz-2', name: 'Biz Two', type: 'business' },
    ],
    businessSetList: [],
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/api/services/business', () => ({
  getTopologyTree,
}));

vi.mock('@/store/BusinessStore', () => ({
  BusinessType: {
    Business: 'business',
    BusinessSet: 'businessSet',
  },
  useBusinessStore: () => businessStoreState,
}));

vi.mock('antd', () => ({
  Modal: ({ open, children }: any) => (open ? <div>{children}</div> : null),
  Input: {
    Search: ({ value = '', onChange, placeholder }: any) => (
      <input aria-label={placeholder} value={value} onChange={(event) => onChange?.(event)} />
    ),
  },
  List: ({ dataSource, renderItem, locale }: any) => (
    <div>
      {dataSource.length === 0
        ? locale?.emptyText
        : dataSource.map((item: any) => renderItem(item))}
    </div>
  ),
  Button: ({ children, onClick, disabled }: any) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Checkbox: ({ checked, onChange }: any) => (
    <input type="checkbox" checked={checked} onChange={() => onChange?.()} />
  ),
  Radio: ({ checked, onChange }: any) => (
    <input type="radio" checked={checked} onChange={() => onChange?.()} />
  ),
  Select: ({ options = [], placeholder }: any) => (
    <div>
      <div>{placeholder}</div>
      {options.map((option: any) => (
        <div key={option.value}>{option.label}</div>
      ))}
    </div>
  ),
  Empty: ({ description }: any) => <div>{description}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@ant-design/icons', () => ({
  CloseOutlined: () => null,
}));

vi.mock('@/components/common/DragHandle', () => ({
  default: () => null,
}));

vi.mock('@/components/common/EmptySearchResult', () => ({
  default: () => <div>empty-search</div>,
}));

vi.mock('@/pages/Business/BusinessTopology/components/TopologyTree', () => ({
  default: ({ treeData }: any) => {
    const flatten = (nodes: any[]): string[] =>
      nodes.flatMap((node) => [
        String(node.title),
        ...(node.children ? flatten(node.children) : []),
      ]);

    return (
      <div>
        {flatten(treeData).map((title) => (
          <div key={title}>{title}</div>
        ))}
      </div>
    );
  },
}));

describe('topology transfer host modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads module targets from the topology api', async () => {
    render(
      <TransferHostModal
        visible={true}
        transferType="businessModule"
        selectedHosts={[{ id: 'host-1', ip: '10.1.1.10' }]}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    await waitFor(() => {
      expect(getTopologyTree).toHaveBeenCalledWith({
        business_id: 'biz-1',
      });
    });

    expect(screen.getByText('Module From API')).toBeInTheDocument();
  });

  it('uses the real business store list for other-business options', () => {
    render(
      <TransferHostModal
        visible={true}
        transferType="otherBusiness"
        selectedHosts={[{ id: 'host-1', ip: '10.1.1.10' }]}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    );

    expect(screen.getByText('[biz-2] Biz Two')).toBeInTheDocument();
  });
});
