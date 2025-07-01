import React, { useEffect } from 'react';
import { Drawer, Table } from 'antd';
import './style.css';
import { hostDetailAttrs } from '@/pages/Resource/constants';
import { DeleteHistoryItem } from '../DeleteHistory';

interface DetailRow {
    key: string;
    attr: string;
    before: string;
}

interface OperationDetailsProps {
    visible: boolean;
    onClose: () => void;
    data: DeleteHistoryItem;
}

const OperationDetails: React.FC<OperationDetailsProps> = ({ visible, onClose, data }) => {
    // table scroll height: window height - 292
    const [tableY, setTableY] = React.useState<number>(() => window.innerHeight - 292);

    useEffect(() => {
        const handler = () => setTableY(window.innerHeight - 292);
        window.addEventListener('resize', handler);
        return () => window.removeEventListener('resize', handler);
    }, []);

    useEffect(() => {
        // TODO: api
    }, [data])

    // Top meta info blocks
    const metaList = [
        { label: '所属业务', value: '--' },
        { label: '操作对象', value: '主机' },
        { label: '动作', value: '删除' },
        { label: '模型类型', value: '主机' },
        { label: '操作实例', value: data.resource_name },
        { label: '操作描述', value: `删除${data.resource_name}` },
        { label: '操作时间', value: data.operation_time },
        { label: '操作账号', value: data.user },
    ];

    const detailRows: DetailRow[] = hostDetailAttrs.map((attr, idx) => ({
        key: `${idx}`,
        attr,
        before: '--',
    }));

    const columns = [
        { title: '属性', dataIndex: 'attr', width: '50%', align: 'right' as const },
        { title: '变更前', dataIndex: 'before', width: '50%', align: 'left' as const },
    ];

    return (
        <Drawer
            open={visible}
            width={760}
            title={<span className="drawer-title">操作详情</span>}
            onClose={onClose}
            className="operation-details-drawer"
        >
            <div className="meta-info">
                {metaList.map((item) => (
                    <div className="info-item" key={item.label}>
                        <span className="info-label">{item.label}：</span>
                        <span className="info-value">{item.value}</span>
                    </div>
                ))}
            </div>

            <div className="detail-table-wrapper">
                <Table
                    columns={columns}
                    dataSource={detailRows}
                    pagination={false}
                    bordered
                    rowKey="key"
                    className="detail-table"
                    scroll={{ y: tableY }}
                    sticky
                />
            </div>
        </Drawer>
    );
};

export default OperationDetails;
