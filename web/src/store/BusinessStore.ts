import { create } from 'zustand';

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
  setCurrentBusiness: (business: BusinessItem | null) => void;
  setBusinessList: (list: BusinessItem[]) => void;
  setBusinessSetList: (list: BusinessItem[]) => void;
  setLoading: (status: boolean) => void;
  loadBusinessData: () => Promise<void>;
  getBusinessById: (id: number | string, type: BusinessType) => BusinessItem | null;
}

export const useBusinessStore = create<BusinessStoreState>((set, get) => ({
  currentBusiness: null,
  businessList: [],
  businessSetList: [],
  loading: false,

  setCurrentBusiness: (business) => set({ currentBusiness: business }),
  setBusinessList: (list) => set({ businessList: list }),
  setBusinessSetList: (list) => set({ businessSetList: list }),
  setLoading: (status) => set({ loading: status }),

  loadBusinessData: async () => {
    // Don't reload if we already have data
    const state = get();
    if (state.businessList.length > 0 && state.businessSetList.length > 0) {
      return;
    }

    set({ loading: true });
    try {
      // Import mock data
      const { bizInfo } = await import('../mock/business');

      // Extract businesses and business sets
      const businesses: BusinessItem[] = [];
      const businessSets: BusinessItem[] = [];

      if (bizInfo && bizInfo.info) {
        bizInfo.info.forEach((item: any) => {
          if (item.bk_biz_id) {
            businesses.push({
              id: item.bk_biz_id,
              name: item.bk_biz_name,
              type: BusinessType.Business,
            });
          } else if (item.bk_biz_set_id) {
            businessSets.push({
              id: item.bk_biz_set_id,
              name: item.bk_biz_set_name,
              type: BusinessType.BusinessSet,
            });
          }
        });
      }

      set({
        businessList: businesses,
        businessSetList: businessSets,
      });

      // Set default selection if needed
      const { currentBusiness } = get();
      if (!currentBusiness && businesses.length > 0) {
        set({ currentBusiness: businesses[0] });
      }
    } catch (error) {
      console.error('Failed to load business data:', error);
    } finally {
      set({ loading: false });
    }
  },

  getBusinessById: (id, type) => {
    const state = get();
    const list = type === BusinessType.Business ? state.businessList : state.businessSetList;
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    return list.find((item) => item.id === numId) || null;
  },
}));
