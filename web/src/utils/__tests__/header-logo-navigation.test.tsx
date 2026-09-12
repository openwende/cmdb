import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import Logo from '@/components/Layout/Header/Logo';

const mockNavigate = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          'common.layout.platformName': '配置平台',
        }) as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/assets/images/logo.png', () => ({
  default: 'logo.png',
}));

describe('header logo navigation', () => {
  it('navigates to home when clicking the logo text button', async () => {
    const user = userEvent.setup();
    render(<Logo />);

    await user.click(screen.getByRole('button', { name: '配置平台 配置平台' }));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });
});
