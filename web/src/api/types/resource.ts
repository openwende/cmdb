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
export interface BusinessItem {
  id: string;
  name: string;
  address: string;
}
export interface BusinessListResponse {
  items: BusinessItem[];
  limit: number;
  offset: number;
  total: number;
}
export interface CreateBusinessParams {
  name: string;
  language: string;
  lifecycle?: string;
  timezone: string;
  maintainers: string[];
  productManagers?: string[];
  testers?: string[];
  developers?: string[];
  administrators?: string[];
}
