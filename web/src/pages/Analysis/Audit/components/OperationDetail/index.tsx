import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Descriptions, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import { dynamicGroupCondition } from '@/mock/business';
import type { OperationDetail } from '@/pages/Analysis/Types';
import './style.css';

export interface PropertyItem {
    id: number;
    propertyName: string;
    propertyId: string;
    before: string;
    after: string;
}

export interface OperationDetailProps {
    visible: boolean;
    record: OperationDetail | null;
    onClose: () => void;
}

const OperationDetail: React.FC<OperationDetailProps> = ({
    visible,
    record,
    onClose,
}) => {
    const { t } = useTranslation();
    const [detailList, setDetailList] = useState<OperationDetail | null>(null);
    const [propertyList, setPropertyList] = useState<PropertyItem[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (record) {
            // Use the record data directly
            setDetailList(record);

            const propertyList = processPropertyList(record);
            setPropertyList(propertyList);
        }
    }, [record]);

    const processPropertyList = (detailList: OperationDetail): PropertyItem[] => {
        const { preData, curData } = detailList.details;

        return dynamicGroupCondition.map((config) => {
            const propertyId = config.bk_property_id;
            const preValue = preData?.[propertyId];
            const curValue = curData?.[propertyId];

            return {
                id: config.id,
                propertyId,
                propertyName: config.bk_property_name,
                before: preValue !== undefined ? String(preValue) : '--',
                after: curValue !== undefined ? String(curValue) : '--',
            };
        });
    };

    // Filtered property list based on isExpanded state
    const filteredPropertyList = useMemo(() => {
        // All properties
        if (!detailList || isExpanded) {
            return propertyList;
        }

        // Only changed properties
        const { preData, curData, updateFields } = detailList.details;
        const changedFields = new Set<string>();

        if (updateFields) {
            updateFields.forEach(field => changedFields.add(field));
        }
        if (preData) {
            Object.keys(preData).forEach(field => changedFields.add(field));
        }
        if (curData) {
            Object.keys(curData).forEach(field => changedFields.add(field));
        }

        // Filter and return only changed properties
        return propertyList.filter(item => changedFields.has(item.propertyId));
    }, [detailList, propertyList, isExpanded]);

    // Generate table columns based on detailList
    const generateColumns = (): ColumnsType<PropertyItem> => {
        const columns: ColumnsType<PropertyItem> = [
            {
                title: t('analysis.audit.columns.attribute'),
                dataIndex: 'propertyName',
                key: 'propertyName',
            }
        ];

        if (detailList) {
            const { preData, curData } = detailList.details;

            if (preData !== null) {
                columns.push({
                    title: t('analysis.audit.columns.before'),
                    dataIndex: 'before',
                    key: 'before',
                });
            }
            if (curData !== null) {
                columns.push({
                    title: t('analysis.audit.columns.after'),
                    dataIndex: 'after',
                    key: 'after',
                });
            }
        }

        // Calculate and set column widths evenly
        const columnWidth = `${100 / columns.length}%`;
        columns.forEach(column => {
            column.width = columnWidth;
        });

        return columns;
    };

    // Calculate scroll Y dynamically based on content height
    const calculateScrollY = useMemo(() => {
        const maxHeight = window.innerHeight - 312;
        // Estimate table content height: header(32px) + rows(32px each) + padding
        const estimatedContentHeight = 32 + (filteredPropertyList.length * 32) + 16;
        
        // Only show scroll if content exceeds the max height
        return estimatedContentHeight > maxHeight ? maxHeight : undefined;
    }, [filteredPropertyList.length]);

    const descriptionItems = [
        {
            key: 'business',
            label: t('analysis.audit.detail.business'),
            children: detailList?.business || '--',
        },
        {
            key: 'object',
            label: t('analysis.audit.detail.object'),
            children: detailList?.object || '--',
        },
        {
            key: 'action',
            label: t('analysis.audit.detail.action'),
            children: detailList?.action || '--',
        },
        {
            key: 'modelType',
            label: t('analysis.audit.detail.modelType'),
            children: detailList?.modelType || '--',
        },
        {
            key: 'instance',
            label: t('analysis.audit.detail.instance'),
            children: detailList?.instance || '--',
        },
        {
            key: 'description',
            label: t('analysis.audit.detail.description'),
            children: detailList?.description || '--',
        },
        {
            key: 'time',
            label: t('analysis.audit.detail.time'),
            children: detailList?.time || '--',
        },
        {
            key: 'account',
            label: t('analysis.audit.detail.account'),
            children: detailList?.account || '--',
        },
    ];

    return (
        <Drawer
            title={t('analysis.audit.detail.title')}
            placement="right"
            width={760}
            open={visible}
            onClose={onClose}
            className="operation-details-drawer"
        >
            <>
                {/* Basic Information Section */}
                <Descriptions
                    column={2}
                    size="small"
                    items={descriptionItems}
                    className="description-list"
                />

                {/* Change Details Section */}
                <Table
                    columns={generateColumns()}
                    dataSource={filteredPropertyList}
                    pagination={false}
                    rowKey="id"
                    size="small"
                    bordered
                    scroll={{ y: calculateScrollY }}
                />
                <div className="details-toggle">
                    <a
                        className="toggle-button"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? t('analysis.audit.buttons.collapse') : t('analysis.audit.buttons.expand')}
                    </a>
                </div>
            </>
        </Drawer>
    );
};

export default OperationDetail;
