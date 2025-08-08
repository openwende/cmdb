import React from 'react';
import { Select } from 'antd';
import { Property } from '../../Types';
import { QUERY_OPERATOR } from '../../constants';
import { getOperatorSymbol } from '../../utils';

interface FormOperatorSelectorProps {
  className?: string;
  property: Property;
  customTypeMap: Record<string, string[]>;
  symbolMap: Record<string, string>;
  descMap: Record<string, string>;
  value?: string;
  disabled?: boolean;
  onChange?: (operator: string) => void;
}

const FormOperatorSelector: React.FC<FormOperatorSelectorProps> = ({
  className,
  property,
  customTypeMap,
  symbolMap,
  descMap,
  value,
  disabled = false,
  onChange
}) => {
  const options = () => {
    const { EQ, NE, IN, NIN, LT, GT, LTE, GTE, RANGE, LIKE } = QUERY_OPERATOR;

    const defaultTypeMap = {
      bool: [EQ, NE],
      date: [GTE, LTE],
      enum: [IN, NIN],
      enummulti: [IN, NIN],
      enumquote: [IN, NIN],
      float: [EQ, NE, GT, LT, RANGE],
      int: [EQ, NE, GT, LT, RANGE],
      list: [IN, NIN],
      longchar: [IN, NIN, LIKE],
      objuser: [IN, NIN],
      organization: [IN, NIN],
      singlechar: [IN, NIN, LIKE],
      time: [GTE, LTE],
      timezone: [IN, NIN],
      foreignkey: [IN, NIN],
      table: [IN, NIN],
      'service-template': [IN],
      array: [IN, NIN, LIKE],
      object: [IN, NIN, LIKE],
      map: [IN, NIN]
    };

    const typeMap: any = { ...defaultTypeMap, ...customTypeMap };
    const { bk_property_type: propertyType } = property;

    return typeMap[propertyType].map((operator: any) => ({
      id: operator,
      name: getOperatorSymbol(operator, symbolMap),
      title: descMap[operator]
    }))
  }

  return (
    <Select
      className={className}
      value={value}
      disabled={disabled}
      onChange={onChange}
      style={{ width: 128 }}
    >
      {options().map((operator: any) => (
        <Select.Option key={operator} value={operator}>
          {symbolMap[operator] || operator}
        </Select.Option>
      ))}
    </Select>
  );
};

export default FormOperatorSelector;
