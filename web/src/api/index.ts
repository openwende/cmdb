import axios from './axiosInstance';

// --- Business API ---
const topologyTreeApi = '/business/topology/tree';
const hostListApi = '/business/topology/hostList';

// Business Topology
export const getTopologyTree = (params?: any) => {
  return axios.get(topologyTreeApi, params);
};

export const getHostList = (params: any) => {
  return axios.get(hostListApi, params);
};