/**
 * 主机相关接口的类型（后端结构，snake_case）。
 * 界面用的模型在 `src/api/adapters/hostAdapter.ts` 里转换。
 */

/** 资源池主机列表 `GET /v1/resource-pool/hosts` 的查询参数 */
export interface PoolHostListParams {
  page: number;
  page_size: number;
  directory_id?: number;
  /** 按主机名或 IP 不区分大小写包含匹配；空白不传 */
  keyword?: string;
}

/** 主机表的一行（列表和详情共用的字段，可选字段为空时后端可能不返回） */
export interface HostRaw {
  id: string;
  display_id: number;
  host_name?: string;
  primary_ip?: string;
  ip_addresses?: string[] | null;
  status?: string;
  is_destroyed?: boolean;
  os_type?: string;
  os_version?: string;
  /** 核 */
  cpu?: number | null;
  /** MB */
  memory?: number | null;
  /** GB */
  disk_size?: number | null;
  cloud_vendor?: string;
  cloud_area_id?: string | null;
  cloud_instance_id?: string;
  cloud_region?: string;
  vpc_id?: string;
  subnet_id?: string;
  custom_fields?: Record<string, unknown> | null;
  cloud_metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  tenant_id?: string;
  created_by?: string;
  updated_by?: string;
}

export interface PoolHostListResponse {
  code: number;
  data: {
    items: HostRaw[];
    pagination: {
      page: number;
      page_size: number;
      total: number;
    };
  };
}

/** 主机的一处归属：业务模块，或资源池目录 */
export type HostPlacementRaw =
  | {
      kind: 'business';
      business_id?: number;
      business_name?: string;
      set_id?: number;
      set_name?: string;
      module_id?: number;
      module_name?: string;
    }
  | {
      kind: 'pool';
      directory_id?: number;
      directory_name?: string;
    };

/** `GET /v1/hosts/display/:display_id` 的 data */
export interface HostDetailRaw extends HostRaw {
  cloud_area_name?: string;
  placements?: HostPlacementRaw[] | null;
}

export interface HostDetailResponse {
  code: number;
  data: HostDetailRaw;
}
