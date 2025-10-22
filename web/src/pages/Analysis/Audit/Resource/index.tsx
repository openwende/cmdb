import React, { useState, useEffect } from 'react';
import {
    AuditFilters,
    AuditTable,
    OperationTarget,
    Action,
    TimeFilter,
    AccountFilter,
    InstanceFilter,
} from '../components';
import type { AuditLogRecord } from '../AuditList';
import { AUDIT_TAB_KEYS } from '@/pages/Analysis/constants';
import { mockAuditData } from '@/mock/Analysis';

const ResourceAudit: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [auditList, setAuditList] = useState<AuditLogRecord[]>([]);

    useEffect(() => {
        // TODO: Unknown parameters
        fetchAuditList();
    }, [page, pageSize]);

    const fetchAuditList = () => {
        const data = mockAuditData.resource || [];
        setAuditList(data);
    };

    const handleSearch = (filters: any) => {
        setLoading(true);
        // TODO: Unknown parameters
        fetchAuditList();
        setTimeout(() => {
            setLoading(false);
        }, 1000);
    };

    const handleReset = (filters: any) => {
        // TODO: Unknown parameters
        fetchAuditList();
    };

    return (
        <div>
            <AuditFilters
                onSearch={handleSearch}
                onReset={handleReset}
                loading={loading}
            >
                <OperationTarget tab={AUDIT_TAB_KEYS.RESOURCE} />
                <Action tab={AUDIT_TAB_KEYS.RESOURCE} />
                <TimeFilter />
                <AccountFilter />
                <InstanceFilter />
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

export default ResourceAudit;
