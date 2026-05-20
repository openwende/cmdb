import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BusinessTree from '@/pages/Business/BusinessTopology/BusinessTree';

const {
  t,
  currentBusiness,
  topologySettings,
  getTopologyTree,
  loadTopologySettings,
  onNodeSelect,
  searchProps,
} =
  vi.hoisted(() => ({
  t: (key: string) => key,
  currentBusiness: {
    id: 'biz-1',
    name: 'Smoke Business',
  },
  topologySettings: { max_topology_level: 10 },
  getTopologyTree: vi.fn(async () => ({
    code: 0,
    data: [
      {
        id: 'business_biz-1',
        node_id: 'biz-1',
        name: 'Smoke Business',
        node_type: 'business',
        parent_id: '',
        icon: 'business',
        is_leaf: false,
        is_default: false,
        expandable: true,
        child_count: 1,
        children: [
          {
            id: 'set_4',
            node_id: 4,
            name: 'Probe Set',
            node_type: 'set',
            parent_id: 'business_biz-1',
            icon: 'cluster',
            is_leaf: false,
            is_default: false,
            expandable: true,
            child_count: 1,
            children: [
              {
                id: 'module_3',
                node_id: 3,
                name: 'Smoke Module',
                node_type: 'module',
                parent_id: 'set_4',
                icon: 'module',
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
  loadTopologySettings: vi.fn(async () => undefined),
  onNodeSelect: vi.fn(),
  searchProps: [] as Record<string, unknown>[],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t,
  }),
}));

vi.mock('antd', () => ({
  Input: {
    Search: ({ value, onChange, onClear, ...props }: any) => {
      searchProps.push(props);
      return (
      <div>
        <input
          aria-label="topology-search"
          value={value}
          onChange={onChange}
          name={props.name}
          id={props.id}
        />
        <button type="button" onClick={onClear}>
          clear-search
        </button>
      </div>
      );
    },
  },
  Spin: ({ tip }: { tip: string }) => <div>{tip}</div>,
  Tooltip: ({ children }: any) => <>{children}</>,
  message: {
    error: vi.fn(),
  },
}));

vi.mock('@/api/services/business', () => ({
  getTopologyTree,
}));

vi.mock('@/store/BusinessStore', () => ({
  useBusinessStore: () => ({
    currentBusiness,
  }),
}));

vi.mock('@/store/MainlineStore', () => ({
  useMainlineStore: () => ({
    topologySettings,
    loadTopologySettings,
  }),
}));

vi.mock('@/components/common/EmptySearchResult', () => ({
  default: () => <div>empty-search</div>,
}));

vi.mock('@/components/common/DragHandle', () => ({
  default: () => null,
}));

vi.mock('@/pages/Business/BusinessTopology/components/TopologyTree', () => ({
  default: ({ treeData }: any) => (
    <div>
      {treeData.map((node: any) => (
        <div key={node.key}>{node.title}</div>
      ))}
    </div>
  ),
}));

describe('BusinessTree projection loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchProps.length = 0;
  });

  it('renders topology data without requiring legacy mainline model metadata', async () => {
    render(
      <BusinessTree
        selectedNode={null}
        topologyVersion={1}
        onTopologyChanged={() => undefined}
        onNodeSelect={onNodeSelect}
      />,
    );

    await waitFor(() => {
      expect(getTopologyTree).toHaveBeenCalledWith({
        business_id: 'biz-1',
        include_hosts: false,
        max_depth: 10,
      });
    });

    expect(loadTopologySettings).toHaveBeenCalled();
    expect(await screen.findByText('Smoke Business')).toBeInTheDocument();
  });

  it('passes stable accessibility attributes to the topology search input', async () => {
    render(
      <BusinessTree
        selectedNode={null}
        topologyVersion={1}
        onTopologyChanged={() => undefined}
        onNodeSelect={onNodeSelect}
      />,
    );

    await waitFor(() => {
      expect(searchProps).not.toHaveLength(0);
    });

    expect(searchProps[0]).toMatchObject({
      id: 'business-topology-search',
      name: 'business_topology_search',
    });
  });
});
