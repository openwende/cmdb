import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockNavigate, mockStoreState } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockStoreState: {
    currentBusiness: null as
      | {
          id: string;
          type: 'business' | 'businessSet';
        }
      | null,
    businessList: [] as Array<{ id: string }>,
    businessSetList: [] as Array<{ id: string }>,
    initialized: true,
    loading: false,
    loadBusinessData: vi.fn(),
  },
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/store/BusinessStore', () => ({
  BusinessType: {
    Business: 'business',
    BusinessSet: 'businessSet',
  },
  useBusinessStore: () => mockStoreState,
}));

vi.mock('@/utils/routes', () => ({
  getBusinessTopologyPath: (id: string) => `/business/${id}/topology`,
  getBusinessSetTopologyPath: (id: string) => `/business-set/${id}/topology`,
}));

import EntryRedirect from '@/pages/Business/EntryRedirect';

describe('Business entry redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreState.currentBusiness = null;
    mockStoreState.businessList = [];
    mockStoreState.businessSetList = [];
    mockStoreState.initialized = true;
    mockStoreState.loading = false;
  });

  it('redirects /business to the current business topology when a business is selected', async () => {
    mockStoreState.currentBusiness = {
      id: 'biz-1',
      type: 'business',
    };

    render(<EntryRedirect />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/business/biz-1/topology', { replace: true });
    });
  });

  it('falls back to the first business topology after store initialization', async () => {
    mockStoreState.businessList = [{ id: 'biz-2' }];

    render(<EntryRedirect />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/business/biz-2/topology', { replace: true });
    });
  });

  it('falls back to the business management page when there is no business to open', async () => {
    render(<EntryRedirect />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/resource/business', { replace: true });
    });
  });
});
