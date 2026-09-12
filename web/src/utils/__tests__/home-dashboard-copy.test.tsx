import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Home from '@/pages/Home';

const { mockNavigate, listModels, getBusinessList } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  listModels: vi.fn(async () => []),
  getBusinessList: vi.fn(async () => ({
    data: {
      total: 0,
    },
  })),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'dashboard.stats.pending': '待接入',
          'dashboard.workspace.pendingSummary': '主机、业务、实例统计将随着资源图接入逐步开放。',
          'dashboard.workspace.primaryCta': '进入业务拓扑',
          'dashboard.workspace.primaryCtaNoBusiness': '创建/选择业务',
          'dashboard.workspace.primaryDescNoBusiness':
            '当前还没有业务，先进入业务列表创建或选择业务。',
          'dashboard.workspace.secondary.resources': '进入资源目录',
          'dashboard.workspace.secondary.models': '进入模型管理',
        }) as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/api', () => ({
  listModels,
  getBusinessList,
}));

vi.mock('antd', () => ({
  Card: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Col: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Row: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Button: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Spin: () => <div data-testid="spin" />,
  Skeleton: Object.assign(() => <div>loading</div>, {
    Input: () => <div>loading-input</div>,
  }),
  Statistic: ({ value, suffix }: { value: number; suffix?: string }) => (
    <span>
      {value}
      {suffix}
    </span>
  ),
}));

vi.mock('@ant-design/icons', () => ({
  ApartmentOutlined: () => <span>apartment</span>,
  CloudServerOutlined: () => <span>cloud</span>,
  ClusterOutlined: () => <span>cluster</span>,
  AuditOutlined: () => <span>audit</span>,
  CheckCircleOutlined: () => <span>check</span>,
  AppstoreOutlined: () => <span>appstore</span>,
  DatabaseOutlined: () => <span>database</span>,
  PlusOutlined: () => <span>plus</span>,
  ImportOutlined: () => <span>import</span>,
  NodeIndexOutlined: () => <span>node-index</span>,
  FileSearchOutlined: () => <span>file-search</span>,
  RightOutlined: () => <span>right</span>,
}));

describe('home dashboard copy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replaces placeholder stats with a lightweight workspace summary', async () => {
    render(<Home />);

    expect(
      await screen.findByText('主机、业务、实例统计将随着资源图接入逐步开放。'),
    ).toBeInTheDocument();
    expect(listModels).toHaveBeenCalled();
    expect(screen.queryByText('--')).not.toBeInTheDocument();
    expect(screen.queryAllByText('待接入')).toHaveLength(0);
  });

  it('focuses the home page on one primary entry and two secondary entries', async () => {
    render(<Home />);

    expect(await screen.findByText('创建/选择业务')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入资源目录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '进入模型管理' })).toBeInTheDocument();
    expect(screen.queryByText('dashboard.quickActions.title')).not.toBeInTheDocument();
  });

  it('demotes not-yet-connected stats into a lightweight workspace status summary', async () => {
    render(<Home />);

    expect(
      await screen.findByText('主机、业务、实例统计将随着资源图接入逐步开放。'),
    ).toBeInTheDocument();
    expect(screen.queryAllByText('待接入')).toHaveLength(0);
  });
});
