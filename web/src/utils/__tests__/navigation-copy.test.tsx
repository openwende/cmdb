import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HeaderMenu from '@/components/Layout/Header/Menu';
import Sidebar from '@/components/Layout/Sidebar';
import { routes } from '@/routes';
import { PrimaryNavKey } from '@/routes/Types';

const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

const { mockLocationPathname, mockBusinessStore } = vi.hoisted(() => ({
  mockLocationPathname: { value: '/model/overview' },
  mockBusinessStore: {
    businessList: [] as Array<{ id: string }>,
    loadBusinessData: vi.fn(),
    loading: false,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        {
          'routes.home': '首页',
          'routes.business': '业务',
          'routes.modelManagement': '模型与类型',
          'routes.resource': '资源目录',
          'routes.analysis': '审计与分析',
          'routes.modelOverview': '类型总览',
          'routes.modelGroups': '类型分组',
          'routes.modelTopology': '关系拓扑',
          'routes.resourceBusiness': '业务台账',
          'routes.host': '主机资源',
          'routes.auditLogs': '操作审计',
          'routes.operations': '运营概览',
        } as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    useLocation: () => ({
      pathname: mockLocationPathname.value,
    }),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/store/BusinessStore', () => ({
  useBusinessStore: () => mockBusinessStore,
}));

vi.mock('@/utils/routes', () => ({
  getBusinessTopologyPath: (businessId: string) => `/business/${businessId}/topology`,
  isBusinessRelatedPage: () => false,
  isBusinessSetPage: () => false,
  isBusinessPage: () => false,
  buildEntityPath: () => '',
}));

vi.mock('@/components/Business/BusinessSelector', () => ({
  default: () => <div>business-selector</div>,
}));

vi.mock('antd', () => ({
  Menu: ({
    items,
    onClick,
  }: {
    items?: { key: string; label: React.ReactNode }[];
    onClick?: ({ key }: { key: string }) => void;
  }) => (
    <nav>
      {items?.map((item) => (
        <button type="button" key={item.key} onClick={() => onClick?.({ key: item.key })}>
          {item.label}
        </button>
      ))}
    </nav>
  ),
  Spin: () => <div>loading</div>,
  Layout: {
    Sider: ({ children }: { children?: React.ReactNode }) => <aside>{children}</aside>,
  },
  message: {
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

describe('navigation copy', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLocationPathname.value = '/model/overview';
    mockBusinessStore.businessList = [];
    mockBusinessStore.loadBusinessData = vi.fn();
    mockBusinessStore.loading = false;
  });

  it('keeps entity-scoped business routes out of the top navigation', () => {
    render(<HeaderMenu />);

    expect(screen.getAllByText('业务')).toHaveLength(1);
  });

  it('navigates the top-level business menu to the first available business topology', async () => {
    mockLocationPathname.value = '/model/overview';
    mockBusinessStore.businessList = [{ id: 'biz-1' }];

    const user = userEvent.setup();
    render(<HeaderMenu />);

    await user.click(screen.getByText('业务'));

    expect(mockNavigate).toHaveBeenCalledWith('/business/biz-1/topology');
  });

  it('uses task-oriented labels in the top navigation', () => {
    render(<HeaderMenu />);

    expect(screen.getByText('业务')).toBeInTheDocument();
    expect(screen.getByText('模型与类型')).toBeInTheDocument();
    expect(screen.getByText('资源目录')).toBeInTheDocument();
    expect(screen.getByText('审计与分析')).toBeInTheDocument();
  });

  it('uses task-oriented labels in model and resource sidebars', () => {
    const modelSection = routes.find((route) => route.key === PrimaryNavKey.Model);
    const resourceSection = routes.find((route) => route.key === PrimaryNavKey.Resource);

    const { rerender } = render(<Sidebar currentSection={modelSection} />);

    expect(screen.getByText('类型总览')).toBeInTheDocument();
    expect(screen.getByText('类型分组')).toBeInTheDocument();
    expect(screen.getByText('关系拓扑')).toBeInTheDocument();

    rerender(<Sidebar currentSection={resourceSection} />);

    expect(screen.getByText('业务台账')).toBeInTheDocument();
    expect(screen.getByText('主机资源')).toBeInTheDocument();
  });
});
