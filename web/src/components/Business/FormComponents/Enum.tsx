/**
 * Enum - Single select dropdown component
 * Corresponds to bk-cmdb's enum type (single selection from predefined options)
 */

import React from 'react';
import { Select } from 'antd';
import { FormComponentProps } from './index';
import './styles.css';

interface Option {
  id: string;
  name: string;
}

const { Option } = Select;

const Enum: React.FC<FormComponentProps> = ({
  options = [],
  mode = 'multiple',
  value,
  onChange,
  placeholder,
  disabled = false,
}) => {
  return (
    <Select
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      showSearch
      allowClear={mode !== 'single'}
      mode={mode === 'single' ? undefined : mode}
      optionFilterProp="children"
      style={{ width: '100%' }}
    >
      {options.map((option: Option) => (
        <Option key={option.id} value={option.id}>
          {option.name}
        </Option>
      ))}
    </Select>
  );
};

export default Enum;
