/**
 * @description API types
 * Resource-related types
 */
/**
 * @description Business-related types
 */
export interface BusinessListParams {
  limit: number;
  offset: number;
}
export interface BusinessListResponse {
  items: BusinessDetail[];
  limit: number;
  offset: number;
  total: number;
  // R8 统一响应规范的标准分页字段（过渡期与 limit/offset/total 并存，逐步迁移到这里）
  pagination?: {
    page: number;
    page_size: number;
    total: number;
  };
}

/**
 * 创建业务请求参数
 * 对齐蓝鲸 CMDB v3 业务模型
 */
export interface CreateBusinessRequest {
  name: string;
  description?: string;
  identifier?: string;
  lifecycle?: 'testing' | 'online' | 'offline';
  timezone?: string; // 时区，如 "Asia/Shanghai", "UTC"
  language?: string; // 语言，如 "zh", "en"

  // 业务角色（对齐蓝鲸 CMDB）
  sres: string[]; // 运维人员 (bk_biz_maintainer)
  developers: string[]; // 开发人员 (bk_biz_developer)
  testers: string[]; // 测试人员 (bk_biz_tester)
  bizops: string[]; // 产品人员 (bk_biz_productor)
}

/**
 * 更新业务请求参数
 */
export interface UpdateBusinessRequest {
  name?: string;
  description?: string;
  lifecycle?: 'testing' | 'online' | 'offline';
  timezone?: string;
  language?: string;
  sres?: string[];
  developers?: string[];
  testers?: string[];
  bizops?: string[];
}

/**
 * 业务详情（展示层类型，包含响应字段）
 */
export interface BusinessDetail {
  id: number;
  name: string;
  language: string;
  lifecycle?: 'testing' | 'online' | 'offline';
  timezone: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  description?: string;
  identifier?: string;
  sres: string[];
  bizops?: string[];
  testers?: string[];
  developers?: string[];
}
