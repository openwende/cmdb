import { useMemo } from 'react';
import { Property } from '../Types';

// The hook is used to derive various needed information from the property object
export const usePropertyInfo = (property: Property) => {
  return useMemo(() => {
    const {
      bk_obj_id: objId,
      bk_property_id: propertyId,
      bk_property_type: propertyType,
      option: options
    } = property;

    const isSetName = objId === 'set' && propertyId === 'bk_set_name';
    const isModuleName = objId === 'module' && propertyId === 'bk_module_name';

    return {
      objId,
      propertyId,
      propertyType,
      options,
      isSetName,
      isModuleName,
    };
  }, [property]);
};