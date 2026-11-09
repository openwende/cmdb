/**
 * Int - Integer input component
 * Corresponds to bk-cmdb's int type (integer numbers)
 * Supports both single value and range input based on operator
 */

import React, { useMemo } from 'react';
import { InputNumber } from 'antd';
import { FormComponentProps } from './index';
import { OperatorType } from '../../../pages/Business/Types';
import { QUERY_OPERATOR } from '../../../pages/Business/constants';
import './styles.css';

enum RangeType {
  START = 'start',
  END = 'end',
}

interface IntProps extends FormComponentProps {
  operator: OperatorType;
  options: {
    min: number;
    max: number;
  };
}

const Int: React.FC<IntProps> = ({
  operator,
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
}) => {
  const handleRangeChange = (position: RangeType, val: number | null) => {
    const currentValue = Array.isArray(value) ? value : [null, null];
    const newValue = [...currentValue];

    if (position === RangeType.START) {
      newValue[0] = val;
    } else {
      newValue[1] = val;
    }

    onChange(newValue);
  };

  const singleValue = useMemo(() => {
    return Array.isArray(value) ? null : value;
  }, [value]);

  const getRangeValue = (position: RangeType) => {
    if (!Array.isArray(value)) return null;
    return position === RangeType.START ? value[0] : value[1];
  };

  if (operator === QUERY_OPERATOR.RANGE) {
    // Render two inputs for range
    return (
      <div className="range-input-wrapper">
        <InputNumber
          value={getRangeValue(RangeType.START)}
          onChange={(val) => handleRangeChange(RangeType.START, val)}
          placeholder={placeholder}
          disabled={disabled}
          style={{ width: '100%' }}
          min={options.min}
          max={options.max}
        />
        <InputNumber
          value={getRangeValue(RangeType.END)}
          onChange={(val) => handleRangeChange(RangeType.END, val)}
          placeholder={placeholder}
          disabled={disabled}
          style={{ width: '100%' }}
          min={options.min}
          max={options.max}
        />
      </div>
    );
  }

  // Render single input for non-range operators
  return (
    <InputNumber
      value={singleValue}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      style={{ width: '100%' }}
      min={options.min}
      max={options.max}
    />
  );
};

export default Int;
