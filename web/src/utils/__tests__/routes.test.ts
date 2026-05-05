import { describe, it, expect } from 'vitest';
import {
  getBusinessTopologyPath,
  getBusinessSetTopologyPath,
  getEntityTopologyPath,
  getTransferHostPath,
  isBusinessPage,
  isBusinessSetPage,
  isBusinessRelatedPage,
  buildEntityPath,
  parseBusinessInfoFromUrl,
  getBusinessIdFromUrl,
} from '../routes';
import { BusinessType } from '../../store/BusinessStore';
import { EntityRouteType } from '../../routes/Types';

describe('Route Utilities', () => {
  describe('getBusinessTopologyPath', () => {
    it('should generate business topology path with numeric ID', () => {
      const path = getBusinessTopologyPath(123);
      expect(path).toBe('/business/123/topology');
    });

    it('should generate business topology path with string ID', () => {
      const path = getBusinessTopologyPath('456');
      expect(path).toBe('/business/456/topology');
    });
  });

  describe('getBusinessSetTopologyPath', () => {
    it('should generate business set topology path', () => {
      const path = getBusinessSetTopologyPath(789);
      expect(path).toBe('/business-set/789/topology');
    });
  });

  describe('getEntityTopologyPath', () => {
    it('should return business topology path when isBusinessSet is false', () => {
      const path = getEntityTopologyPath(123, false);
      expect(path).toBe('/business/123/topology');
    });

    it('should return business set topology path when isBusinessSet is true', () => {
      const path = getEntityTopologyPath(123, true);
      expect(path).toBe('/business-set/123/topology');
    });

    it('should default to business topology path when isBusinessSet is not provided', () => {
      const path = getEntityTopologyPath(123);
      expect(path).toBe('/business/123/topology');
    });
  });

  describe('getTransferHostPath', () => {
    it('should generate host transfer path', () => {
      const path = getTransferHostPath(123);
      expect(path).toBe('/business/123/topology/transferHost');
    });
  });

  describe('isBusinessPage', () => {
    it('should return true for business page paths', () => {
      expect(isBusinessPage('/business/123/topology')).toBe(true);
      expect(isBusinessPage('/business/456')).toBe(true);
    });

    it('should return false for non-business page paths', () => {
      expect(isBusinessPage('/business-set/123/topology')).toBe(false);
      expect(isBusinessPage('/home')).toBe(false);
      expect(isBusinessPage('/resource')).toBe(false);
    });
  });

  describe('isBusinessSetPage', () => {
    it('should return true for business set page paths', () => {
      expect(isBusinessSetPage('/business-set/123/topology')).toBe(true);
    });

    it('should return false for non-business set page paths', () => {
      expect(isBusinessSetPage('/business/123/topology')).toBe(false);
      expect(isBusinessSetPage('/home')).toBe(false);
    });
  });

  describe('isBusinessRelatedPage', () => {
    it('should return true for business related pages', () => {
      expect(isBusinessRelatedPage('/business/123/topology')).toBe(true);
      expect(isBusinessRelatedPage('/business-set/456/topology')).toBe(true);
    });

    it('should return false for non-business related pages', () => {
      expect(isBusinessRelatedPage('/home')).toBe(false);
      expect(isBusinessRelatedPage('/resource')).toBe(false);
    });
  });

  describe('buildEntityPath', () => {
    it('should build business path correctly', () => {
      const pathSegments = ['', 'business', '123', 'topology'];
      const path = buildEntityPath(pathSegments, EntityRouteType.Business, 'transferHost');
      expect(path).toBe('/business/123/transferHost');
    });

    it('should build business set path correctly', () => {
      const pathSegments = ['', 'business-set', '456', 'topology'];
      const path = buildEntityPath(pathSegments, EntityRouteType.BusinessSet, 'settings');
      expect(path).toBe('/business-set/456/settings');
    });

    it('should return default path when path segments are insufficient', () => {
      const pathSegments = ['', 'business'];
      const path = buildEntityPath(pathSegments, EntityRouteType.Business, 'settings');
      expect(path).toBe('/business');
    });

    it('should return default path when entity ID is empty', () => {
      const pathSegments = ['', 'business', '', 'topology'];
      const path = buildEntityPath(pathSegments, EntityRouteType.Business, 'settings');
      expect(path).toBe('/business');
    });
  });

  describe('parseBusinessInfoFromUrl', () => {
    it('should parse business path correctly', () => {
      const result = parseBusinessInfoFromUrl('/business/123/topology');
      expect(result).toEqual({
        id: '123',
        type: BusinessType.Business,
      });
    });

    it('should parse business set path correctly', () => {
      const result = parseBusinessInfoFromUrl('/business-set/456/topology');
      expect(result).toEqual({
        id: '456',
        type: BusinessType.BusinessSet,
      });
    });

    it('should parse business UUID path correctly', () => {
      const result = parseBusinessInfoFromUrl('/business/1001/topology');
      expect(result).toEqual({
        id: 1001,
        type: BusinessType.Business,
      });
    });

    it('should return null for path missing ID', () => {
      const result = parseBusinessInfoFromUrl('/business');
      expect(result).toBeNull();
    });

    it('should return null for non-business related paths', () => {
      const result = parseBusinessInfoFromUrl('/home');
      expect(result).toBeNull();
    });

    it('should return null for paths with sufficient segments but wrong type', () => {
      const result = parseBusinessInfoFromUrl('/resource/123/detail');
      expect(result).toBeNull();
    });
  });

  describe('getBusinessIdFromUrl', () => {
    it('should extract business ID correctly', () => {
      const id = getBusinessIdFromUrl('/business/123/topology');
      expect(id).toBe('123');
    });

    it('should extract business set ID correctly', () => {
      const id = getBusinessIdFromUrl('/business-set/456/topology');
      expect(id).toBe('456');
    });

    it('should return empty string for invalid paths', () => {
      const id = getBusinessIdFromUrl('/home');
      expect(id).toBe('');
    });

    it('should keep UUID business IDs intact', () => {
      const id = getBusinessIdFromUrl('/business/1001/topology');
      expect(id).toBe(1001);
    });
  });
});
