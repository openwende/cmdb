import { create } from 'zustand';

export enum BusinessType {
    BUSINESS = 'business',
    BUSINESS_SET = 'business_set'
}

export interface BusinessItem {
    id: number;
    name: string;
    type: BusinessType;
}

interface BusinessStoreState {
    // Current selected business or business set
    currentBusiness: BusinessItem | null;

    // List of businesses
    businessList: BusinessItem[];

    // List of business sets
    businessSetList: BusinessItem[];

    // Loading state
    loading: boolean;

    /**
     * Set the current business or business set
     * @param business - Business or business set item
     */
    setCurrentBusiness: (business: BusinessItem | null) => void;

    /**
     * Set the list of businesses
     * @param list - List of business items
     */
    setBusinessList: (list: BusinessItem[]) => void;

    /**
     * Set the list of business sets
     * @param list - List of business set items
     */
    setBusinessSetList: (list: BusinessItem[]) => void;

    /**
     * Set loading state
     * @param status - Loading status
     */
    setLoading: (status: boolean) => void;

    /**
     * Load business and business set data from API
     * This method will call the mock API for now
     */
    loadBusinessData: () => Promise<void>;

    /**
     * Get business or business set by ID and type
     * @param id - Business or business set ID
     * @param type - Business type (business or business set)
     * @returns The found business item or null
     */
    getBusinessById: (id: number | string, type: BusinessType) => BusinessItem | null;
}

// Create the Zustand store
export const useBusinessStore = create<BusinessStoreState>((set, get) => ({
    // Initial state
    currentBusiness: null,
    businessList: [],
    businessSetList: [],
    loading: false,

    // Actions
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
                            type: BusinessType.BUSINESS
                        });
                    } else if (item.bk_biz_set_id) {
                        businessSets.push({
                            id: item.bk_biz_set_id,
                            name: item.bk_biz_set_name,
                            type: BusinessType.BUSINESS_SET
                        });
                    }
                });
            }

            set({
                businessList: businesses,
                businessSetList: businessSets
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
        const list = type === BusinessType.BUSINESS ? state.businessList : state.businessSetList;
        const numId = typeof id === 'string' ? parseInt(id, 10) : id;

        return list.find(item => item.id === numId) || null;
    }
}));
