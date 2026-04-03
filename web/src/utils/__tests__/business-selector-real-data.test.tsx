import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BusinessSelector from '@/components/common/BusinessSelector';

const { selectPropsRef, loadBusinessData, onChange } = vi.hoisted(() => ({
  selectPropsRef: { current: null as Record<string, any> | null },
  loadBusinessData: vi.fn(),
  onChange: vi.fn(),
}));

let mockBusinessList = [
  {
    id: 'ec47bbff-36a2-43d4-946a-1391601c11ae',
    name: 'ProbeSetBiz',
    displayId: '2001',
  },
];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/BusinessStore', () => ({
  useBusinessStore: () => ({
    businessList: mockBusinessList,
    loading: false,
    initialized: true,
    loadBusinessData,
  }),
}));

vi.mock('antd', () => {
  const Select = ({ children, onChange: handleChange, ...props }: Record<string, any>) => {
    selectPropsRef.current = { ...props, onChange: handleChange };
    return (
      <div>
        <button type="button" onClick={() => handleChange?.('ec47bbff-36a2-43d4-946a-1391601c11ae')}>
          trigger-change
        </button>
        <div data-testid="selector-options">{children}</div>
      </div>
    );
  };

  Select.Option = ({ children }: any) => <div>{children}</div>;

  return { Select };
});

describe('common BusinessSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBusinessList = [
      {
        id: 'ec47bbff-36a2-43d4-946a-1391601c11ae',
        name: 'ProbeSetBiz',
        displayId: '2001',
      },
    ];
  });

  it('renders business options from BusinessStore instead of resource mock data', async () => {
    render(<BusinessSelector value="ec47bbff-36a2-43d4-946a-1391601c11ae" onChange={onChange} />);

    expect(screen.getByText('[2001] ProbeSetBiz')).toBeInTheDocument();
    expect(screen.queryByText('[2] 蓝鲸')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('trigger-change'));

    expect(onChange).toHaveBeenCalledWith('ec47bbff-36a2-43d4-946a-1391601c11ae');
    expect(loadBusinessData).not.toHaveBeenCalled();
  });
});
