/**
 * ServiceTemplate - Service template selector component
 * Corresponds to bk-cmdb's service-template type (service template selection for dynamic groups)
 */

import React, { useState, useEffect } from 'react';
import { Select } from 'antd';
import { FormComponentProps } from './index';
import { serviceTemplate } from '@/mock/business';
import './styles.css';

const { Option } = Select;

const ServiceTemplate: React.FC<FormComponentProps> = ({
  value,
  onChange,
  placeholder,
  disabled = false,
}) => {
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      // TODO: api
      setTemplates(serviceTemplate);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Select
      mode="multiple"
      value={Array.isArray(value) ? value : []}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      allowClear
      showSearch
      optionFilterProp="children"
      style={{ width: '100%' }}
    >
      {templates.map((template) => (
        <Option key={template.id} value={template.id}>
          {template.name}
        </Option>
      ))}
    </Select>
  );
};

export default ServiceTemplate;
