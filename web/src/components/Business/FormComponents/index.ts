/**
 * Form Components Registry - Factory Pattern with Lazy Loading
 * Provides dynamic form component rendering based on property type
 */

import { lazy, ComponentType } from 'react';
import { Property } from '../../../pages/Business/Types';

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
    'singlechar': lazy(() => import('./Singlechar')),
    'longchar': lazy(() => import('./Longchar')),
    'int': lazy(() => import('./Int')),
    'enum': lazy(() => import('./Enum')),
    'time': lazy(() => import('./Time')),
    'objuser': lazy(() => import('./ObjUser')),
    'list': lazy(() => import('./List')),
    'foreignkey': lazy(() => import('./Foreignkey')),
    'service-template': lazy(() => import('./ServiceTemplate')),
    'objname': lazy(() => import('./ObjName')),
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
            throw new Error(`组件类型 ${type} 不存在`);
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
