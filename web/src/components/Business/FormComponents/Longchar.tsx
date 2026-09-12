/**
 * LongChar - Multi-line text input component
 * Corresponds to bk-cmdb's longchar type (long text fields)
 */

import React from 'react';
import { Input } from 'antd';
import { FormComponentProps } from './index';
import './styles.css';

const { TextArea } = Input;

const LongChar: React.FC<FormComponentProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
}) => {
  return (
    <TextArea
      value={value || ''}
      onChange={(e) => onChange(e.target.value.trim())}
      placeholder={placeholder}
      disabled={disabled}
      allowClear
      autoSize={{ minRows: 1, maxRows: 6 }}
    />
  );
};

export default LongChar;
