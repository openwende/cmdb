import React, { useState } from 'react';
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import Pagination from '@/components/common/Pagination';
import OperationDetail from '../components/OperationDetail';
import './style.css';

export interface AuditLogRecord {
    id: number;
    operationObject: string;
    action: string;
    targetBusiness: string;
    target: string;
    operationTime: string;
    operator: string;
}

export interface AuditTableProps {
    data: AuditLogRecord[];
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
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState<number | null>(null);

    // Handle row click to show drawer
    const handleRowClick = (id: number) => {
        setSelectedRecord(id);
        setDrawerVisible(true);
    };

    // Close drawer
    const handleDrawerClose = () => {
        setDrawerVisible(false);
        setSelectedRecord(null);
    };
    const columns: ColumnsType<AuditLogRecord> = [
        {
            title: '操作对象',
            dataIndex: 'operationObject',
            key: 'operationObject',
            width: 120,
        },
        {
            title: '操作',
            dataIndex: 'action',
            key: 'action',
            width: 100,
        },
        {
            title: '目标业务',
            dataIndex: 'targetBusiness',
            key: 'targetBusiness',
            width: 150,
        },
        {
            title: '目标',
            dataIndex: 'target',
            key: 'target',
            width: 200,
        },
        {
            title: '操作时间',
            dataIndex: 'operationTime',
            key: 'operationTime',
            width: 180,
        },
        {
            title: '操作者',
            dataIndex: 'operator',
            key: 'operator',
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
                    onClick: () => handleRowClick(record.id),
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
            <OperationDetail
                visible={drawerVisible}
                recordId={selectedRecord}
                onClose={handleDrawerClose}
            />
        </div>
    );
};

export default AuditTable;