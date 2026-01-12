import React from 'react';
import { Form, Select, Input, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { getAccountFilterOptions } from '@/pages/Analysis/constants';

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
    const { t } = useTranslation();
    const handleTypeChange = (type: string) => {
        onChange?.({ ...value, type });
    };

    const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange?.({ ...value, value: e.target.value });
    };

    const accountFilterOptions = getAccountFilterOptions(t);

    return (
        <Space.Compact style={{ width: '100%' }}>
            <Select
                value={value.type}
                onChange={handleTypeChange}
                style={{ width: 90 }}
            >
                {accountFilterOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                        {option.label}
                    </Option>
                ))}
            </Select>
            <Input
                value={value.value}
                onChange={handleValueChange}
                placeholder={t('analysis.audit.placeholders.enterAccount')}
                style={{ width: 'calc(100% - 90px)' }}
            />
        </Space.Compact>
    );
};

const AccountFilter: React.FC = () => {
    const { t } = useTranslation();
    return (
        <Form.Item
            name="account"
            label={t('analysis.audit.filters.account')}
            initialValue={{ type: 'include', value: '' }}
        >
            <AccountInput />
        </Form.Item>
    );
};

export default AccountFilter;