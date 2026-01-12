import React, { useMemo } from 'react';
import { Form, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import {
    AUDIT_TAB_KEYS,
    getCommonActions,
    getBusinessActions,
    getHostActions,
} from '@/pages/Analysis/constants';
import { AuditTabKey } from '@/pages/Analysis/Types';

const { Option } = Select;

export interface OperationActionProps {
    tab: AuditTabKey;
}

const OperationAction: React.FC<OperationActionProps> = ({ tab }) => {
    const { t } = useTranslation();
    // Use Form.useWatch to monitor operationTarget
    const form = Form.useFormInstance();
    const operationTarget = Form.useWatch(['operationTarget'], form);

    const actionOptions = useMemo(() => {
        switch (tab) {
            case AUDIT_TAB_KEYS.HOST:
                return getHostActions(t);
            case AUDIT_TAB_KEYS.BUSINESS:
                return getCommonActions(t);
            case AUDIT_TAB_KEYS.RESOURCE:
                // Select actions based on operation target
                if (operationTarget === 'business') {
                    return getBusinessActions(t);
                }
                return getCommonActions(t);
            default:
                return getCommonActions(t);
        }
    }, [tab, operationTarget, t]);

    return (
        <Form.Item
            name="action"
            label={t('analysis.audit.filters.action')}
        >
            <Select
                mode="multiple"
                allowClear
                placeholder={!operationTarget ? t('analysis.audit.placeholders.selectOperationTargetFirst') : t('analysis.audit.placeholders.selectAction')}
                disabled={tab !== AUDIT_TAB_KEYS.HOST && !operationTarget}
            >
                {actionOptions.map(option => (
                    <Option key={option.value} value={option.value}>
                        {option.label}
                    </Option>
                ))}
            </Select>
        </Form.Item>
    );
};

export default OperationAction;