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
    id: 2001,
    name: 'ProbeSetBiz',
    type: 'business',
  },
];

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// BusinessSelector 用 useNavigate（无业务时跳转新建业务），测试需提供 Router 上下文。
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
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
        <button type="button" onClick={() => handleChange?.(2001)}>
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
        id: 2001,
        name: 'ProbeSetBiz',
        type: 'business',
      },
    ];
  });

  it('renders business options from BusinessStore instead of resource mock data', async () => {
    render(<BusinessSelector value={2001} onChange={onChange} />);

    expect(screen.getByText('[2001] ProbeSetBiz')).toBeInTheDocument();
    expect(screen.queryByText('[2] 蓝鲸')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText('trigger-change'));

    expect(onChange).toHaveBeenCalledWith(2001);
    expect(loadBusinessData).not.toHaveBeenCalled();
  });
});
