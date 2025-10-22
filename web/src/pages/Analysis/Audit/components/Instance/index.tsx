import React from 'react';
import { Form, Select, Input, Checkbox, Space } from 'antd';
import { INSTANCE_FILTER_OPTIONS } from '@/pages/Analysis/constants';

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
    value = { type: 'name', value: '', fuzzy: false },
    onChange
}) => {
    const handleTypeChange = (type: string) => {
        onChange?.({ ...value, type });
    };

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.({ ...value, value: e.target.value });
    };

    const handleFuzzyChange = (e: any) => {
        onChange?.({ ...value, fuzzy: e.target.checked });
    };

    return (
        <Space style={{ width: '100%' }}>
            <Space.Compact style={{ flex: 1, width: '100%' }}>
                <Select
                    value={value.type}
                    onChange={handleTypeChange}
                    style={{ width: 90 }}
                >
                    {INSTANCE_FILTER_OPTIONS.map(option => (
                        <Option key={option.value} value={option.value}>
                            {option.label}
                        </Option>
                    ))}
                </Select>
                <Input
                    value={value.value}
                    onChange={handleValueChange}
                    placeholder={value.type === 'id' ? '请输入ID' : '请输入名称'}
                    style={{ width: 'calc(100% - 90px)' }}
                />
            </Space.Compact>
            <Checkbox
                checked={value.fuzzy}
                onChange={handleFuzzyChange}
            >
                模糊
            </Checkbox>
        </Space>
    );
};

const InstanceFilter: React.FC = () => {
    return (
        <Form.Item
            name="instance"
            label="实例"
            initialValue={{ type: 'name', value: '', fuzzy: false }}
        >
            <InstanceInput />
        </Form.Item>
    );
};

export default InstanceFilter;