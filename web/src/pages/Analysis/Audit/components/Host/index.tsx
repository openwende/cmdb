import React from 'react';
import { Form, Select, Input, Space } from 'antd';
import { useTranslation } from 'react-i18next';

const { Option } = Select;

const HOST_FILTER_OPTIONS = [
  { label: 'IP', value: 'ip' },
  { label: 'IPv6', value: 'ipv6' },
  { label: 'ID', value: 'id' },
];

interface HostValue {
  type: string;
  value: string;
}

interface HostInputProps {
  value?: HostValue;
  onChange?: (value: HostValue) => void;
}

const HostInput: React.FC<HostInputProps> = ({ value = { type: 'ip', value: '' }, onChange }) => {
  const { t } = useTranslation();
  const handleTypeChange = (type: string) => {
    onChange?.({ ...value, type });
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.({ ...value, value: e.target.value });
  };

  const getPlaceholder = () => {
    switch (value.type) {
      case 'ip':
        return t('analysis.audit.placeholders.enterIp');
      case 'ipv6':
        return t('analysis.audit.placeholders.enterIpv6');
      case 'id':
        return t('analysis.audit.placeholders.enterId');
      default:
        return t('analysis.audit.placeholders.enter');
    }
  };

  return (
    <Space.Compact style={{ width: '100%' }}>
      <Select value={value.type} onChange={handleTypeChange} style={{ width: 90 }}>
        {HOST_FILTER_OPTIONS.map((option) => (
          <Option key={option.value} value={option.value}>
            {option.label}
          </Option>
        ))}
      </Select>
      <Input
        value={value.value}
        onChange={handleValueChange}
        placeholder={getPlaceholder()}
        style={{ width: 'calc(100% - 90px)' }}
      />
    </Space.Compact>
  );
};

const HostFilter: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Form.Item
      name="host"
      label={t('analysis.audit.filters.host')}
      initialValue={{ type: 'ip', value: '' }}
    >
      <HostInput />
    </Form.Item>
  );
};

export default HostFilter;
