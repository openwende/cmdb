import { useMemo } from 'react';
import { Property } from '../Types';

const normalizeOptions = (options: Property['option']) => {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  if (typeof options !== 'string') return options;

  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return options
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
};

// The hook is used to derive various needed information from the property object
export const usePropertyInfo = (property: Property) => {
  return useMemo(() => {
    const {
      bk_obj_id: objId,
      bk_property_id: propertyId,
      bk_property_type: propertyType,
      option: options,
    } = property;

    const isSetName = objId === 'set' && propertyId === 'bk_set_name';
    const isModuleName = objId === 'module' && propertyId === 'bk_module_name';

    return {
      objId,
      propertyId,
      propertyType,
      options: normalizeOptions(options),
      isSetName,
      isModuleName,
    };
  }, [property]);
};
