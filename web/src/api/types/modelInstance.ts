export interface DynamicModelInstanceState {
  resource_id: number;
  last_check_time?: string;
  health_status?: number;
  metrics?: Record<string, unknown> | null;
  updated_at?: string;
}

export interface DynamicModelInstanceDetail {
  id: number;
  model_uid: string;
  name: string;
  configs?: Record<string, unknown> | null;
  state?: DynamicModelInstanceState | null;
  created_at?: string;
  updated_at?: string;
}

export interface InstanceRelationEndpoint {
  id: number;
  model_uid: string;
  name: string;
}

export interface InstanceRelationItem {
  id: number;
  association_uid: string;
  association_name: string;
  association_label: string;
  direction: 'source' | 'target';
  source: InstanceRelationEndpoint;
  target: InstanceRelationEndpoint;
  related: InstanceRelationEndpoint;
  properties?: Record<string, unknown> | null;
  created_at?: string;
}

export interface TopologyGraphNode {
  resource_id: number;
  model_uid: string;
  name: string;
  depth: number;
  path: string;
  is_root: boolean;
  configs?: Record<string, unknown> | null;
}

export interface TopologyGraphEdge {
  id: number;
  source_id: number;
  target_id: number;
  source_model_uid: string;
  target_model_uid: string;
  association_uid: string;
  association_name: string;
  properties?: Record<string, unknown> | null;
}

export interface InstanceTopologyGraph {
  nodes: TopologyGraphNode[];
  edges: TopologyGraphEdge[];
}

export interface InstanceHistoryItem {
  id: number;
  resource_id: number;
  model_uid: string;
  change_type: string;
  before_data?: Record<string, unknown> | null;
  after_data?: Record<string, unknown> | null;
  changed_fields?: string[];
  changed_by?: string;
  changed_at?: string;
  client_ip?: string;
  user_agent?: string;
}

export interface InstanceHistoryPagination {
  page: number;
  page_size: number;
  total: number;
  total_page: number;
}

export interface GetModelInstanceDetailResponse {
  code: number;
  data: DynamicModelInstanceDetail;
  message?: string;
}

export interface ListModelInstanceRelationsResponse {
  code: number;
  data: {
    items: InstanceRelationItem[];
  };
  message?: string;
}

export interface GetModelInstanceTopologyResponse {
  code: number;
  data: InstanceTopologyGraph;
  message?: string;
}

export interface ListModelInstanceHistoryResponse {
  code: number;
  data: {
    items: InstanceHistoryItem[];
    pagination: InstanceHistoryPagination;
  };
  message?: string;
}

export interface ListModelInstanceRelationsParams {
  direction?: 'source' | 'target' | 'both';
  association_uid?: string;
}

export interface GetModelInstanceTopologyParams {
  max_depth?: number;
  reverse?: boolean;
  association_uids?: string;
}

export interface ListModelInstanceHistoryParams {
  page: number;
  page_size: number;
}

export interface CreateInstanceRelationPayload {
  source_id: number;
  target_id: number;
  association_uid: string;
}
