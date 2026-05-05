import { useOutletContext } from 'react-router-dom';
import { BusinessDetail } from '@/api/types/resource';
import { DynamicModelDefinition, ModelAttribute, ModelDefinition } from '@/api/types/model';

export interface ModelPageContextValue {
  detailModel: ModelDefinition;
  attributes: ModelAttribute[];
  allModels: ModelDefinition[];
  dynamicModels: DynamicModelDefinition[];
  isDynamicModel: boolean;
  businesses: BusinessDetail[];
  parentModelName: string;
  parentModelDisplayName: string;
  refreshDetail: () => Promise<void>;
}

export const useModelPageContext = () => useOutletContext<ModelPageContextValue>();
