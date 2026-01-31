import axios from '../axiosInstance';
import { Property, PropertyMap } from '../../pages/Business/Types';
import { dynamicGroupCondition, objectmainline } from '../../mock/business';
import { ObjectMainLine } from '../../pages/Business/Types';
import { createIdProperty } from '@/pages/Business/utils';

interface BatchSearchOptions {
  params: {
    bk_biz_id?: number;
    bk_obj_id: { $in: string[] };
    bk_supplier_account: string;
  };
  config?: {
    requestId?: symbol;
    fromCache?: boolean;
  };
  injectId?: string;
}

// --- API ---
const topologyTreeApi = '/business/topology/tree';
const hostListApi = '/business/topology/hostList';

// --- Business Topology ---
export const getTopologyTree = (params?: any) => {
  return axios.get(topologyTreeApi, params);
};
export const getHostList = (params: any) => {
  return axios.get(hostListApi, params);
};

// --- Dyniamic Group ---
/**
 * 批量查询对象属性模型
 * @param objIds 模型ID数组，如 ['host', 'set', 'module']
 * @param bizId 业务ID（可选）
 * @returns Promise<PropertyMap>
 */
export const batchSearchObjectAttribute = async ({
  params,
  config,
  injectId,
}: BatchSearchOptions): Promise<PropertyMap> => {
  try {
    // TODO: api
    // $http.post('find/objectattr/web', params, config)
    console.log(config);
    const mockData = dynamicGroupCondition;

    const result: any = {};
    params.bk_obj_id.$in.forEach((objId: string) => {
      result[objId] = [];
    });
    mockData.forEach((property) => {
      result[property.bk_obj_id].push(property);
    });
    Object.keys(result).forEach((objId) => {
      if (injectId === objId) {
        const alreadyInject = result[objId].some((property: Property) => property._is_inject_);
        if (!alreadyInject) {
          result[objId].unshift(createIdProperty(objId));
        }
      }
    });
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
/**
 * 查询单个对象的属性模型
 * @param objId 模型ID
 * @param bizId 业务ID（可选）
 * @returns Promise<PropertyModel[]>
 */
export const searchObjectAttribute = async (
  objId: string,
  _bizId?: number, // 使用下划线前缀表示未使用的参数
): Promise<Property[]> => {
  try {
    // const params = {
    //   bk_obj_id: objId,
    //   ...(bizId && { bk_biz_id: bizId })
    // };

    const mockData = dynamicGroupCondition;
    const result: Property[] = [];

    if (mockData && Array.isArray(mockData)) {
      mockData.forEach((property: any) => {
        if (property.bk_obj_id === objId) {
          // 转换mock数据格式为PropertyModel格式
          const formattedProperty: Property = {
            ...property,
            option: Array.isArray(property.option)
              ? JSON.stringify(property.option)
              : property.option || '',
          };
          result.push(formattedProperty);
        }
      });
    }

    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
/**
 * 获取可用的模型列表
 * @returns Promise<string[]>
 */
export const getAvailableModels = async (): Promise<ObjectMainLine[]> => {
  try {
    // TODO: api
    // await axios.post('/find/objectmainline');
    return objectmainline;
  } catch (error) {
    console.error(error);
    throw error;
  }
};
