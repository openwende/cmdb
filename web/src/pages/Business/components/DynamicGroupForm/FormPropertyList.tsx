import React, { useMemo, useEffect } from 'react';
import { Form, Tooltip, Input } from 'antd';
import { DeleteOutlined, SwapOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import FormOperatorSelector from './FormOperatorSelector';
import { ConditionType, Property, Condition, ObjectMainLine, ConditionName } from '../../Types';
import {
  QUERY_OPERATOR,
  BUILTIN_MODELS,
  QUERY_OPERATOR_HOST_SYMBOL,
  QUERY_OPERATOR_OTHER_SYMBOL,
  QUERY_OPERATOR_HOST_DESC,
  QUERY_OPERATOR_OTHER_DESC
} from '../../constants';
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

type DefaultMapKey = keyof typeof defaultDataMap;
interface ListProps {
  conditionType: ConditionType;
  models: readonly ObjectMainLine[];
  selectedProperties: Property[];
  groupObjId: BUILTIN_MODELS;
  storageCondition: Record<string, any>;
  onConditionChange: (storageCondition: Record<string, any>) => void;
  disabled?: boolean;
  onRemove: (property: Property) => void;
  onToggle: (property: Property, conditionType: ConditionType) => void;
}

const FormPropertyList: React.FC<ListProps> = ({
  conditionType,
  models,
  groupObjId,
  selectedProperties,
  storageCondition,
  onConditionChange,
  disabled = false,
  onRemove,
  onToggle
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [condition, setCondition] = React.useState<Record<string, Condition>>({});

  useEffect(() => {
    updateCondition();
  }, [selectedProperties]);

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

  const customOperatorTypeMap = useMemo(() => {
    const { EQ, NE, GTE, LTE, RANGE, IN, NIN, LIKE, CONTAINS, CONTAINS_CS } = QUERY_OPERATOR;
    const operatorTypeMap = {
      float: [EQ, NE, GTE, LTE, RANGE],
      int: [EQ, NE, GTE, LTE, RANGE]
    };
    if (groupObjId === BUILTIN_MODELS.HOST) {
      return {
        ...operatorTypeMap,
        longchar: [IN, NIN, CONTAINS, LIKE],
        singlechar: [IN, NIN, CONTAINS, LIKE],
        array: [IN, NIN, CONTAINS, LIKE],
        object: [IN, NIN, CONTAINS, LIKE]
      };
    }
    return {
      ...operatorTypeMap,
      longchar: [IN, NIN, CONTAINS, CONTAINS_CS],
      singlechar: [IN, NIN, CONTAINS, CONTAINS_CS],
      array: [IN, NIN, CONTAINS, CONTAINS_CS],
      object: [IN, NIN, CONTAINS, CONTAINS_CS]
    };
  }, [groupObjId]);

  const operatorSymbolMap = useMemo(() => {
    if (groupObjId === BUILTIN_MODELS.HOST) {
      return QUERY_OPERATOR_HOST_SYMBOL;
    }
    return QUERY_OPERATOR_OTHER_SYMBOL;
  }, [groupObjId]);

  const operatorDescMap = useMemo(() => {
    if (groupObjId === BUILTIN_MODELS.HOST) {
      return QUERY_OPERATOR_HOST_DESC;
    }
    return QUERY_OPERATOR_OTHER_DESC;
  }, [groupObjId]);

  const getDefaultData = (property: Property) => {
    const specificDefault = defaultDataMap[property.bk_property_type as DefaultMapKey];
    return {
      operator: specificDefault?.operator ?? '$in',
      value: specificDefault?.value ?? []
    };
  }

  const updateCondition = () => {
    const newCondition: Record<string, Condition> = {}
    properties.forEach((property) => {
      if (storageCondition && storageCondition[property.id]) {
        // 修改conditionType为property.conditionType，保证conditionType正确
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

  const handleOperatorChange = (property: Property, operator: any) => {
    const newCondition = { ...condition };
    if (operator === QUERY_OPERATOR.RANGE) {
      newCondition[property.id].value = [];
    } else if ([QUERY_OPERATOR.LIKE, QUERY_OPERATOR.CONTAINS, QUERY_OPERATOR.CONTAINS_CS].includes(operator)) {
      const currentValue = condition[property.id].value;
      newCondition[property.id].value = Array.isArray(currentValue) ? (currentValue[0] || '') : currentValue;
    } else {
      const defaultValue = getDefaultData(property).value;
      const currentValue = condition[property.id].value;
      const isTypeChanged = (Array.isArray(defaultValue)) !== (Array.isArray(currentValue));
      newCondition[property.id].value = isTypeChanged ? defaultValue : currentValue;
    }
    setCondition(newCondition);
  };

  const getPropertyLabel = (property: Property) => {
    const modelId = property.bk_obj_id;
    const propertyName = property.bk_property_name;
    const modelName = modelMap[modelId].bk_obj_name;
    return `${modelName} - ${propertyName}`;
  };

  const getPlaceholder = (property: Property) => {
    const selectTypes = ['list', 'enum', 'timezone', 'organization', 'date', 'time', 'enumquote', 'enummulti', 'foreignkey'];
    const name = t(conditionType === ConditionType.IMMUTABLE ? '条件值' : '默认值');

    if (selectTypes.includes(property.bk_property_type)) {
      return t('请选择', { name });
    }

    return t('请输入', { name });
  };

  const renderComponent = (property: Property) => {
    return (
      <Input
        className="form-element"
        placeholder={getPlaceholder(property)}
        // value={condition[property.id]?.value}
        // onChange={(e) => {
        //   const newCondition = { ...condition };
        //   newCondition[property.id].value = e.target.value;
        //   onConditionChange(newCondition);
        // }}
        disabled={disabled}
      />
    );
  };

  return (
    <div className="form-property-list">
      <Form form={form} layout="vertical" labelCol={{ span: 24 }}>
        {properties.map((property: Property) => (
          <div className="form-property-item">
            {/* The First Line */}
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
                  customTypeMap={customOperatorTypeMap}
                  symbolMap={operatorSymbolMap}
                  descMap={operatorDescMap}
                  // value={condition[property.id].operator}
                  disabled={disabled}
                  onChange={(operator) => handleOperatorChange(property, operator)}
                />
              )}
              <div className="item-value">
                {renderComponent(property)}
              </div>
            </div>
          </div>
        ))}
      </Form>
    </div>
  );
};

export default FormPropertyList;
