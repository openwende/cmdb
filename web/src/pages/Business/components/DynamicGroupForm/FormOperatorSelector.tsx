import React, { useState, useMemo } from 'react';
import { Select } from 'antd';
import { Property, OperatorType } from '../../Types';
import { QUERY_OPERATOR, QUERY_OPERATOR_SYMBOL, QUERY_OPERATOR_DESC } from '../../constants';
import './style.css';

const { EQ, NE, IN, NIN, LTE, GTE, RANGE, LIKE } = QUERY_OPERATOR;
const typeMap = {
  bool: [EQ, NE],
  date: [GTE, LTE],
  enum: [IN, NIN],
  enummulti: [IN, NIN],
  enumquote: [IN, NIN],
  float: [EQ, NE, GTE, LTE, RANGE],
  int: [EQ, NE, GTE, LTE, RANGE],
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

interface OperatorOption {
  id: string;
  name: string;
  title: string;
}
interface FormOperatorSelectorProps {
  className?: string;
  property: Property;
  value?: OperatorType;
  disabled?: boolean;
  onChange?: (operator: OperatorType) => void;
}

const FormOperatorSelector: React.FC<FormOperatorSelectorProps> = ({
  className,
  property,
  value,
  disabled = false,
  onChange
}) => {
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  const options = useMemo(() => {
    const { bk_property_type: propertyType } = property;
    return typeMap[propertyType as keyof typeof typeMap].map((operator) => ({
      id: operator,
      name: QUERY_OPERATOR_SYMBOL[operator],
      title: QUERY_OPERATOR_DESC[operator]
    }))
  }, [property])

  return (
    <Select
      className={className}
      value={value}
      disabled={disabled}
      onChange={onChange}
      style={{ width: 120 }}
      optionLabelProp="name"
      getPopupContainer={(triggerNode) => (
        triggerNode.parentElement?.parentElement || document.body
      )}
    >
      {options.map((operator: OperatorOption) => (
        <Select.Option
          key={operator.id}
          value={operator.id}
          name={operator.name}
          onMouseEnter={() => setHoveredOption(operator.id)}
          onMouseLeave={() => setHoveredOption(null)}
        >
          <span>
            {operator.name}
            {hoveredOption === operator.id && operator.title && (
              <span className='operator-title'>
                ({operator.title})
              </span>
            )}
          </span>
        </Select.Option>
      ))}
    </Select>
  );
};

export default FormOperatorSelector;
