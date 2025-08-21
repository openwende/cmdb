import React, { useMemo, useEffect } from 'react';
import { Tooltip } from 'antd';
import { DeleteOutlined, SwapOutlined } from '@ant-design/icons';
import FormOperatorSelector from './FormOperatorSelector';
import FormComponent from './FormComponent';
import { ConditionType, Property, Condition, ObjectMainLine, ConditionName, OperatorType } from '../../Types';
import { QUERY_OPERATOR } from '../../constants';
import './style.css';

const defaultDataMap = {
  bool: { operator: '$eq', value: '' },
  date: { operator: '$range', value: [] },
  float: { operator: '$eq', value: '' },
  int: { operator: '$eq', value: '' },
  time: { operator: '$range', value: [] },
  'service-template': { operator: '$in', value: [] }
};
const WITHOUT_OPERATOR = ['date', 'time', 'bool', 'service-template'];
const exchangeName = {
  [ConditionType.VARIABLE]: ConditionName.IMMUTABLE,
  [ConditionType.IMMUTABLE]: ConditionName.VARIABLE
}
const SUPPORTED_OPERATORS = [
  QUERY_OPERATOR.LIKE,
  QUERY_OPERATOR.CONTAINS,
  QUERY_OPERATOR.CONTAINS_CS
] as OperatorType[];

type DefaultMapKey = keyof typeof defaultDataMap;
interface ListProps {
  bizId: number;
  conditionType: ConditionType;
  models: readonly ObjectMainLine[];
  selectedProperties: Property[];
  storageCondition: Record<string, any>;
  onConditionChange: (storageCondition: Record<string, any>) => void;
  disabled?: boolean;
  onRemove: (property: Property) => void;
  onToggle: (property: Property, conditionType: ConditionType) => void;
}

const FormPropertyList: React.FC<ListProps> = ({
  bizId,
  conditionType,
  models,
  selectedProperties,
  storageCondition,
  onConditionChange,
  disabled = false,
  onRemove,
  onToggle
}) => {
  const [condition, setCondition] = React.useState<Record<string, Condition>>({});

  useEffect(() => {
    if (Object.keys(condition).length > 0) {
      onConditionChange({ ...storageCondition, ...condition });
    }
  }, [condition]);

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
    const specificDefault = defaultDataMap[property.bk_property_type as DefaultMapKey];
    return {
      operator: (specificDefault?.operator ?? '$in') as OperatorType,
      value: specificDefault?.value ?? []
    };
  }

  const updateCondition = () => {
    const newCondition: Record<string, Condition> = {}
    properties.forEach((property) => {
      if (storageCondition && storageCondition[property.id]) {
        // If the property already exists in storageCondition, use it
        storageCondition[property.id].property.conditionType = property.conditionType
        newCondition[property.id] = storageCondition[property.id]
      } else {
        newCondition[property.id] = {
          property,
          ...getDefaultData(property)
        }
      }
    })
    setCondition(newCondition);
  }

  const handleOperatorChange = (property: Property, operator: OperatorType) => {
    const currentItem = condition[property.id];
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
      ...condition,
      [property.id]: {
        ...currentItem,
        operator: operator,
        value: newValue,
      }
    };

    setCondition(newCondition);
  };

  const handleComponentChange = (property: Property, value: any) => {
    console.log('Component changed:', property, value);
    const currentItem = condition[property.id];
    const newCondition = {
      ...condition,
      [property.id]: {
        ...currentItem,
        value: value
      }
    };
    setCondition(newCondition);
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
        <div key={property.id} className="form-property-item">
          {/* The first line */}
          <div className="item-header">
            <div className="item-label">
              {getPropertyLabel(property)}
            </div>
            {!disabled && (
              <div className="item-actions">
                <Tooltip title={`切换为${exchangeName[conditionType]}`}>
                  <SwapOutlined
                    className="item-toggle"
                    onClick={() => onToggle(property, conditionType)}
                  />
                </Tooltip>
                <DeleteOutlined
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
                value={condition[property.id]?.operator}
                disabled={disabled}
                onChange={(operator) => handleOperatorChange(property, operator)}
              />
            )}
            <div className="item-value">
              <FormComponent
                property={property}
                conditionType={conditionType}
                operator={condition[property.id]?.operator}
                value={condition[property.id]?.value}
                disabled={disabled}
                bizId={bizId}
                onChange={(value) => handleComponentChange(property, value)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FormPropertyList;
