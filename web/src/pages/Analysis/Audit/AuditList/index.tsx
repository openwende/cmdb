import React, { useState } from 'react';
import { Table } from 'antd';
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
            title: '操作对象',
            dataIndex: 'object',
            key: 'object',
            width: 120,
        },
        {
            title: '动作',
            dataIndex: 'action',
            key: 'action',
            width: 100,
        },
        {
            title: '所属业务',
            dataIndex: 'business',
            key: 'business',
            width: 150,
        },
        {
            title: '实例',
            dataIndex: 'instance',
            key: 'instance',
            width: 200,
        },
        {
            title: '操作描述',
            dataIndex: 'description',
            key: 'description',
            width: 200,
        },
        {
            title: '时间',
            dataIndex: 'time',
            key: 'time',
            width: 180,
        },
        {
            title: '操作账号',
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