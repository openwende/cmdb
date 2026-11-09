import React, { useState, useMemo } from 'react';
import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { Property, OperatorType } from '../../Types';
import { QUERY_OPERATOR_SYMBOL, DEFAULT_OPERATOR_MAP } from '../../constants';
import { getQueryOperatorDesc } from '../../utils';
import './style.css';

type OperatorMapKey = keyof typeof DEFAULT_OPERATOR_MAP;
interface OperatorOption {
  id: string;
  name: string;
  title: string;
}
interface OperatorSelectorProps {
  className?: string;
  property: Property;
  value?: OperatorType;
  disabled?: boolean;
  onChange?: (operator: OperatorType) => void;
}

const OperatorSelector: React.FC<OperatorSelectorProps> = ({
  className,
  property,
  value,
  disabled = false,
  onChange,
}) => {
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const { t } = useTranslation();

  const options = useMemo(() => {
    const { bk_property_type: propertyType } = property;
    const operators = DEFAULT_OPERATOR_MAP[propertyType as OperatorMapKey] || [];
    return operators.map((operator) => ({
      id: operator,
      name: QUERY_OPERATOR_SYMBOL[operator],
      title: getQueryOperatorDesc(operator, t),
    }));
  }, [property, t]);

  return (
    <Select
      className={className}
      value={value}
      disabled={disabled}
      onChange={onChange}
      style={{ width: 120 }}
      optionLabelProp="name"
      getPopupContainer={(triggerNode) => triggerNode.parentElement?.parentElement || document.body}
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
              <span className="operator-title">({operator.title})</span>
            )}
          </span>
        </Select.Option>
      ))}
    </Select>
  );
};

export default OperatorSelector;
