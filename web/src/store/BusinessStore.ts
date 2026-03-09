import { create } from 'zustand';
import { getBusinessList, getBusinessSetList } from '../api/services/business';

export enum BusinessType {
  Business = 'business',
  BusinessSet = 'businessSet',
}

export interface BusinessItem {
  id: string;
  name: string;
  type: BusinessType;
  displayId?: string;
  legacyId?: string;
  numericId?: number;
}

interface BusinessStoreState {
  currentBusiness: BusinessItem | null;
  businessList: BusinessItem[];
  businessSetList: BusinessItem[];
  loading: boolean;
  initialized: boolean; // 标记是否已经尝试加载过数据
  setCurrentBusiness: (business: BusinessItem | null) => void;
  setBusinessList: (list: BusinessItem[]) => void;
  setBusinessSetList: (list: BusinessItem[]) => void;
  setLoading: (status: boolean) => void;
  loadBusinessData: (force?: boolean) => Promise<void>; // 添加 force 参数支持强制重新加载
  getBusinessById: (id: string, type: BusinessType) => BusinessItem | null;
  reset: () => void; // 重置 store 状态
}

export const useBusinessStore = create<BusinessStoreState>((set, get) => ({
  currentBusiness: null,
  businessList: [],
  businessSetList: [],
  loading: false,
  initialized: false,

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

    // 如果正在加载中，避免重复请求
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
              id: String(item.id),
              name: item.name,
              type: BusinessType.Business,
              displayId: item.business_id ? String(item.business_id) : String(item.id),
              legacyId: item.business_id ? String(item.business_id) : undefined,
              numericId: item.business_id ? Number(item.business_id) : undefined,
            });
          }
        });
      }

      // Parse business set list
      if (businessSetResponse?.data?.items && Array.isArray(businessSetResponse.data.items)) {
        businessSetResponse.data.items.forEach((item: any) => {
          if (item.id && item.name) {
            businessSets.push({
              id: String(item.id),
              name: item.name,
              type: BusinessType.BusinessSet,
              displayId: item.business_id ? String(item.business_id) : String(item.id),
              legacyId: item.business_id ? String(item.business_id) : undefined,
              numericId: item.business_id ? Number(item.business_id) : undefined,
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
      // 即使失败也标记为已初始化，避免死循环
      set({ initialized: true });
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
    });
  },

  getBusinessById: (id, type) => {
    const state = get();
    const list = type === BusinessType.Business ? state.businessList : state.businessSetList;
    return list.find((item) => item.id === id || item.legacyId === id) || null;
  },
}));
