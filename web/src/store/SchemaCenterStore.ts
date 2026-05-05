import { create } from 'zustand';

import axios from '@/api/axiosInstance';
import { AxiosError } from 'axios';

export interface SchemaCenterField {
  name: string;
  display_name: string;
  field_type: string;
  is_required: boolean;
  is_unique: boolean;
  is_editable: boolean;
  is_system: boolean;
  sort_order: number;
  group?: string;
  placeholder?: string;
  help_text?: string;
  unit?: string;
  default?: string | number | boolean;
  options?: Record<string, unknown>;
}

export interface SchemaCenterContract {
  model_uid: string;
  scene?: string;
  fields: SchemaCenterField[];
  field_categories?: string[];
  capabilities?: string[];
}

interface SchemaCenterStoreState {
  schemas: Record<string, SchemaCenterContract>;
  formSchemas: Record<string, SchemaCenterContract>;
  loading: boolean;
  error: string | null;
  loadSchema: (modelUID: string) => Promise<void>;
  loadFormSchema: (modelUID: string, scene: string, businessID?: number) => Promise<void>;
  reset: () => void;
}

const formSchemaKey = (modelUID: string, scene: string) => `${modelUID}:${scene}`;

export const useSchemaCenterStore = create<SchemaCenterStoreState>((set, get) => ({
  schemas: {},
  formSchemas: {},
  loading: false,
  error: null,

  loadSchema: async (modelUID) => {
    if (get().schemas[modelUID]) {
      return;
    }

    set({
      loading: true,
      error: null,
    });

    try {
      const response = await axios.get(`/v1/dynamic-models/${modelUID}/schema`);
      set((state) => ({
        schemas: {
          ...state.schemas,
          [modelUID]: response?.data,
        },
      }));
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        set((state) => ({
          schemas: {
            ...state.schemas,
            [modelUID]: { model_uid: modelUID, fields: [] },
          },
        }));
      } else {
        console.error('Failed to load schema:', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to load schema',
        });
      }
    } finally {
      set({ loading: false });
    }
  },

  loadFormSchema: async (modelUID, scene, businessID) => {
    const key = formSchemaKey(modelUID, scene);
    if (get().formSchemas[key]) {
      return;
    }

    set({
      loading: true,
      error: null,
    });

    try {
      const response = await axios.get(`/v1/dynamic-models/${modelUID}/form-schema`, {
        params: {
          scene,
          ...(businessID ? { business_id: businessID } : {}),
        },
      });

      set((state) => ({
        formSchemas: {
          ...state.formSchemas,
          [key]: response?.data,
        },
      }));
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 404) {
        set((state) => ({
          formSchemas: {
            ...state.formSchemas,
            [key]: { model_uid: modelUID, scene, fields: [] },
          },
        }));
      } else {
        console.error('Failed to load form schema:', error);
        set({
          error: error instanceof Error ? error.message : 'Failed to load form schema',
        });
      }
    } finally {
      set({ loading: false });
    }
  },

  reset: () =>
    set({
      schemas: {},
      formSchemas: {},
      loading: false,
      error: null,
    }),
}));
