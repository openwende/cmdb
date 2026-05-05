import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Function from '@/components/Layout/Header/Function';

const mockNavigate = vi.fn();
const mockLogout = vi.fn();
let mockUser: null | { display_name: string; username: string; roles: string[] } = null;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        {
          'common.layout.help': '帮助',
          'common.layout.login': '登录',
          'common.layout.logout': '退出登录',
        } as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('@/components/Layout/Header/Function/language', () => ({
  default: () => <div>language</div>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/store/AuthStore', () => ({
  useAuthStore: () => ({
    user: mockUser,
    logout: mockLogout,
  }),
}));

describe('header function copy', () => {
  it('shows Chinese labels for help and login actions', () => {
    vi.clearAllMocks();
    mockUser = null;
    render(<Function />);

    expect(screen.getByText('帮助')).toBeInTheDocument();
    expect(screen.getByText('登录')).toBeInTheDocument();
    expect(screen.queryByText('Help')).not.toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
  });

  it('shows current user and logout action for authenticated users', () => {
    vi.clearAllMocks();
    mockUser = {
      username: 'admin',
      display_name: '管理员',
      roles: ['admin'],
    };

    render(<Function />);

    expect(screen.getByText('管理员')).toBeInTheDocument();
    expect(screen.getByText('退出登录')).toBeInTheDocument();
    expect(screen.queryByText('用户管理')).not.toBeInTheDocument();
  });
});
