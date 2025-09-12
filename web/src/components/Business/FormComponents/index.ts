/**
 * Form Components Registry - Factory Pattern with Lazy Loading
 * Provides dynamic form component rendering based on property type
 */

import { lazy, ComponentType } from 'react';
import { Property } from '../../../pages/Business/Types';
import {PROPERTY_TYPES} from '../../../pages/Business/constants';

// Unified Props interface for all form components
export interface FormComponentProps {
    property: Property;
    value: any;
    onChange: (value: any) => void;
    placeholder: string;
    options: any[] | { [key: string]: any };
    disabled?: boolean;
    [key: string]: any;
}
export interface SelectOption {
  label: string;
  value: number | string;
}

// Lazy-loaded components mapping
const LAZY_COMPONENTS = {
    [PROPERTY_TYPES.SINGLECHAR]: lazy(() => import('./Singlechar')),
    [PROPERTY_TYPES.LONGCHAR]: lazy(() => import('./Longchar')),
    [PROPERTY_TYPES.INT]: lazy(() => import('./Int')),
    [PROPERTY_TYPES.ENUM]: lazy(() => import('./Enum')),
    [PROPERTY_TYPES.TIME]: lazy(() => import('./Time')),
    [PROPERTY_TYPES.OBJUSER]: lazy(() => import('./ObjUser')),
    [PROPERTY_TYPES.LIST]: lazy(() => import('./List')),
    [PROPERTY_TYPES.FOREIGNKEY]: lazy(() => import('./Foreignkey')),
    [PROPERTY_TYPES.SERVICE_TEMPLATE]: lazy(() => import('./ServiceTemplate')),
    [PROPERTY_TYPES.OBJNAME]: lazy(() => import('./ObjName')),
    // ... other components
} as const;

class ComponentFactory {
    private static cache = new Map<string, ComponentType<any>>();

    static async getComponent(type: string): Promise<ComponentType<any>> {
        // Cache check
        if (this.cache.has(type)) {
            return this.cache.get(type)!;
        }

        // Lazy-load component
        const LazyComponent = LAZY_COMPONENTS[type as keyof typeof LAZY_COMPONENTS];
        if (!LazyComponent) {
            // Note: For i18n error messages, handle in the calling component where t() is available
            throw new Error(`Component type ${type} not found`);
        }

        // Directly return lazy-loaded component
        this.cache.set(type, LazyComponent);

        return this.cache.get(type)!;
    }
}

// Export helper function for direct component access
export async function getFormComponent(componentType: string): Promise<ComponentType<any>> {
    return await ComponentFactory.getComponent(componentType);
}
