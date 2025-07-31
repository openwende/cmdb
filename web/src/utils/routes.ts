/**
 * 定义应用程序中的路由路径构建函数
 * 这些函数用于生成标准化的路由路径，确保整个应用中路由格式一致
 */

/**
 * 生成业务拓扑页面路径
 * @param id 业务ID
 * @returns 业务拓扑页面完整路径
 */
export const getBusinessTopologyPath = (id: number | string): string => {
  return `/business/${id}/topology`;
};

/**
 * 生成业务集拓扑页面路径
 * @param id 业务集ID
 * @returns 业务集拓扑页面完整路径
 */
export const getBusinessSetTopologyPath = (id: number | string): string => {
  return `/business-set/${id}/topology`;
};

/**
 * 生成业务或业务集拓扑页面路径
 * @param id 业务或业务集ID
 * @param isBusinessSet 是否为业务集
 * @returns 对应的拓扑页面完整路径
 */
export const getEntityTopologyPath = (id: number | string, isBusinessSet: boolean = false): string => {
  return isBusinessSet ? getBusinessSetTopologyPath(id) : getBusinessTopologyPath(id);
};

/**
 * 生成主机迁移页面路径
 * @param id 业务ID
 * @returns 主机迁移页面完整路径
 */
export const getTransferHostPath = (id: number | string): string => {
  return `${getBusinessTopologyPath(id)}/transferHost`;
};
