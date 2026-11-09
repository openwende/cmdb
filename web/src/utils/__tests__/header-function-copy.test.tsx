import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Function from '@/components/Layout/Header/Function';

const mockNavigate = vi.fn();
const mockLogout = vi.fn();
let mockUser: null | { display_name: string; username: string; roles: string[] } = null;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'common.layout.help': '帮助',
          'common.layout.login': '登录',
          'common.layout.logout': '退出登录',
        }) as Record<string, string>
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
  it('shows the login action and hides the help entry', () => {
    vi.clearAllMocks();
    mockUser = null;
    render(<Function />);

    expect(screen.queryByText('帮助')).not.toBeInTheDocument();
    expect(screen.getByText('登录')).toBeInTheDocument();
    expect(screen.queryByText('Help')).not.toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
  });

  it('shows logout inside the authenticated user dropdown', async () => {
    vi.clearAllMocks();
    mockUser = {
      username: 'admin',
      display_name: '管理员',
      roles: ['admin'],
    };

    const user = userEvent.setup();
    render(<Function />);

    const userTrigger = screen.getByText('管理员');
    expect(userTrigger).toBeInTheDocument();
    expect(screen.queryByText('退出登录')).not.toBeInTheDocument();
    expect(screen.queryByText('用户管理')).not.toBeInTheDocument();

    await user.hover(userTrigger);

    expect(await screen.findByText('退出登录')).toBeInTheDocument();
  });
});
