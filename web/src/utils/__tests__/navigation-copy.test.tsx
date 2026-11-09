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

let mockAuthUser: null | { roles: string[] } = null;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'routes.home': '首页',
          'routes.business': '业务',
          'routes.businessTopology': '业务拓扑',
          'routes.dynamicGroup': '动态分组',
          'routes.modelManagement': '模型与类型',
          'routes.resource': '资源目录',
          'routes.analysis': '审计与分析',
          'routes.userManagement': '用户管理',
          'routes.userList': '账号列表',
          'routes.modelOverview': '类型总览',
          'routes.modelGroups': '类型分组',
          'routes.modelTopology': '关系拓扑',
          'routes.resourceBusiness': '业务列表',
          'routes.host': '主机资源',
          'routes.auditLogs': '操作审计',
          'routes.operations': '运营概览',
        }) as Record<string, string>
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

vi.mock('@/store/AuthStore', () => ({
  useAuthStore: <T,>(selector?: (state: { hasRole: (...roles: string[]) => boolean }) => T) => {
    const state = {
      hasRole: (...roles: string[]) =>
        Boolean(mockAuthUser && roles.some((role) => mockAuthUser?.roles.includes(role))),
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/utils/routes', () => ({
  getBusinessTopologyPath: (businessId: string) => `/business/${businessId}/topology`,
  isBusinessRelatedPage: (pathname: string) =>
    pathname.startsWith('/business/') || pathname.startsWith('/business-set/'),
  isBusinessSetPage: (pathname: string) => pathname.startsWith('/business-set/'),
  isBusinessPage: (pathname: string) => pathname.startsWith('/business/'),
  buildEntityPath: (pathSegments: string[], entityType: string, itemPath: string) =>
    `/${entityType}/${pathSegments[2]}/${itemPath}`,
}));

vi.mock('@/components/Business/BusinessSelector', () => ({
  default: () => <div>business-selector</div>,
}));

vi.mock('antd', () => ({
  Menu: ({
    items,
    onClick,
    selectedKeys = [],
  }: {
    items?: { key: string; label: React.ReactNode }[];
    onClick?: ({ key }: { key: string }) => void;
    selectedKeys?: string[];
  }) => (
    <nav>
      {items?.map((item) => (
        <button
          type="button"
          key={item.key}
          aria-current={selectedKeys.includes(item.key) ? 'page' : undefined}
          onClick={() => onClick?.({ key: item.key })}
        >
          {item.label}
        </button>
      ))}
    </nav>
  ),
  Spin: () => <div>loading</div>,
  Layout: {
    Sider: ({ children }: { children?: React.ReactNode }) => <aside>{children}</aside>,
  },
  Divider: ({ className }: { className?: string }) => <hr className={className} />,
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
    mockAuthUser = null;
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

    expect(screen.getByText('首页')).toBeInTheDocument();
    expect(screen.getByText('业务')).toBeInTheDocument();
    expect(screen.getByText('模型与类型')).toBeInTheDocument();
    expect(screen.getByText('资源目录')).toBeInTheDocument();
    expect(screen.getByText('审计与分析')).toBeInTheDocument();
    expect(screen.queryByText('用户管理')).not.toBeInTheDocument();
  });

  it('navigates the home menu directly to the dashboard page', async () => {
    mockLocationPathname.value = '/model/overview';

    const user = userEvent.setup();
    render(<HeaderMenu />);

    await user.click(screen.getByText('首页'));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('selects the home menu by default on the root path', () => {
    mockLocationPathname.value = '/';

    render(<HeaderMenu />);

    expect(screen.getByRole('button', { name: '首页' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows user management after analysis for admin users only', () => {
    mockAuthUser = { roles: ['admin'] };

    render(<HeaderMenu />);

    const buttons = screen.getAllByRole('button').map((button) => button.textContent);
    expect(buttons).toEqual(['首页', '业务', '模型与类型', '资源目录', '审计与分析', '用户管理']);
  });

  it('shows business-scoped secondary navigation under the business menu', async () => {
    mockLocationPathname.value = '/business/1000/topology';

    const businessSection = routes.find((route) => route.key === PrimaryNavKey.Business);

    const user = userEvent.setup();
    render(<Sidebar currentSection={businessSection} />);

    expect(screen.getByText('business-selector')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '业务拓扑' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByText('动态分组')).toBeInTheDocument();

    await user.click(screen.getByText('动态分组'));

    expect(mockNavigate).toHaveBeenCalledWith('/business/1000/dynamicGroup');
  });

  it('uses task-oriented labels in model and resource sidebars', () => {
    const modelSection = routes.find((route) => route.key === PrimaryNavKey.Model);
    const resourceSection = routes.find((route) => route.key === PrimaryNavKey.Resource);
    const adminSection = routes.find((route) => route.key === PrimaryNavKey.AdminUsers);

    const { rerender } = render(<Sidebar currentSection={modelSection} />);

    expect(screen.getByText('类型总览')).toBeInTheDocument();
    expect(screen.getByText('类型分组')).toBeInTheDocument();
    expect(screen.getByText('关系拓扑')).toBeInTheDocument();

    rerender(<Sidebar currentSection={resourceSection} />);

    expect(screen.getByText('业务列表')).toBeInTheDocument();
    expect(screen.getByText('主机资源')).toBeInTheDocument();

    rerender(<Sidebar currentSection={adminSection} />);

    expect(screen.getByText('账号列表')).toBeInTheDocument();
  });
});
