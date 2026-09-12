/**
 * SingleChar - Single line text input component
 * Corresponds to bk-cmdb's singlechar type (short text fields)
 */

import React from 'react';
import { Input } from 'antd';
import { FormComponentProps } from './index';

const SingleChar: React.FC<FormComponentProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
}) => {
  return (
    <Input
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      allowClear
    />
  );
};

export default SingleChar;
