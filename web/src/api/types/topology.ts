/**
 * 后端拓扑树 API 返回的数据类型定义
 */

/**
 * 拓扑节点类型
 */
export enum BackendNodeType {
  Business = 'business',
  Set = 'set',
  Module = 'module',
  IdleSet = 'idle_set',
  IdleModule = 'idle_module',
}

/**
 * 后端返回的拓扑节点数据结构
 */
export interface BackendTopologyNode {
  /** 节点唯一标识，格式: "business_uuid" 或 "set_id" 或 "module_id" */
  id: string;
  /** 节点实际 ID（UUID 或数字 ID） */
  node_id: string | number;
  /** 节点名称 */
  name: string;
  /** 节点类型 */
  node_type: BackendNodeType | string;
  /** 父节点 ID */
  parent_id: string;
  /** 图标类型 */
  icon?: string;
  /** 是否是叶子节点 */
  is_leaf: boolean;
  /** 是否是默认节点（如空闲机池） */
  is_default: boolean;
  /** 是否可展开 */
  expandable: boolean;
  /** 子节点数量 */
  child_count: number;
  /** 子节点列表（如果已加载） */
  children?: BackendTopologyNode[];
  /** 额外信息 */
  extra?: {
    description?: string;
    lifecycle?: string;
    [key: string]: any;
  };
}

/**
 * 获取拓扑树 API 请求参数
 */
export interface GetTopologyTreeRequest {
  /** 业务 ID（UUID） */
  business_id?: string;
  /** 是否包含主机信息 */
  include_hosts?: boolean;
  /** 最大深度 */
  max_depth?: number;
  /** 要展开的节点 ID */
  expand_node_id?: string;
}

/**
 * 获取拓扑树 API 响应
 */
export interface GetTopologyTreeResponse {
  code: number;
  data: BackendTopologyNode[];
  message?: string;
}

export interface CreateTopologySetPayload {
  business_id: string;
  name: string;
  description?: string;
  env_type?: string;
  sort_order?: number;
}

export interface CreateTopologyModulePayload {
  set_id: number;
  name: string;
  description?: string;
  service_type?: string;
  sort_order?: number;
}
