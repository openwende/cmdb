import React from 'react';
import { Form, Select, Input, Checkbox, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { getInstanceFilterOptions } from '@/pages/Analysis/constants';
import './style.css';

const { Option } = Select;

interface InstanceValue {
  type: string;
  value: string;
  fuzzy: boolean;
}

interface InstanceInputProps {
  value?: InstanceValue;
  onChange?: (value: InstanceValue) => void;
}

const InstanceInput: React.FC<InstanceInputProps> = ({
  value = {
    type: 'name',
    value: '',
    fuzzy: false,
  },
  onChange,
}) => {
  const { t } = useTranslation();
  const handleTypeChange = (type: string) => {
    onChange?.({ ...value, type });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.({ ...value, value: e.target.value });
  };

  const handleFuzzyChange = (e: any) => {
    onChange?.({ ...value, fuzzy: e.target.checked });
  };

  const instanceFilterOptions = getInstanceFilterOptions(t);

  return (
    <Space className="instance-space">
      <Space.Compact className="instance-compact">
        <Select value={value.type} onChange={handleTypeChange} className="instance-select">
          {instanceFilterOptions.map((option) => (
            <Option key={option.value} value={option.value}>
              {option.label}
            </Option>
          ))}
        </Select>
        <Input
          value={value.value}
          onChange={handleValueChange}
          className="instance-input"
          placeholder={
            value.type === 'id'
              ? t('analysis.audit.placeholders.enterId')
              : t('analysis.audit.placeholders.enterName')
          }
        />
      </Space.Compact>
      <Checkbox checked={value.fuzzy} onChange={handleFuzzyChange} className="instance-checkbox">
        {t('analysis.audit.instanceFilter.fuzzy')}
      </Checkbox>
    </Space>
  );
};

const InstanceFilter: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Form.Item
      name="instance"
      label={t('analysis.audit.filters.instance')}
      initialValue={{ type: 'name', value: '', fuzzy: false }}
    >
      <InstanceInput />
    </Form.Item>
  );
};

export default InstanceFilter;
