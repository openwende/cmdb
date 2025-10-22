import React from 'react';
import { Form, Select, Input, Space } from 'antd';

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
    const handleTypeChange = (type: string) => {
        onChange?.({ ...value, type });
    };

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.({ ...value, value: e.target.value });
    };

    const getPlaceholder = () => {
        switch (value.type) {
            case 'ip': return '请输入IP';
            case 'ipv6': return '请输入IPv6';
            case 'id': return '请输入ID';
            default: return '请输入';
        }
    };

    return (
        <Space.Compact style={{ width: '100%' }}>
            <Select
                value={value.type}
                onChange={handleTypeChange}
                style={{ width: 90 }}
            >
                {HOST_FILTER_OPTIONS.map(option => (
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
    return (
        <Form.Item
            name="host"
            label="主机"
            initialValue={{ type: 'ip', value: '' }}
        >
            <HostInput />
        </Form.Item>
    );
};

export default HostFilter;