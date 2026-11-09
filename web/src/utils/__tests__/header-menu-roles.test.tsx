import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AuthUserProfile } from '@/api/services/auth';
import HeaderMenu from '@/components/Layout/Header/Menu';
import { useAuthStore } from '@/store/AuthStore';

// 用真实的 AuthStore：要测的就是用户信息异步写进 store 之后菜单会不会重算

// t 要是稳定引用（和真实 i18next 一样），否则每次渲染都会让 useMemo 重算，掩盖问题
const i18n = vi.hoisted(() => {
  const copy: Record<string, string> = {
    'routes.analysis': '审计与分析',
    'routes.userManagement': '用户管理',
  };
  return { t: (key: string) => copy[key] || key };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => i18n,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useLocation: () => ({ pathname: '/analysis/audit' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/store/BusinessStore', () => ({
  useBusinessStore: () => ({
    businessList: [{ id: '1' }],
    loadBusinessData: vi.fn(),
    loading: false,
    error: null,
  }),
}));

vi.mock('antd', () => ({
  Menu: ({ items }: { items?: { key: string; label: React.ReactNode }[] }) => (
    <nav>
      {items?.map((item) => (
        <button type="button" key={item.key}>
          {item.label}
        </button>
      ))}
    </nav>
  ),
  Modal: { confirm: vi.fn() },
}));

vi.mock('@/utils/message', () => ({
  useAppMessage: () => ({ error: vi.fn() }),
}));

const adminUser: AuthUserProfile = {
  id: '1',
  username: 'admin',
  display_name: 'Admin',
  roles: ['admin'],
};

describe('header menu role items', () => {
  afterEach(() => {
    act(() => useAuthStore.setState({ user: null, initialized: false }));
  });

  it('shows user management once the admin profile finishes loading', () => {
    useAuthStore.setState({ user: null, initialized: false });
    render(<HeaderMenu />);

    expect(screen.getByRole('button', { name: '审计与分析' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '用户管理' })).not.toBeInTheDocument();

    // 刷新页面时用户信息是 initialize() 异步取回来的
    act(() => useAuthStore.setState({ user: adminUser, initialized: true }));
    expect(screen.getByRole('button', { name: '用户管理' })).toBeInTheDocument();

    act(() => useAuthStore.setState({ user: null }));
    expect(screen.queryByRole('button', { name: '用户管理' })).not.toBeInTheDocument();
  });
});
