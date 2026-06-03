import React, { useMemo, useEffect, useState } from 'react';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import FormOperatorSelector from './OperatorSelector';
import FormComponent from './FormComponent';
import { Property, Condition, ObjectMainLine, OperatorType } from '../../Types';
import { QUERY_OPERATOR, DEFAULT_CONDITIONS_DATA, PROPERTY_TYPES } from '../../constants';
import { isValidCondition } from '../../utils';
import './style.css';

const WITHOUT_OPERATOR = [
  PROPERTY_TYPES.DATE,
  PROPERTY_TYPES.TIME,
  PROPERTY_TYPES.BOOL,
  PROPERTY_TYPES.SERVICE_TEMPLATE,
];

const SUPPORTED_OPERATORS = [
  QUERY_OPERATOR.LIKE,
  QUERY_OPERATOR.CONTAINS,
  QUERY_OPERATOR.CONTAINS_CS,
] as OperatorType[];

type DefaultMapKey = keyof typeof DEFAULT_CONDITIONS_DATA;
interface ListProps {
  bizId: number | string;
  models: readonly ObjectMainLine[];
  selectedProperties: Property[];
  conditions: Record<string, Condition>;
  storageConditions: Record<string, any>;
  errors: Set<number>;
  disabled?: boolean;
  onRemove: (property: Property) => void;
  onConditionChange: (condition: Record<string, Condition>) => void;
  onUpdateErrors: (propertyId: number, hasError: boolean) => void;
}

const PropertyList: React.FC<ListProps> = ({
  bizId,
  models,
  selectedProperties,
  conditions,
  storageConditions,
  errors,
  disabled = false,
  onRemove,
  onConditionChange,
  onUpdateErrors,
}) => {
  const { t } = useTranslation();
  const [hoveredProperty, setHoveredProperty] = useState<number | null>(null);

  const properties = selectedProperties;

  const modelMap = useMemo(() => {
    const map: Record<string, ObjectMainLine> = {};
    models.forEach((model) => {
      map[model.bk_obj_id] = model;
    });
    return map;
  }, [models]);

  useEffect(() => {
    updateCondition();
  }, [properties]);

  const getDefaultData = (property: Property) => {
    const specificDefault = DEFAULT_CONDITIONS_DATA[property.bk_property_type as DefaultMapKey];
    return {
      operator: (specificDefault?.operator ?? QUERY_OPERATOR.IN) as OperatorType,
      value: specificDefault?.value ?? [],
    };
  };

  const updateCondition = () => {
    const newCondition: Record<string, Condition> = {};

    properties.forEach((property) => {
      const stored = storageConditions?.[property.id];
      if (stored) {
        newCondition[property.id] = {
          ...stored,
          property: { ...stored.property },
        };
      } else {
        newCondition[property.id] = {
          property,
          ...getDefaultData(property),
        };
      }
    });
    onConditionChange(newCondition);
  };

  const handleOperatorChange = (property: Property, operator: OperatorType) => {
    const currentItem = conditions[property.id];
    let newValue;

    if (operator === QUERY_OPERATOR.RANGE) {
      newValue = [];
    } else if (SUPPORTED_OPERATORS.includes(operator)) {
      const currentValue = currentItem.value;
      newValue = Array.isArray(currentValue) ? currentValue[0] || '' : currentValue;
    } else {
      const defaultValue = getDefaultData(property).value;
      const currentValue = currentItem.value;
      const isTypeChanged = Array.isArray(defaultValue) !== Array.isArray(currentValue);
      newValue = isTypeChanged ? defaultValue : currentValue;
    }

    const newCondition = {
      [property.id]: {
        ...currentItem,
        operator: operator,
        value: newValue,
      },
    };

    onConditionChange(newCondition);
  };

  const updateErrors = (propertyId: number, hasError: boolean) => {
    onUpdateErrors(propertyId, hasError);
  };

  const handleComponentChange = (property: Property, value: any) => {
    const currentItem = conditions[property.id];
    const newCondition = {
      [property.id]: {
        ...currentItem,
        value: value,
      },
    };
    onConditionChange(newCondition);

    // Validate field value
    const hasError = !isValidCondition(value);
    updateErrors(property.id, hasError);
  };

  const getPropertyLabel = (property: Property) => {
    const modelId = property.bk_obj_id;
    const propertyName = property.bk_property_name;
    const modelName = modelMap[modelId]?.bk_obj_name || modelId;
    return `${modelName} - ${propertyName}`;
  };

  return (
    <div className="form-property-list">
      {properties.map((property: Property) => (
        <div
          key={property.id}
          className="form-property-item"
          onMouseEnter={() => setHoveredProperty(property.id)}
          onMouseLeave={() => setHoveredProperty(null)}
        >
          {/* The first line */}
          <div className="item-header">
            <div className="item-label">{getPropertyLabel(property)}</div>
            {!disabled && hoveredProperty === property.id && (
              <div className="item-actions">
                <CloseOutlined className="item-remove" onClick={() => onRemove(property)} />
              </div>
            )}
          </div>

          {/* The second line */}
          <div className="item-controls">
            {!WITHOUT_OPERATOR.includes(property.bk_property_type as PROPERTY_TYPES) && (
              <FormOperatorSelector
                className="item-operator"
                property={property}
                value={conditions[property.id]?.operator}
                disabled={disabled}
                onChange={(operator) => handleOperatorChange(property, operator)}
              />
            )}
            <div className="item-value">
              <FormComponent
                property={property}
                operator={conditions[property.id]?.operator}
                value={conditions[property.id]?.value}
                disabled={disabled}
                bizId={bizId}
                onChange={(value) => handleComponentChange(property, value)}
              />
            </div>
          </div>

          {/* Error message */}
          {errors.has(property.id) && (
            <div className="form-error">
              {t('business.dynamicGroupForm.propertyList.requiredFieldError')}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PropertyList;
