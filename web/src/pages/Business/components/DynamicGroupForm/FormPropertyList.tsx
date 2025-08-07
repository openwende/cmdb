import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { Form, Tooltip } from 'antd';
import { DeleteOutlined, SwapOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import FormOperatorSelector from './FormOperatorSelector';
import { ConditionType, Property, Condition, PropertyMap } from '../../Types';

interface ListProps {
  disabled?: boolean;
  conditionType: ConditionType;
  propertyMap: PropertyMap;
  searchObjId: string;
  onRemove: (property: Property) => void;
  onToggle: (property: Property, conditionType: ConditionType) => void;
  condition: Record<string, Condition>;
  onConditionChange: (condition: Record<string, Condition>) => void;
}

const FormPropertyList: React.FC<ListProps> = ({
  disabled = false,
  conditionType,
  propertyMap,
  searchObjId,
  onRemove,
  onToggle,
  condition,
  onConditionChange
}) => {
  const { t } = useTranslation();
  const propertyListRef = useRef<HTMLDivElement>(null);
  const [form] = Form.useForm();

  const withoutOperator = ['date', 'time', 'bool', 'service-template'];

  const conditionName = useMemo(() => {
    // const exchangeType = {
    //   [DynamicGroupConditionType.VARIABLE]: DynamicGroupConditionType.IMMUTABLE,
    //   [DynamicGroupConditionType.IMMUTABLE]: DynamicGroupConditionType.VARIABLE
    // };
    // const conditionNames = {
    //   [DynamicGroupConditionType.VARIABLE]: '可变条件',
    //   [DynamicGroupConditionType.IMMUTABLE]: '锁定条件'
    // };
    // return t(conditionNames[exchangeType[conditionType]]);
  }, [conditionType, t]);

  const filteredProperties = useMemo(() => {
    // return propertyMap.filter((property: any) => property.conditionType === conditionType);
    return [];
  }, [propertyMap, conditionType]);

  // 自定义操作符类型映射
  const customOperatorTypeMap = useMemo(() => {
    const operatorTypeMap = {
      float: ['$eq', '$ne', '$gte', '$lte', '$range'],
      int: ['$eq', '$ne', '$gte', '$lte', '$range']
    };

    if (searchObjId === 'host') {
      return {
        ...operatorTypeMap,
        longchar: ['$in', '$nin', '$contains', '$like'],
        singlechar: ['$in', '$nin', '$contains', '$like'],
        array: ['$in', '$nin', '$contains', '$like'],
        object: ['$in', '$nin', '$contains', '$like']
      };
    }

    return {
      ...operatorTypeMap,
      longchar: ['$in', '$nin', '$contains', '$contains_cs'],
      singlechar: ['$in', '$nin', '$contains', '$contains_cs'],
      array: ['$in', '$nin', '$contains', '$contains_cs'],
      object: ['$in', '$nin', '$contains', '$contains_cs']
    };
  }, [searchObjId]);

  const operatorSymbolMap: Record<string, string> = useMemo(() => {
    const baseMap = {
      '$eq': '等于',
      '$ne': '不等于',
      '$in': '属于',
      '$nin': '不属于',
      '$contains': '包含',
      '$gte': '大于等于',
      '$lte': '小于等于',
      '$range': '范围'
    };

    if (searchObjId === 'host') {
      return {
        ...baseMap,
        '$like': '包含'
      };
    }

    return {
      ...baseMap,
      '$contains_cs': '包含(区分大小写)'
    };
  }, [searchObjId]);

  const operatorDescMap = useMemo(() => {
    return operatorSymbolMap;
  }, [operatorSymbolMap]);

  const getDefaultData = (property: Property) => {
    const defaultMap: Record<string, { operator: string; value: any }> = {
      bool: {
        operator: '$eq',
        value: ''
      },
      date: {
        operator: '$range',
        value: []
      },
      float: {
        operator: '$eq',
        value: ''
      },
      int: {
        operator: '$eq',
        value: ''
      },
      time: {
        operator: '$range',
        value: []
      },
      'service-template': {
        operator: '$in',
        value: []
      }
    };

    return {
      ...defaultMap[property.bk_property_type],
      operator: defaultMap[property.bk_property_type]?.operator || '$in',
      value: defaultMap[property.bk_property_type]?.value || []
    };
  };

  const updateCondition = useCallback(() => {
    const newCondition: Record<string, Condition> = {};

    // filteredProperties.forEach((property: any) => {
    //   if (condition[property.id]) {
    //     // 修改conditionType为property.conditionType，保证conditionType正确
    //     condition[property.id].property.conditionType = property.conditionType;
    //     newCondition[property.id] = condition[property.id];
    //   } else {
    //     newCondition[property.id] = {
    //       property,
    //       ...getDefaultData(property)
    //     };
    //   }
    // });

    // 检查是否真的有变化再调用onConditionChange，避免无限循环
    const hasChanges = JSON.stringify(newCondition) !== JSON.stringify(condition);
    if (hasChanges) {
      onConditionChange(newCondition);
    }
  }, [filteredProperties, condition, onConditionChange]);

  useEffect(() => {
    updateCondition();
  }, [updateCondition]);

  const handleOperatorChange = (property: Property, operator: string) => {
    const newCondition = { ...condition };
    const currentCondition = newCondition[property.id];

    if (operator === '$range') {
      currentCondition.value = [];
    } else if (['$like', '$contains', '$contains_cs'].includes(operator)) {
      const currentValue = currentCondition.value;
      currentCondition.value = Array.isArray(currentValue) ? (currentValue[0] || '') : currentValue;
    } else {
      const defaultValue = getDefaultData(property).value;
      const currentValue = currentCondition.value;
      const isTypeChanged = Array.isArray(defaultValue) !== Array.isArray(currentValue);
      currentCondition.value = isTypeChanged ? defaultValue : currentValue;
    }

    currentCondition.operator = operator;
    onConditionChange(newCondition);
  };

  const handleRemove = (property: Property) => {
    if (disabled) return;
    onRemove(property);
  };

  const handleToggle = (property: Property) => {
    if (disabled) return;
    onToggle(property, conditionType);
  };

  const getPropertyLabel = (property: Property) => {
    const modelId = property.bk_obj_id;
    const propertyName = property.bk_property_name;
    // const modelName = propertyMap[modelId]?.bk_obj_name || modelId;
    const modelName = modelId;
    return `${modelName} - ${propertyName}`;
  };

  const getPlaceholder = (property: Property) => {
    const selectTypes = ['list', 'enum', 'timezone', 'organization', 'date', 'time', 'enumquote', 'enummulti', 'foreignkey'];
    const name = t(conditionType === ConditionType.IMMUTABLE ? '条件值' : '默认值');

    if (selectTypes.includes(property.bk_property_type)) {
      return t('请选择xx', { name });
    }

    return t('请输入xx', { name });
  };

  const renderComponent = (property: Property) => {
    // 这里需要根据property类型渲染不同的组件
    // 由于没有具体的组件实现，这里用Input作为占位符
    return (
      <input
        className="form-element"
        placeholder={getPlaceholder(property)}
        value={condition[property.id]?.value}
        onChange={(e) => {
          const newCondition = { ...condition };
          newCondition[property.id].value = e.target.value;
          onConditionChange(newCondition);
        }}
        disabled={disabled}
      />
    );
  };

  return (
    <div className="form-property-list" ref={propertyListRef}>
      <Form form={form} layout="vertical" labelCol={{ span: 24 }}>
        {filteredProperties.map((property: any) => (
          <Form.Item key={property.id} label={getPropertyLabel(property)}>
            <div className="form-property-item">
              {!withoutOperator.includes(property.bk_property_type) && (
                <FormOperatorSelector
                  className="item-operator"
                  property={property}
                  customTypeMap={customOperatorTypeMap}
                  symbolMap={operatorSymbolMap}
                  descMap={operatorDescMap}
                  value={condition[property.id]?.operator}
                  disabled={disabled}
                  onChange={(operator: string) => handleOperatorChange(property, operator)}
                />
              )}
              <div className="item-value">
                {renderComponent(property)}
              </div>
              {!disabled && (
                <>
                  <DeleteOutlined
                    className="item-remove"
                    onClick={() => handleRemove(property)}
                  />
                  <Tooltip title={t('切换为', { condition: conditionName })}>
                    <SwapOutlined
                      className="item-toggle"
                      onClick={() => handleToggle(property)}
                    />
                  </Tooltip>
                </>
              )}
            </div>
          </Form.Item>
        ))}
      </Form>
    </div>
  );
};

export default FormPropertyList;
