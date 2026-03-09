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
): { id: string; type: BusinessType } | null => {
  const path = pathname || window.location.pathname;
  const pathSegments = path.split('/');

  // Check if path is business path: /business/:businessId/...
  if (pathSegments.length >= 3 && pathSegments[1] === EntityRouteType.Business) {
    const id = pathSegments[2];
    if (id) {
      return {
        id,
        type: BusinessType.Business,
      };
    }
  }

  // Check if path is business set path: /business-set/:businessSetId/...
  if (pathSegments.length >= 3 && pathSegments[1] === EntityRouteType.BusinessSet) {
    const id = pathSegments[2];
    if (id) {
      return {
        id,
        type: BusinessType.BusinessSet,
      };
    }
  }

  return null;
};

/**
 * Get business ID from URL
 * @param pathname Current page path, uses window.location.pathname if not provided
 * @returns Business ID number, returns 0 if parsing fails
 */
export const getBusinessIdFromUrl = (pathname?: string): string => {
  const result = parseBusinessInfoFromUrl(pathname);
  return result ? result.id : '';
};
