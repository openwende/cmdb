import axios from '../axiosInstance';

export type AuditType = 'host' | 'business' | 'resource';

export interface AuditQueryParams {
  audit_type: AuditType;
  bk_biz_id?: number | string;
  resource_type?: string;
  action?: string; // comma-separated: "create,update,delete"
  start_time?: string; // YYYY-MM-DD
  end_time?: string; // YYYY-MM-DD
  account?: string;
  account_match?: 'include' | 'exclude';
  host?: string;
  host_type?: 'ip' | 'hostname';
  instance?: string;
  instance_type?: 'name' | 'id';
  /** 和 audit_type=host 一起用：按主机 display_id 精确过滤 */
  resource_id?: number;
  page?: number;
  page_size?: number;
}

export interface AuditLogRaw {
  id: number;
  audit_type: AuditType;
  user: string;
  resource_type: string;
  action: string;
  operate_from: string;
  operation_detail: {
    details: {
      pre_data: Record<string, unknown> | null;
      cur_data: Record<string, unknown> | null;
      update_fields: string[] | null;
    };
    bk_obj_id: string;
  };
  operation_time: string;
  bk_biz_id: number;
  biz_name: string;
  resource_id: number;
  resource_name: string;
}

export interface AuditListResponse {
  code: number;
  data: {
    count: number;
    info: AuditLogRaw[];
  };
}

export const listAuditLogs = (params: AuditQueryParams): Promise<AuditListResponse> => {
  return axios.get('/v1/audit', { params });
};

export interface AuditDetailResponse {
  code: number;
  data: AuditLogRaw;
}

/** 按 ID 取单条审计记录，结构和列表 data.info 里的一项相同；不存在返回 404 */
export const getAuditLog = (id: number | string): Promise<AuditDetailResponse> => {
  return axios.get(`/v1/audit/${encodeURIComponent(String(id))}`);
};
