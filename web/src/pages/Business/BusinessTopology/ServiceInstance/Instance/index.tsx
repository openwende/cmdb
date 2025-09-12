import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Drawer, Form, Input, Modal, message, Popconfirm, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, MinusOutlined } from '@ant-design/icons';
import { serviceInst, processInst } from '@/mock/business';
import Pagination from '@/components/common/Pagination';

interface Props {
    selectedNode?: any;
    selectedRowKeys: React.Key[];
    setSelectedRowKeys: (keys: React.Key[]) => void;
    expandAll: boolean;
    setExpandAll: (expand: boolean) => void;
}

const Instance: React.FC<Props> = ({
    selectedRowKeys,
    setSelectedRowKeys,
    expandAll
}) => {
    const { t } = useTranslation();
    const [current, setCurrent] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [drawerType, setDrawerType] = useState<'view' | 'add' | 'edit'>('view');
    const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
    const [editingInstance, setEditingInstance] = useState<string | null>(null);
    const [editingInstanceName, setEditingInstanceName] = useState('');
    const [labelModalVisible, setLabelModalVisible] = useState(false);
    const [labelList, setLabelList] = useState<Array<{ key: string, value: string }>>([]);

    useEffect(() => {
        if (expandAll) {
            const allKeys = serviceInst.map(item => item.id);
            setExpandedRowKeys(allKeys);
        } else {
            setExpandedRowKeys([]);
        }
    }, [expandAll]);

    const instanceColumns = [
        {
            title: t('business.topology.serviceInstance.instance.columns.instanceName'),
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {editingInstance === record.id ? (
                        <Input
                            value={editingInstanceName}
                            onChange={(e) => setEditingInstanceName(e.target.value)}
                            onPressEnter={() => {
                                message.success(t('business.topology.serviceInstance.instance.messages.instanceNameUpdateSuccess'));
                                setEditingInstance(null);
                            }}
                            onBlur={() => setEditingInstance(null)}
                            autoFocus
                        />
                    ) : (
                        <>
                            <span>{text}</span>
                            <EditOutlined
                                style={{ cursor: 'pointer', color: '#1890ff' }}
                                onClick={() => {
                                    setEditingInstance(record.id);
                                    setEditingInstanceName(text);
                                }}
                            />
                        </>
                    )}
                </div>
            )
        },
        {
            title: t('business.topology.serviceInstance.instance.columns.processCount'),
            dataIndex: 'process_count',
            key: 'process_count'
        },
        {
            title: t('business.topology.serviceInstance.instance.columns.labels'),
            dataIndex: 'labels',
            key: 'labels',
            render: (labels: any, record: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div>
                        {labels && typeof labels === 'object' ?
                            Object.entries(labels).map(([key, value]) => (
                                <Tag key={key}>{key}: {value as string}</Tag>
                            )) : '--'
                        }
                    </div>
                    <EditOutlined
                        style={{ cursor: 'pointer', color: '#1890ff' }}
                        onClick={() => handleEditLabel(record)}
                    />
                </div>
            )
        },
        {
            title: t('business.topology.serviceInstance.instance.columns.action'),
            key: 'action',
            render: (record: any) => (
                <Space>
                    <Button
                        type="link"
                        onClick={() => handleAddProcess(record)}
                    >
                        {t('business.topology.serviceInstance.instance.actions.addProcess')}
                    </Button>
                    <Button
                        type="link"
                        onClick={() => handleCloneInstance(record)}
                    >
                        {t('business.topology.serviceInstance.instance.actions.clone')}
                    </Button>
                    <Popconfirm
                        title={t('business.topology.serviceInstance.instance.confirm.deleteInstance')}
                        onConfirm={() => handleDeleteInstance(record)}
                        okText={t('common.confirm')}
                        cancelText={t('common.cancel')}
                    >
                        <Button type="link" danger>{t('common.delete')}</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    const expandedRowRender = () => {
        const columns = [
            {
                title: t('business.topology.serviceInstance.instance.columns.processName'),
                dataIndex: ['property', 'bk_process_name'],
                key: 'process_name',
                render: (text: string, processRecord: any) => (
                    <Button
                        type="link"
                        onClick={() => handleViewProcess(processRecord)}
                    >
                        {text}
                    </Button>
                )
            },
            {
                title: t('business.topology.serviceInstance.instance.columns.processStart'),
                dataIndex: ['property', 'bk_func_name'],
                key: 'func_name'
            },
            {
                title: t('business.topology.serviceInstance.instance.columns.startupParams'),
                dataIndex: ['property', 'bk_start_param_regex'],
                key: 'start_param'
            },
            {
                title: t('business.topology.serviceInstance.instance.columns.bindInfo'),
                dataIndex: ['property', 'bind_info'],
                key: 'bind_info',
                render: () => '--'
            },
            {
                title: t('business.topology.serviceInstance.instance.columns.action'),
                key: 'action',
                render: (processRecord: any) => (
                    <Space>
                        <Button
                            type="link"
                            onClick={() => handleEditProcess(processRecord)}
                        >
                            {t('common.edit')}
                        </Button>
                        <Popconfirm
                            title={t('business.topology.serviceInstance.instance.confirm.deleteProcess')}
                            onConfirm={() => handleDeleteProcess(processRecord)}
                            okText={t('common.confirm')}
                            cancelText={t('common.cancel')}
                        >
                            <Button type="link" danger>{t('common.delete')}</Button>
                        </Popconfirm>
                    </Space>
                )
            }
        ];

        return (
            <Table
                columns={columns}
                dataSource={processInst}
                pagination={false}
                size="small"
                rowKey={(record) => record.property.bk_process_id}
            />
        );
    };

    const handleEditLabel = (record: any) => {
        const labels = record.labels || {};
        const labelArray = Object.entries(labels).map(([key, value]) => ({ key, value: value as string }));
        setLabelList(labelArray.length > 0 ? labelArray : [{ key: '', value: '' }]);
        setLabelModalVisible(true);
    };

    const handleAddLabelRow = () => {
        setLabelList([...labelList, { key: '', value: '' }]);
    };

    const handleRemoveLabelRow = (index: number) => {
        if (labelList.length > 1) {
            const newList = labelList.filter((_, i) => i !== index);
            setLabelList(newList);
        }
    };

    const handleLabelChange = (index: number, field: 'key' | 'value', value: string) => {
        const newList = [...labelList];
        newList[index][field] = value;
        setLabelList(newList);
    };

    const handleSaveLabels = () => {
        message.success(t('business.topology.serviceInstance.instance.messages.labelSaveSuccess'));
        setLabelModalVisible(false);
    };

    const handleViewProcess = (_record: any) => {
        setDrawerType('view');
        setDrawerVisible(true);
    };

    const handleAddProcess = (_record: any) => {
        setDrawerType('add');
        setDrawerVisible(true);
    };

    const handleEditProcess = (_record: any) => {
        setDrawerType('edit');
        setDrawerVisible(true);
    };

    const handleCloneInstance = (record: any) => {
        message.info(t('business.topology.serviceInstance.instance.messages.cloneInstanceInfo'));
    };

    const handleDeleteInstance = (record: any) => {
        message.success(t('business.topology.serviceInstance.instance.messages.deleteInstanceSuccess'));
    };

    const handleDeleteProcess = (record: any) => {
        message.success(t('business.topology.serviceInstance.instance.messages.deleteProcessSuccess'));
    };

    const renderDrawerContent = () => {
        if (drawerType === 'view') {
            return (
                <div>
                    <h3>{t('business.topology.serviceInstance.process.sections.basicInfo')}</h3>
                    <div style={{ marginBottom: 16 }}>
                        <div>{t('business.topology.serviceInstance.process.fields.createTime')}：2025-05-27 14:52:15</div>
                        <div>{t('business.topology.serviceInstance.process.fields.creator')}：bk-cmdb</div>
                        <div>{t('business.topology.serviceInstance.process.form.processName')}：devTest</div>
                        <div>{t('business.topology.serviceInstance.process.fields.updateTime')}：2025-05-27 14:52:15</div>
                        <div>{t('business.topology.serviceInstance.process.form.processAlias')}：devTest</div>
                        <div>{t('business.topology.serviceInstance.process.fields.description')}：--</div>
                    </div>

                    <h3>{t('business.topology.serviceInstance.process.sections.listenInfo')}</h3>
                    <Table
                        columns={[
                            { title: 'IP', dataIndex: 'ip', key: 'ip' },
                            { title: 'Port', dataIndex: 'port', key: 'port' },
                            { title: 'Protocol', dataIndex: 'protocol', key: 'protocol' },
                            { title: 'Enable', dataIndex: 'enable', key: 'enable' },
                            { title: 'RowID', dataIndex: 'rowId', key: 'rowId' }
                        ]}
                        dataSource={[]}
                        pagination={false}
                        size="small"
                        locale={{ emptyText: t('business.topology.serviceInstance.process.table.noData') }}
                    />

                    <div style={{ marginTop: 16 }}>
                        <Button type="primary">{t('common.edit')}</Button>
                    </div>
                </div>
            );
        }

        return (
            <Form layout="vertical">
                <h3>{t('business.topology.serviceInstance.process.sections.basicInfo')}</h3>
                <div style={{ display: 'flex', gap: 16 }}>
                    <Form.Item label={t('business.topology.serviceInstance.process.form.processName')} style={{ flex: 1 }}>
                        <Input defaultValue="devTest" />
                    </Form.Item>
                    <Form.Item label={t('business.topology.serviceInstance.process.form.processAlias')} style={{ flex: 1 }}>
                        <Input defaultValue="devTest" />
                    </Form.Item>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                    <Form.Item label={t('business.topology.serviceInstance.process.form.startupParams')} style={{ flex: 1 }}>
                        <Input placeholder={t('business.topology.serviceInstance.process.form.placeholders.startupParams')} />
                    </Form.Item>
                    <Form.Item label={t('business.topology.serviceInstance.process.form.description')} style={{ flex: 1 }}>
                        <Input placeholder={t('business.topology.serviceInstance.process.form.placeholders.description')} />
                    </Form.Item>
                </div>

                <div style={{ marginTop: 16 }}>
                    <Button type="primary" style={{ marginRight: 8 }}>{t('common.save')}</Button>
                    <Button onClick={() => setDrawerVisible(false)}>{t('common.cancel')}</Button>
                </div>
            </Form>
        );
    };

    return (
        <div>
            {/* The table */}
            <Table
                rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys
                }}
                columns={instanceColumns}
                dataSource={serviceInst}
                rowKey="id"
                expandable={{
                    expandedRowRender,
                    expandedRowKeys,
                    onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
                    defaultExpandAllRows: false
                }}
                pagination={false}
                bordered
            />

            {/* The pagination */}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                    {t('business.topology.serviceInstance.instance.pagination.selected')}
                    &nbsp;{selectedRowKeys.length}
                    &nbsp;{t('business.topology.serviceInstance.instance.pagination.items')}
                </span>
                <Pagination
                    total={serviceInst.length}
                    pageSize={pageSize}
                    current={current}
                    onChange={(page, size) => {
                        setCurrent(page);
                        setPageSize(size);
                    }}
                    onSizeChange={(_, size) => {
                        setPageSize(size);
                        setCurrent(1);
                    }}
                />
            </div>

            {/* The edit tag modal */}
            <Modal
                title={t('business.topology.serviceInstance.instance.modal.editLabel')}
                open={labelModalVisible}
                onOk={handleSaveLabels}
                onCancel={() => setLabelModalVisible(false)}
                okText={t('common.confirm')}
                cancelText={t('common.cancel')}
                width={600}
            >
                <div style={{ marginBottom: 16 }}>
                    {labelList.map((label, index) => (
                        <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                            <Input
                                placeholder={t('business.topology.serviceInstance.instance.form.placeholders.key')}
                                value={label.key}
                                onChange={(e) => handleLabelChange(index, 'key', e.target.value)}
                                style={{ flex: 1 }}
                            />
                            <span>:</span>
                            <Input
                                placeholder={t('business.topology.serviceInstance.instance.form.placeholders.value')}
                                value={label.value}
                                onChange={(e) => handleLabelChange(index, 'value', e.target.value)}
                                style={{ flex: 1 }}
                            />
                            {index === labelList.length - 1 && (
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <Button
                                        type="text"
                                        icon={<PlusOutlined />}
                                        onClick={handleAddLabelRow}
                                        size="small"
                                    />
                                    {labelList.length > 1 && (
                                        <Button
                                            type="text"
                                            icon={<MinusOutlined />}
                                            onClick={() => handleRemoveLabelRow(index)}
                                            size="small"
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </Modal>

            {/* The drawer */}
            <Drawer
                title={
                    drawerType === 'view'
                        ? t('business.topology.serviceInstance.instance.drawer.viewProcess')
                        : drawerType === 'add'
                            ? t('business.topology.serviceInstance.instance.drawer.addProcess')
                            : t('business.topology.serviceInstance.instance.drawer.editProcess')
                }
                placement="right"
                width={800}
                open={drawerVisible}
                onClose={() => setDrawerVisible(false)}
            >
                {renderDrawerContent()}
            </Drawer>
        </div>
    );
};

export default Instance;
