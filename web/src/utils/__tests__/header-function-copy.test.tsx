import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Function from '@/components/Layout/Header/Function';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        {
          'common.layout.help': '帮助',
          'common.layout.login': '登录',
        } as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('@/components/Layout/Header/Function/language', () => ({
  default: () => <div>language</div>,
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/store/AuthStore', () => ({
  useAuthStore: () => ({
    user: null,
    logout: vi.fn(),
  }),
}));

describe('header function copy', () => {
  it('shows Chinese labels for help and login actions', () => {
    render(<Function />);

    expect(screen.getByText('帮助')).toBeInTheDocument();
    expect(screen.getByText('登录')).toBeInTheDocument();
    expect(screen.queryByText('Help')).not.toBeInTheDocument();
    expect(screen.queryByText('Login')).not.toBeInTheDocument();
  });
});
