/**
 * @description Common types for API responses
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
}
