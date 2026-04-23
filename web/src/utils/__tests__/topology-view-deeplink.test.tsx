import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import TopologyView from '@/pages/Business/BusinessTopology/TopologyView';
import { TopoTreeNodeType } from '@/pages/Business/Types';
import { BusinessType } from '@/store/BusinessStore';

const mockSelectNode = vi.fn(async () => {});
const mockReset = vi.fn();
const mockSetSearchParams = vi.fn();
const mockNavigate = vi.fn();
const mockSetCurrentBusiness = vi.fn();
const mockLoadBusinessData = vi.fn(async () => {});
let mockSelectedNode: any = null;
let mockParentNodes: any[] = [];
let mockCurrentBusiness: any = null;
let mockBusinessList: any[] = [];

let mockPathname = '/business/biz-1/topology';
let mockSearch = 'node=business-biz-1';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useLocation: () => ({
      pathname: mockPathname,
      search: mockSearch ? `?${mockSearch}` : '',
    }),
    useSearchParams: () => [new URLSearchParams(mockSearch), mockSetSearchParams],
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/utils/routes', () => ({
  getBusinessIdFromUrl: () => {
    const match = mockPathname.match(/^\/business\/([^/]+)\/topology/);
    return match?.[1] ?? '';
  },
  getBusinessTopologyPath: (id: string) => `/business/${id}/topology`,
}));

vi.mock('@/store/TopologySceneStore', () => ({
  useTopologySceneStore: () => ({
    selectedNode: mockSelectedNode,
    parentNodes: mockParentNodes,
    selectNode: mockSelectNode,
    reset: mockReset,
  }),
}));

vi.mock('@/store/BusinessStore', () => ({
  BusinessType: {
    Business: 'business',
    BusinessSet: 'businessSet',
  },
  useBusinessStore: () => ({
    currentBusiness: mockCurrentBusiness,
    businessList: mockBusinessList,
    setCurrentBusiness: mockSetCurrentBusiness,
    loadBusinessData: mockLoadBusinessData,
  }),
}));

vi.mock('@/pages/Business/BusinessTopology/BusinessTree', () => ({
  default: ({ initialSelectedKey }: { initialSelectedKey?: string | null }) => (
    <div data-testid="initial-selected-key">{initialSelectedKey ?? 'null'}</div>
  ),
}));

vi.mock('@/pages/Business/BusinessTopology/HostList', () => ({
  default: () => <div>host-list</div>,
}));

vi.mock('@/pages/Business/BusinessTopology/ServiceInstance', () => ({
  default: () => <div>service-instance</div>,
}));

vi.mock('@/pages/Business/BusinessTopology/NodeInfo', () => ({
  default: () => <div>node-info</div>,
}));

describe('topology view deeplink sync', () => {
  beforeEach(() => {
    mockPathname = '/business/biz-1/topology';
    mockSearch = 'node=business-biz-1';
    mockSelectedNode = null;
    mockParentNodes = [];
    mockCurrentBusiness = {
      id: 'biz-1',
      name: 'ProbeSetBiz-1773163724333',
      type: BusinessType.Business,
      displayId: '1003',
    };
    mockBusinessList = [
      mockCurrentBusiness,
      {
        id: 'biz-2',
        name: 'SmokeGameBiz',
        type: BusinessType.Business,
        displayId: '1004',
      },
    ];
    mockSelectNode.mockClear();
    mockReset.mockClear();
    mockSetSearchParams.mockClear();
    mockNavigate.mockClear();
    mockSetCurrentBusiness.mockClear();
    mockLoadBusinessData.mockClear();
  });

  it('keeps BusinessTree initialSelectedKey in sync when node query changes on the same topology route', async () => {
    const { rerender } = render(<TopologyView />);

    await waitFor(() => {
      expect(screen.getByTestId('initial-selected-key')).toHaveTextContent('business-biz-1');
    });

    mockSearch = 'node=set-2';
    rerender(<TopologyView />);

    await waitFor(() => {
      expect(screen.getByTestId('initial-selected-key')).toHaveTextContent('set-2');
    });
  });

  it('resets scene state when switching to a different business route', async () => {
    const { rerender } = render(<TopologyView />);

    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockSetSearchParams).not.toHaveBeenCalled();

    mockPathname = '/business/biz-2/topology';
    mockSearch = 'node=business-biz-1&tab=nodeInfo&view=process';
    rerender(<TopologyView />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledTimes(2);
      expect(mockSetSearchParams).toHaveBeenCalled();
    });

    const nextParams = mockSetSearchParams.mock.calls.at(-1)?.[0];
    expect(nextParams).toBeInstanceOf(URLSearchParams);
    expect(nextParams.toString()).toBe('');
  });

  it('shows a contextual workspace header for the selected node and active tab', () => {
    mockSearch = 'node=module-3&tab=hostList';
    mockSelectedNode = {
      key: 'module-3',
      nodeId: '3',
      title: 'Smoke Module',
      type: TopoTreeNodeType.Module,
    };

    render(<TopologyView />);

    expect(screen.getByText('business.topology.workspace.currentNode')).toBeInTheDocument();
    expect(screen.getAllByText('Smoke Module')).toHaveLength(2);
    expect(screen.getByText('business.topology.workspace.hostList')).toBeInTheDocument();
  });

  it('renders an in-page business switcher and breadcrumb path for the current node', () => {
    mockSearch = 'node=module-3&tab=hostList';
    mockSelectedNode = {
      key: 'module-3',
      nodeId: '3',
      title: 'Smoke Module',
      type: TopoTreeNodeType.Module,
    };
    mockParentNodes = [
      {
        key: 'business-biz-1',
        nodeId: 'biz-1',
        title: 'ProbeSetBiz-1773163724333',
        type: TopoTreeNodeType.Biz,
      },
      {
        key: 'set-4',
        nodeId: '4',
        title: 'ProbeSet-renamed',
        type: TopoTreeNodeType.Set,
      },
    ];

    render(<TopologyView />);

    expect(screen.getByTestId('topology-business-switcher')).toHaveTextContent(
      'ProbeSetBiz-1773163724333',
    );
    expect(screen.getByTestId('topology-node-breadcrumb')).toHaveTextContent(
      'ProbeSetBiz-1773163724333',
    );
    expect(screen.getByTestId('topology-node-breadcrumb')).toHaveTextContent('ProbeSet-renamed');
    expect(screen.getByTestId('topology-node-breadcrumb')).toHaveTextContent('Smoke Module');
  });

  it('switches business from the workspace header', async () => {
    render(<TopologyView />);

    fireEvent.click(screen.getByTestId('topology-business-switcher'));
    fireEvent.click(screen.getByRole('button', { name: /SmokeGameBiz/ }));

    expect(mockSetCurrentBusiness).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'biz-2',
      }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/business/biz-2/topology');
  });
});
