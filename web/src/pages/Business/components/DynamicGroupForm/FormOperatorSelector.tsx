import React from 'react';
import { Select } from 'antd';
import { Property } from './types';

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
  value,
  disabled = false,
  onChange
}) => {
  const getAvailableOperators = () => {
    const propertyType = property.bk_property_type;
    return customTypeMap[propertyType] || ['$in', '$nin'];
  };

  const availableOperators = getAvailableOperators();

  return (
    <Select
      className={className}
      value={value}
      disabled={disabled}
      onChange={onChange}
      style={{ width: 128 }}
    >
      {availableOperators.map((operator) => (
        <Select.Option key={operator} value={operator}>
          {symbolMap[operator] || operator}
        </Select.Option>
      ))}
    </Select>
  );
};

export default FormOperatorSelector;
