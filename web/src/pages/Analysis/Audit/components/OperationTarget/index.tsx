import React, { useMemo } from 'react';
import { Form, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import {
    AUDIT_TAB_KEYS,
    getBusinessOperationTargets,
    getResourceOperationTargets,
} from '@/pages/Analysis/constants';
import { AuditTabKey } from '@/pages/Analysis/Types';

const { Option } = Select;

export interface OperationTargetProps {
    tab: AuditTabKey;
}

const OperationTarget: React.FC<OperationTargetProps> = ({ tab }) => {
    const { t } = useTranslation();
    const form = Form.useFormInstance();
    
    const operationTargets = useMemo(() => {
        switch (tab) {
            case AUDIT_TAB_KEYS.BUSINESS:
                return getBusinessOperationTargets(t);
            case AUDIT_TAB_KEYS.RESOURCE:
                return getResourceOperationTargets(t);
            default:
                return [];
        }
    }, [tab, t]);

    // If the tab is HOST, do not render the operation target selector
    if (tab === AUDIT_TAB_KEYS.HOST) {
        return null;
    }

    return (
        <Form.Item
            name="operationTarget"
            label={t('analysis.audit.filters.operationTarget')}
        >
            <Select
                placeholder={t('analysis.audit.placeholders.selectOperationTarget')}
                allowClear
                onChange={() => {
                    // Reset action when operation target changes
                    form.setFieldValue('action', []);
                }}
            >
                {operationTargets.map(option => (
                    <Option key={option.value} value={option.value}>
                        {option.label}
                    </Option>
                ))}
            </Select>
        </Form.Item>
    );
};

export default OperationTarget;