import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import BusinessSelector from '@/components/Business/BusinessSelector';

let mockPathname = '/business/biz-1/topology';
let mockCurrentBusiness: { id: string; type: string } | null = {
  id: 'biz-1',
  type: 'business',
};
let mockBusinessList = [
  {
    id: 'biz-1',
    name: 'SmokeBiz',
    displayId: '1001',
  },
];
let mockBusinessSetList: any[] = [];

const { selectPropsRef, loadBusinessData, setCurrentBusiness, getBusinessById, navigate } =
  vi.hoisted(() => ({
    selectPropsRef: { current: null as Record<string, any> | null },
    loadBusinessData: vi.fn(),
    setCurrentBusiness: vi.fn(),
    navigate: vi.fn(),
    getBusinessById: vi.fn((id: string, _type: string) => {
      const allItems = [...mockBusinessList, ...mockBusinessSetList];
      return allItems.find((item) => item.id === id) ?? null;
    }),
  }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate,
  useLocation: () => ({
    pathname: mockPathname,
  }),
}));

vi.mock('@/store/BusinessStore', () => ({
  BusinessType: {
    Business: 'business',
    BusinessSet: 'businessSet',
  },
  useBusinessStore: (selector?: any) => {
    const state = {
      currentBusiness: mockCurrentBusiness,
      businessList: mockBusinessList,
      businessSetList: mockBusinessSetList,
      loading: false,
      initialized: true,
      loadBusinessData,
      getBusinessById,
      setCurrentBusiness,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('@/utils/routes', () => ({
  getBusinessTopologyPath: (id: string) => `/business/${id}/topology`,
  getBusinessSetTopologyPath: (id: string) => `/business-set/${id}/topology`,
  isBusinessRelatedPage: (pathname: string) =>
    pathname.startsWith('/business/') || pathname.startsWith('/business-set/'),
  parseBusinessInfoFromUrl: () => {
    const match = mockPathname.match(/^\/business\/([^/]+)\/topology/);
    return match
      ? {
          id: match[1],
          type: 'business',
        }
      : null;
  },
}));

vi.mock('antd', () => {
  const Select = (props: Record<string, any>) => {
    selectPropsRef.current = props;
    return <div data-testid="business-selector">{props.children}</div>;
  };

  Select.Option = ({ children }: any) => <div>{children}</div>;
  Select.OptGroup = ({ children }: any) => <div>{children}</div>;

  return {
    Select,
    Spin: () => <div>loading</div>,
    Divider: () => <div />,
    Button: ({ children }: any) => <button type="button">{children}</button>,
  };
});

describe('BusinessSelector layout props', () => {
  beforeEach(() => {
    mockPathname = '/business/biz-1/topology';
    mockCurrentBusiness = {
      id: 'biz-1',
      type: 'business',
    };
    mockBusinessList = [
      {
        id: 'biz-1',
        name: 'SmokeBiz',
        displayId: '1001',
      },
    ];
    mockBusinessSetList = [];
    selectPropsRef.current = null;
    vi.clearAllMocks();
  });

  it('renders the dropdown from the left edge and outside the clipped sidebar container', () => {
    render(<BusinessSelector />);

    expect(screen.getByTestId('business-selector')).toBeInTheDocument();
    expect(selectPropsRef.current).toMatchObject({
      placement: 'bottomLeft',
      popupClassName: 'business-selector-dropdown',
      popupMatchSelectWidth: false,
    });
    expect(selectPropsRef.current?.getPopupContainer?.()).toBe(document.body);
  });

  it('syncs current business from the URL after business data finishes loading', async () => {
    mockPathname = '/business/biz-2/topology';
    mockCurrentBusiness = null;
    mockBusinessList = [];

    const { rerender } = render(<BusinessSelector collapsed={false} />);

    expect(setCurrentBusiness).not.toHaveBeenCalled();

    mockBusinessList = [
      {
        id: 'biz-2',
        name: 'ProbeBiz',
        displayId: '1002',
      },
    ];

    rerender(<BusinessSelector collapsed />);

    await waitFor(() => {
      expect(setCurrentBusiness).toHaveBeenCalledWith({
        id: 'biz-2',
        name: 'ProbeBiz',
        displayId: '1002',
      });
    });
  });

  it('refreshes cached business data when entering the business section', async () => {
    mockPathname = '/resource/business';
    const { rerender } = render(<BusinessSelector collapsed={false} />);

    expect(loadBusinessData).not.toHaveBeenCalled();

    mockPathname = '/business/biz-1/topology';
    rerender(<BusinessSelector collapsed />);

    await waitFor(() => {
      expect(loadBusinessData).toHaveBeenCalledWith(true);
    });
  });
});
