import React, { useMemo } from 'react';
import { Form, Select } from 'antd';
import {
    AUDIT_TAB_KEYS,
    COMMON_ACTIONS,
    BUSINESS_ACTIONS,
    HOST_ACTIONS,
} from '@/pages/Analysis/constants';
import type { AuditTabKey } from '@/pages/Analysis/constants';

const { Option } = Select;

export interface OperationActionProps {
    tab: AuditTabKey;
}

const OperationAction: React.FC<OperationActionProps> = ({ tab }) => {
    // Use Form.useWatch to monitor operationTarget
    const form = Form.useFormInstance();
    const operationTarget = Form.useWatch(['operationTarget'], form);

    const actionOptions = useMemo(() => {
        switch (tab) {
            case AUDIT_TAB_KEYS.HOST:
                return HOST_ACTIONS;
            case AUDIT_TAB_KEYS.BUSINESS:
                return COMMON_ACTIONS;
            case AUDIT_TAB_KEYS.RESOURCE:
                // Select actions based on operation target
                if (operationTarget === 'business') {
                    return BUSINESS_ACTIONS;
                }
                return COMMON_ACTIONS;
            default:
                return COMMON_ACTIONS;
        }
    }, [tab, operationTarget]);

    return (
        <Form.Item
            name="action"
            label="动作"
        >
            <Select
                mode="multiple"
                allowClear
                placeholder={!operationTarget ? "请先选择操作对象" : "请选择动作"}
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