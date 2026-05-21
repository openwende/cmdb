import { create } from 'zustand';
import { getBusinessList, getBusinessSetList } from '../api/services/business';

export enum BusinessType {
  Business = 'business',
  BusinessSet = 'businessSet',
}

export interface BusinessItem {
  id: number;
  name: string;
  type: BusinessType;
}

interface BusinessStoreState {
  currentBusiness: BusinessItem | null;
  businessList: BusinessItem[];
  businessSetList: BusinessItem[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  setCurrentBusiness: (business: BusinessItem | null) => void;
  setBusinessList: (list: BusinessItem[]) => void;
  setBusinessSetList: (list: BusinessItem[]) => void;
  setLoading: (status: boolean) => void;
  loadBusinessData: (force?: boolean) => Promise<void>;
  getBusinessById: (id: number, type: BusinessType) => BusinessItem | null;
  reset: () => void;
}

export const useBusinessStore = create<BusinessStoreState>((set, get) => ({
  currentBusiness: null,
  businessList: [],
  businessSetList: [],
  loading: false,
  initialized: false,
  error: null,

  setCurrentBusiness: (business) => set({ currentBusiness: business }),
  setBusinessList: (list) => set({ businessList: list }),
  setBusinessSetList: (list) => set({ businessSetList: list }),
  setLoading: (status) => set({ loading: status }),

  loadBusinessData: async (force = false) => {
    const state = get();

    // 如果已经初始化过且不是强制刷新，则跳过
    if (state.initialized && !force) {
      return;
    }

    // Avoid duplicate requests while the list is already loading.
    if (state.loading) {
      return;
    }

    set({ loading: true });
    try {
      // Fetch data from backend API
      const [businessResponse, businessSetResponse] = await Promise.all([
        getBusinessList(),
        getBusinessSetList(),
      ]);

      // Extract businesses and business sets from API response
      const businesses: BusinessItem[] = [];
      const businessSets: BusinessItem[] = [];

      // Parse business list
      if (businessResponse?.data?.items && Array.isArray(businessResponse.data.items)) {
        businessResponse.data.items.forEach((item: any) => {
          if (item.id && item.name) {
            businesses.push({
              id: Number(item.id),
              name: item.name,
              type: BusinessType.Business,
            });
          }
        });
      }

      // Parse business set list
      if (businessSetResponse?.data?.items && Array.isArray(businessSetResponse.data.items)) {
        businessSetResponse.data.items.forEach((item: any) => {
          if (item.id && item.name) {
            businessSets.push({
              id: Number(item.id),
              name: item.name,
              type: BusinessType.BusinessSet,
            });
          }
        });
      }

      set({
        businessList: businesses,
        businessSetList: businessSets,
        initialized: true, // 标记为已初始化
      });

      // Set default selection if needed
      const { currentBusiness } = get();
      if (!currentBusiness && businesses.length > 0) {
        set({ currentBusiness: businesses[0] });
      }
    } catch (error) {
      console.error('Failed to load business data:', error);
      set({
        initialized: true,
        error: error instanceof Error ? error.message : 'Failed to load business data',
      });
    } finally {
      set({ loading: false });
    }
  },

  reset: () => {
    set({
      currentBusiness: null,
      businessList: [],
      businessSetList: [],
      loading: false,
      initialized: false,
      error: null,
    });
  },

  getBusinessById: (id, type) => {
    const state = get();
    const list = type === BusinessType.Business ? state.businessList : state.businessSetList;
    return list.find((item) => item.id === id) || null;
  },
}));
