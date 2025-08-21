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

  const getValue = () => {
    if (Array.isArray(value)) {
      return value.map(id => {
        const template = templates.find(t => t.id === id);
        return template ? template.name : '';
      });
    }
    return [];
  };

  return (
    <Select
      mode="multiple"
      value={getValue()}
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
