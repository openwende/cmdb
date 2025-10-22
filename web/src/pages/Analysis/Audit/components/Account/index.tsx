import React from 'react';
import { Form, Select, Input, Space } from 'antd';
import { ACCOUNT_FILTER_OPTIONS } from '@/pages/Analysis/constants';

const { Option } = Select;

interface AccountValue {
    type: string;
    value: string;
}

interface AccountInputProps {
    value?: AccountValue;
    onChange?: (value: AccountValue) => void;
}

const AccountInput: React.FC<AccountInputProps> = ({
    value = { type: 'include', value: '' },
    onChange
}) => {
    const handleTypeChange = (type: string) => {
        onChange?.({ ...value, type });
    };

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.({ ...value, value: e.target.value });
    };

    return (
        <Space.Compact style={{ width: '100%' }}>
            <Select
                value={value.type}
                onChange={handleTypeChange}
                style={{ width: 90 }}
            >
                {ACCOUNT_FILTER_OPTIONS.map(option => (
                    <Option key={option.value} value={option.value}>
                        {option.label}
                    </Option>
                ))}
            </Select>
            <Input
                value={value.value}
                onChange={handleValueChange}
                placeholder="请输入账号"
                style={{ width: 'calc(100% - 90px)' }}
            />
        </Space.Compact>
    );
};

const AccountFilter: React.FC = () => {
    return (
        <Form.Item
            name="account"
            label="账号"
            initialValue={{ type: 'include', value: '' }}
        >
            <AccountInput />
        </Form.Item>
    );
};

export default AccountFilter;