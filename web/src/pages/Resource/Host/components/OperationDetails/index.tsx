import React, { useEffect } from 'react';
import { Drawer, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import './style.css';
import { hostDetailAttrs } from '@/pages/Resource/constants';
import { DeleteHistoryItem } from '../../DeleteHistory';

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
    const { t } = useTranslation();
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
        { label: t('resource.operation.meta.business'), value: t('resource.operation.values.no_business') },
        { label: t('resource.operation.meta.object'), value: t('resource.operation.values.host') },
        { label: t('resource.operation.meta.action'), value: t('resource.operation.values.delete') },
        { label: t('resource.operation.meta.model_type'), value: t('resource.operation.values.host') },
        { label: t('resource.operation.meta.instance'), value: data.resource_name },
        { label: t('resource.operation.meta.description'), value: t('resource.operation.values.delete_description', { name: data.resource_name }) },
        { label: t('resource.operation.meta.time'), value: data.operation_time },
        { label: t('resource.operation.meta.user'), value: data.user },
    ];

    const detailRows: DetailRow[] = hostDetailAttrs.map((attr, idx) => ({
        key: `${idx}`,
        attr: t(attr),
        before: '--',
    }));

    const columns = [
        { title: t('resource.operation.columns.attribute'), dataIndex: 'attr', width: '50%', align: 'right' as const },
        { title: t('resource.operation.columns.before'), dataIndex: 'before', width: '50%', align: 'left' as const },
    ];

    return (
        <Drawer
            open={visible}
            width={760}
            title={<span className="drawer-title">{t('resource.operation.title')}</span>}
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
