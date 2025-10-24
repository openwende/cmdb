import React, { useState, useEffect } from 'react';
import { Form } from 'antd';
import BusinessSelector from '@/components/common/BusinessSelector';
import {
    AuditFilters,
    AuditTable,
    Action,
    TimeFilter,
    AccountFilter,
    HostFilter,
} from '../components';
import { AUDIT_TAB_KEYS } from '@/pages/Analysis/constants';
import { mockOperationDetails } from '@/mock/Analysis';
import { processDetailList } from '@/pages/Analysis/utils';
import type { OperationDetail } from '@/pages/Analysis/Types';

const HostAudit: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [auditList, setAuditList] = useState<OperationDetail[]>([]);

    useEffect(() => {
        // TODO: Unknown parameters
        fetchAuditList();
    }, [page, pageSize]);

    const fetchAuditList = () => {
        // Process mockOperationDetails data
        const processedData = processDetailList(mockOperationDetails);
        setAuditList(processedData);
    };

    const handleSearch = (filters: any) => {
        setLoading(true);
        // TODO: Unknown parameters
        fetchAuditList();
        setTimeout(() => {
            setLoading(false);
        }, 1000);
    };

    return (
        <div>
            <AuditFilters
                onSearch={handleSearch}
                loading={loading}
            >
                <Form.Item name="business" label="业务">
                    <BusinessSelector allowClear />
                </Form.Item>
                <Action tab={AUDIT_TAB_KEYS.HOST} />
                <TimeFilter />
                <AccountFilter />
                <HostFilter />
            </AuditFilters>
            <AuditTable
                data={auditList}
                loading={loading}
                pagination={{
                    page,
                    pageSize: pageSize,
                    total: auditList.length,
                    onChange: (page) => setPage(page),
                    onSizeChange: (_, size) => {
                        setPage(1);
                        setPageSize(size);
                    },
                }}
            />
        </div>
    );
};

export default HostAudit;
