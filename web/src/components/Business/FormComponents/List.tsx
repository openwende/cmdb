/**
 * List - Array/List input component
 * Based on BluKing CMDB's list.vue component - simple multi-select with checkbox style
 */

import React from 'react';
import { Select } from 'antd';
import { FormComponentProps } from './index';
import './styles.css';

const { Option } = Select;

const List: React.FC<FormComponentProps> = ({
  value,
  options,
  onChange,
  placeholder,
  disabled = false,
}) => {
  return (
    <Select
      mode="multiple"
      allowClear
      showSearch
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{ width: '100%' }}
      optionFilterProp="children"
      maxTagCount="responsive"
    >
      {options.map((option: string, index: number) => (
        <Option key={index} value={option}>
          {option}
        </Option>
      ))}
    </Select>
  );
};

export default List;
