import React, { useState } from 'react';
import { Table } from 'antd';
import { useTranslation } from 'react-i18next';
import DetailDrawer from '../components/OperationDetail';
import Pagination from '@/components/common/Pagination';
import type { OperationDetail } from '@/pages/Analysis/Types';
import './style.css';

export interface AuditTableProps {
    data: OperationDetail[];
    loading: boolean;
    pagination: {
        total: number;
        pageSize: number;
        page: number;
        onChange: (page: number, pageSize: number) => void;
        onSizeChange: (page: number, size: number) => void;
    };
}

const AuditTable: React.FC<AuditTableProps> = ({
    data = [],
    loading = false,
    pagination: {
        total,
        pageSize,
        page,
        onChange,
        onSizeChange
    },
}) => {
    const { t } = useTranslation();
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<OperationDetail | null>(null);

    // Handle row click to show drawer
    const handleRowClick = (record: OperationDetail) => {
        setSelectedRecord(record);
        setDrawerVisible(true);
    };

    // Close drawer
    const handleDrawerClose = () => {
        setDrawerVisible(false);
        setSelectedRecord(null);
    };

    const columns = [
        {
            title: t('analysis.audit.columns.object'),
            dataIndex: 'object',
            key: 'object',
            width: 120,
        },
        {
            title: t('analysis.audit.columns.action'),
            dataIndex: 'action',
            key: 'action',
            width: 100,
        },
        {
            title: t('analysis.audit.columns.business'),
            dataIndex: 'business',
            key: 'business',
            width: 150,
        },
        {
            title: t('analysis.audit.columns.instance'),
            dataIndex: 'instance',
            key: 'instance',
            width: 200,
        },
        {
            title: t('analysis.audit.columns.description'),
            dataIndex: 'description',
            key: 'description',
            width: 200,
        },
        {
            title: t('analysis.audit.columns.time'),
            dataIndex: 'time',
            key: 'time',
            width: 180,
        },
        {
            title: t('analysis.audit.columns.account'),
            dataIndex: 'account',
            key: 'account',
            width: 120,
        },
    ];

    return (
        <div className='audit-list'>
            <Table
                columns={columns}
                dataSource={data}
                loading={loading}
                pagination={false}
                rowKey="id"
                onRow={(record) => ({
                    onClick: () => handleRowClick(record),
                    style: { cursor: 'pointer' },
                })}
            />
            <Pagination
                total={total}
                pageSize={pageSize}
                current={page}
                onChange={onChange}
                onSizeChange={onSizeChange}
            />
            
            {/* Operation Details Drawer */}
            <DetailDrawer
                visible={drawerVisible}
                record={selectedRecord}
                onClose={handleDrawerClose}
            />
        </div>
    );
};

export default AuditTable;