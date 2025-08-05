import React from 'react';
import { Table, Empty, Spin } from 'antd';
import { DynamicGroupProperty } from '../../Types';

interface PreviewTableProps {
    data: any[];
    loading: boolean;
    properties: DynamicGroupProperty[];
}

const PreviewTable: React.FC<PreviewTableProps> = ({
    data,
    loading,
    properties
}) => {

    // 根据数据动态生成表格列
    const generateColumns = () => {
        if (data.length === 0) return [];

        const sampleRow = data[0];
        const columns: any[] = [];

        // 基于数据的键生成列
        Object.keys(sampleRow).forEach(key => {
            const property = properties.find(p => p.bk_property_id === key);
            
            columns.push({
                title: property?.bk_property_name || key,
                dataIndex: key,
                key: key,
                width: 150,
                ellipsis: true,
                render: (text: any) => {
                    if (text === null || text === undefined) {
                        return '--';
                    }
                    if (typeof text === 'object') {
                        return JSON.stringify(text);
                    }
                    return String(text);
                }
            });
        });

        return columns;
    };

    const columns = generateColumns();

    // 为数据添加key
    const tableData = data.map((item, index) => ({
        ...item,
        key: item.bk_host_id || index
    }));

    if (loading) {
        return (
            <div className="preview-table">
                <Spin tip="查询中...">
                    <div style={{ height: '300px' }} />
                </Spin>
            </div>
        );
    }

    if (data.length === 0) {
        return (
            <div className="preview-table">
                <div className="preview-empty">
                    <Empty
                        description="暂无数据"
                        imageStyle={{ height: 60 }}
                    />
                    <div>请配置查询条件后点击"查询预览"</div>
                </div>
            </div>
        );
    }

    return (
        <div className="preview-table">
            <div style={{ marginBottom: 16, color: '#666' }}>
                共查询到 {data.length} 条记录
            </div>
            <Table
                columns={columns}
                dataSource={tableData}
                pagination={{
                    pageSize: 20,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) => 
                        `第 ${range[0]}-${range[1]} 条，共 ${total} 条`
                }}
                scroll={{ x: 'max-content', y: 400 }}
                size="small"
            />
        </div>
    );
};

export default PreviewTable;
