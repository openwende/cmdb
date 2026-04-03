import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import InfoItem from '@/pages/Business/BusinessTopology/components/InfoItem';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        {
          'common.notSet': '未设置',
        } as Record<string, string>
      )[key] || key,
  }),
}));

describe('topology info item', () => {
  it('renders an explicit empty-state label for missing values', () => {
    render(<InfoItem label="创建人" value={undefined} />);

    expect(screen.getByText('未设置')).toBeInTheDocument();
  });

  it('keeps zero as a real value instead of treating it as empty', () => {
    render(<InfoItem label="容量" value={0} />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
