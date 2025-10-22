import React, { useMemo } from 'react';
import { Form, Select } from 'antd';
import {
    AUDIT_TAB_KEYS,
    BUSINESS_OPERATION_TARGETS,
    RESOURCE_OPERATION_TARGETS,
} from '@/pages/Analysis/constants';
import type { AuditTabKey } from '@/pages/Analysis/constants';

const { Option } = Select;

export interface OperationTargetProps {
    tab: AuditTabKey;
}

const OperationTarget: React.FC<OperationTargetProps> = ({ tab }) => {
    const form = Form.useFormInstance();
    
    const operationTargets = useMemo(() => {
        switch (tab) {
            case AUDIT_TAB_KEYS.BUSINESS:
                return BUSINESS_OPERATION_TARGETS;
            case AUDIT_TAB_KEYS.RESOURCE:
                return RESOURCE_OPERATION_TARGETS;
            default:
                return [];
        }
    }, [tab]);

    // If the tab is HOST, do not render the operation target selector
    if (tab === AUDIT_TAB_KEYS.HOST) {
        return null;
    }

    return (
        <Form.Item
            name="operationTarget"
            label="操作对象"
        >
            <Select
                placeholder="请选择操作对象"
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