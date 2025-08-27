import React, { useMemo, useEffect, useState } from 'react';
import { Tooltip } from 'antd';
import { CloseOutlined, SwapOutlined } from '@ant-design/icons';
import FormOperatorSelector from './FormOperatorSelector';
import FormComponent from './FormComponent';
import { ConditionType, Property, Condition, ObjectMainLine, ConditionName, OperatorType } from '../../Types';
import { QUERY_OPERATOR, DEFAULT_CONDITIONS_DATA } from '../../constants';
import { isValidCondition } from '../../utils';
import './style.css';

const WITHOUT_OPERATOR = [
  'date',
  'time',
  'bool',
  'service-template'
];
const exchangeName = {
  [ConditionType.VARIABLE]: ConditionName.IMMUTABLE,
  [ConditionType.IMMUTABLE]: ConditionName.VARIABLE
}
const SUPPORTED_OPERATORS = [
  QUERY_OPERATOR.LIKE,
  QUERY_OPERATOR.CONTAINS,
  QUERY_OPERATOR.CONTAINS_CS
] as OperatorType[];

type DefaultMapKey = keyof typeof DEFAULT_CONDITIONS_DATA;
interface ListProps {
  bizId: number;
  conditionType: ConditionType;
  models: readonly ObjectMainLine[];
  selectedProperties: Property[];
  conditions: Record<string, Condition>;
  storageConditions: Record<string, any>;
  errors: Set<number>;
  disabled?: boolean;
  onRemove: (property: Property) => void;
  onToggle: (property: Property, conditionType: ConditionType) => void;
  onConditionChange: (condition: Record<string, Condition>) => void;
  onUpdateErrors: (propertyId: number, hasError: boolean) => void;
}

const FormPropertyList: React.FC<ListProps> = ({
  bizId,
  conditionType,
  models,
  selectedProperties,
  conditions,
  storageConditions,
  errors,
  disabled = false,
  onRemove,
  onToggle,
  onConditionChange,
  onUpdateErrors
}) => {
  const [hoveredProperty, setHoveredProperty] = useState<number | null>(null);

  const properties = useMemo(() => {
    return selectedProperties.filter(property => {
      return property.conditionType === conditionType;
    });
  }, [selectedProperties, conditionType]);

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
      value: specificDefault?.value ?? []
    };
  }

  const updateCondition = () => {
    const newCondition: Record<string, Condition> = {}
    properties.forEach((property) => {
      if (storageConditions && storageConditions[property.id]) {
        // If the property already exists in storageConditions, use it
        storageConditions[property.id].property.conditionType = property.conditionType;
        newCondition[property.id] = storageConditions[property.id];
      } else {
        newCondition[property.id] = {
          property,
          ...getDefaultData(property),
        };
      }
    })
    onConditionChange(newCondition);
  }

  const handleOperatorChange = (property: Property, operator: OperatorType) => {
    const currentItem = conditions[property.id];
    let newValue;

    if (operator === QUERY_OPERATOR.RANGE) {
      newValue = [];
    } else if (SUPPORTED_OPERATORS.includes(operator)) {
      const currentValue = currentItem.value;
      newValue = Array.isArray(currentValue) ? (currentValue[0] || '') : currentValue;
    } else {
      const defaultValue = getDefaultData(property).value;
      const currentValue = currentItem.value;
      const isTypeChanged = Array.isArray(defaultValue) !== Array.isArray(currentValue);
      newValue = isTypeChanged ? defaultValue : currentValue;
    }

    const newCondition = {
      ...conditions,
      [property.id]: {
        ...currentItem,
        operator: operator,
        value: newValue,
      }
    };

    onConditionChange(newCondition);
  };

  const updateErrors = (propertyId: number, hasError: boolean) => {
    onUpdateErrors(propertyId, hasError);
  };

  const handleComponentChange = (property: Property, value: any) => {
    const currentItem = conditions[property.id];
    const newCondition = {
      ...conditions,
      [property.id]: {
        ...currentItem,
        value: value
      }
    };
    onConditionChange(newCondition);

    // Validate field value
    const hasError = !isValidCondition(value);
    updateErrors(property.id, hasError);
  };

  const getPropertyLabel = (property: Property) => {
    const modelId = property.bk_obj_id;
    const propertyName = property.bk_property_name;
    const modelName = modelMap[modelId].bk_obj_name;
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
            <div className="item-label">
              {getPropertyLabel(property)}
            </div>
            {!disabled && hoveredProperty === property.id && (
              <div className="item-actions">
                <Tooltip title={`切换为${exchangeName[conditionType]}`}>
                  <SwapOutlined
                    className="item-toggle"
                    onClick={() => onToggle(property, conditionType)}
                  />
                </Tooltip>
                <CloseOutlined
                  className="item-remove"
                  onClick={() => onRemove(property)}
                />
              </div>
            )}
          </div>

          {/* The second line */}
          <div className="item-controls">
            {!WITHOUT_OPERATOR.includes(property.bk_property_type) && (
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
                conditionType={conditionType}
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
              该字段是必填项
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FormPropertyList;
