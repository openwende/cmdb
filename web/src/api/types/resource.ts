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
}
export interface BusinessDetail {
  id: string;
  name: string;
  language: string;
  lifecycle?: string;
  timezone: string;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  updated_by?: string;
  sres: string[];
  bizops?: string[];
  testers?: string[];
  developers?: string[];
  operators?: string[];
}
