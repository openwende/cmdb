/**
 * Route path building functions for the application
 * These functions are used to generate standardized route paths, ensuring consistent route formats throughout the application
 */

import { BusinessType } from '../store/BusinessStore';
import { EntityRouteType } from '../routes/Types';

/**
 * Generate business topology page path
 * @param id Business ID
 * @returns Complete business topology page path
 */
export const getBusinessTopologyPath = (id: number | string): string => {
  return `/business/${id}/topology`;
};

/**
 * Generate business set topology page path
 * @param id Business set ID
 * @returns Complete business set topology page path
 */
export const getBusinessSetTopologyPath = (id: number | string): string => {
  return `/business-set/${id}/topology`;
};

/**
 * Generate business or business set topology page path
 * @param id Business or business set ID
 * @param isBusinessSet Whether it is a business set
 * @returns Corresponding topology page complete path
 */
export const getEntityTopologyPath = (
  id: number | string,
  isBusinessSet: boolean = false,
): string => {
  return isBusinessSet ? getBusinessSetTopologyPath(id) : getBusinessTopologyPath(id);
};

/**
 * Generate host transfer page path
 * @param id Business ID
 * @returns Complete host transfer page path
 */
export const getTransferHostPath = (id: number | string): string => {
  return `${getBusinessTopologyPath(id)}/transferHost`;
};

/**
 * Check if current path is a business-related page
 * @param pathname Current page path
 * @returns Whether it is a business-related page
 */
export const isBusinessPage = (pathname: string): boolean => {
  return pathname.startsWith('/business/');
};

/**
 * Check if current path is a business set related page
 * @param pathname Current page path
 * @returns Whether it is a business set related page
 */
export const isBusinessSetPage = (pathname: string): boolean => {
  return pathname.startsWith('/business-set/');
};

/**
 * Check if current path is a business or business set related page
 * @param pathname Current page path
 * @returns Whether it is a business or business set related page
 */
export const isBusinessRelatedPage = (pathname: string): boolean => {
  return isBusinessPage(pathname) || isBusinessSetPage(pathname);
};

/**
 * Build business or business set related page path
 * @param pathSegments Current path split into array
 * @param entityType Entity type for URL path
 * @param itemPath Target page path
 * @returns Complete built path, or null if unable to build
 */
export const buildEntityPath = (
  pathSegments: string[],
  entityType: EntityRouteType,
  itemPath: string,
): string => {
  if (pathSegments.length >= 3) {
    const entityId = pathSegments[2];
    if (entityId) {
      return `/${entityType}/${entityId}/${itemPath}`;
    }
  }
  return '/business';
};

/**
 * Parse business ID and type information from URL
 * @param pathname Current page path, uses window.location.pathname if not provided
 * @returns Object containing ID and type, or null if parsing fails
 */
export const parseBusinessInfoFromUrl = (
  pathname?: string,
): { id: number; type: BusinessType } | null => {
  const path = pathname || window.location.pathname;
  const pathSegments = path.split('/');

  // Check if path is business path: /business/:businessId/...
  if (pathSegments.length >= 3 && pathSegments[1] === EntityRouteType.Business) {
    const rawId = pathSegments[2];
    const id = parseInt(rawId, 10);
    if (!rawId || isNaN(id)) return null;
    return {
      id,
      type: BusinessType.Business,
    };
  }

  // Check if path is business set path: /business-set/:businessSetId/...
  if (pathSegments.length >= 3 && pathSegments[1] === EntityRouteType.BusinessSet) {
    const rawId = pathSegments[2];
    const id = parseInt(rawId, 10);
    if (!rawId || isNaN(id)) return null;
    return {
      id,
      type: BusinessType.BusinessSet,
    };
  }

  return null;
};

/**
 * Get business ID from URL
 * @param pathname Current page path, uses window.location.pathname if not provided
 * @returns Business ID number, returns 0 if parsing fails
 */
export const getBusinessIdFromUrl = (pathname?: string): number | null => {
  const result = parseBusinessInfoFromUrl(pathname);
  return result ? result.id : null;
};

/** 审计页深链参数：`/analysis/audit?record_id=895` 打开该记录的详情抽屉 */
export const AUDIT_RECORD_QUERY_KEY = 'record_id';

/**
 * Generate audit page path that opens one audit record's detail drawer
 * @param recordId Audit record ID
 * @returns Audit page path with the record_id query
 */
export const getAuditRecordPath = (recordId: number | string): string => {
  const query = new URLSearchParams({ [AUDIT_RECORD_QUERY_KEY]: String(recordId) });
  return `/analysis/audit?${query.toString()}`;
};

/** 主机资源页路径 */
export const HOST_RESOURCE_PATH = '/resource/host';

/** 主机详情深链参数：`/resource/host?host_id=43` 打开该主机的详情抽屉（值是主机 display_id） */
export const HOST_DETAIL_QUERY_KEY = 'host_id';

/**
 * Generate host resource page path that opens one host's detail drawer
 * @param displayId Host display_id (the ID shown in lists, AI answers and host audit records)
 * @returns Host resource page path with the host_id query
 */
export const getHostDetailPath = (displayId: number | string): string => {
  const query = new URLSearchParams({ [HOST_DETAIL_QUERY_KEY]: String(displayId) });
  return `${HOST_RESOURCE_PATH}?${query.toString()}`;
};

/** 打开主机详情时压入的历史记录里，记下从哪个页面打开的（location.state 的 key） */
export const HOST_DETAIL_FROM_STATE_KEY = 'hostDetailFrom';

/**
 * Navigation state for opening the host detail drawer with a pushed history entry.
 * When the drawer is opened from the host page itself, closing it goes back to the
 * entry before instead of leaving a duplicate `/resource/host` entry.
 * @param fromPathname Pathname of the page where the drawer was opened
 */
export const getHostDetailNavigationState = (fromPathname: string) => ({
  [HOST_DETAIL_FROM_STATE_KEY]: fromPathname,
});

export type HostIdParam =
  | { status: 'missing' }
  | { status: 'invalid' }
  | { status: 'valid'; displayId: number };

/**
 * 解析主机深链参数：没有参数（或空串）为 missing；正整数为 valid；其余为 invalid
 * @param value `host_id` 查询参数的原始值
 */
export const parseHostIdParam = (value: string | null | undefined): HostIdParam => {
  if (value === null || value === undefined || value === '') return { status: 'missing' };
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return { status: 'invalid' };
  const displayId = Number(trimmed);
  if (!Number.isSafeInteger(displayId) || displayId <= 0) return { status: 'invalid' };
  return { status: 'valid', displayId };
};
