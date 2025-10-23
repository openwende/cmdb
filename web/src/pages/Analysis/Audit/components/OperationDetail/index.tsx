import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Descriptions, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { mockOperationDetails } from '@/mock/Analysis';
import { dynamicGroupCondition, bizInfo } from '@/mock/business';
import { ACTION_LABELS } from '@/pages/Analysis/constants';
import './style.css';

export interface OperationDetail {
    business: string;
    object: string;
    action: string;
    modelType: string;
    instance: string;
    description: string;
    time: string;
    account: string;
    details: {
        preData: Record<string, any> | null;
        curData: Record<string, any> | null;
        updateFields: string[] | null;
    };
}

export interface PropertyItem {
    id: number;
    propertyName: string;
    propertyId: string;
    before: string;
    after: string;
}

export interface OperationDetailProps {
    visible: boolean;
    recordId: number | null;
    onClose: () => void;
}

const OperationDetail: React.FC<OperationDetailProps> = ({
    visible,
    recordId,
    onClose,
}) => {
    const [detailList, setDetailList] = useState<OperationDetail | null>(null);
    const [propertyList, setPropertyList] = useState<PropertyItem[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (recordId) {
            // TODO: api call to fetch operation details
            const mockData = mockOperationDetails.find(item => item.id === recordId);
            if (mockData) {
                const detailList = processDetailList(mockData);
                setDetailList(detailList);

                const propertyList = processPropertyList(detailList);
                setPropertyList(propertyList);
            }
        }
    }, [recordId]);

    const processDetailList = (detailList: any): OperationDetail => {
        const {
            bk_biz_id,
            resource_type,
            operation_detail,
            user,
            operation_time,
            resource_name,
            action,
        } = detailList;

        const actionName = ACTION_LABELS[action] || action;

        return {
            business: bizInfo.info.find(biz => biz.bk_biz_id === bk_biz_id)?.bk_biz_name || '--',
            object: resource_type,
            action: actionName,
            modelType: operation_detail.bk_obj_id,
            instance: resource_name,
            description: `${actionName}${resource_name}`,
            time: operation_time,
            account: user,
            details: {
                preData: operation_detail.details.pre_data,
                curData: operation_detail.details.cur_data,
                updateFields: operation_detail.details.update_fields,
            },
        };
    };

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
                title: '属性',
                dataIndex: 'propertyName',
                key: 'propertyName',
            }
        ];

        if (detailList) {
            const { preData, curData } = detailList.details;

            if (preData !== null) {
                columns.push({
                    title: '变更前',
                    dataIndex: 'before',
                    key: 'before',
                });
            }
            if (curData !== null) {
                columns.push({
                    title: '变更后',
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

    const descriptionItems = [
        {
            key: 'business',
            label: '所属业务',
            children: detailList?.business || '--',
        },
        {
            key: 'object',
            label: '操作对象',
            children: detailList?.object || '--',
        },
        {
            key: 'action',
            label: '动作',
            children: detailList?.action || '--',
        },
        {
            key: 'modelType',
            label: '模型类型',
            children: detailList?.modelType || '--',
        },
        {
            key: 'instance',
            label: '操作实例',
            children: detailList?.instance || '--',
        },
        {
            key: 'description',
            label: '操作描述',
            children: detailList?.description || '--',
        },
        {
            key: 'time',
            label: '操作时间',
            children: detailList?.time || '--',
        },
        {
            key: 'account',
            label: '操作账号',
            children: detailList?.account || '--',
        },
    ];

    return (
        <Drawer
            title="操作详情"
            placement="right"
            width={800}
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
                    scroll={{ y: window.innerHeight - 312 }}
                />
                <div className="details-toggle">
                    <a
                        className="toggle-button"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        {isExpanded ? '收起' : '展开'}
                    </a>
                </div>
            </>
        </Drawer>
    );
};

export default OperationDetail;
