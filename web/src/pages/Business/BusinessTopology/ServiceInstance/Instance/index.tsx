import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Drawer, Form, Input, Modal, message, Popconfirm, Tag } from 'antd';
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
    const [current, setCurrent] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [drawerType, setDrawerType] = useState<'view' | 'add' | 'edit'>('view');
    const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
    const [editingInstance, setEditingInstance] = useState<string | null>(null);
    const [editingInstanceName, setEditingInstanceName] = useState('');
    const [labelModalVisible, setLabelModalVisible] = useState(false);
    const [labelList, setLabelList] = useState<Array<{ key: string, value: string }>>([]);

    // 监听expandAll变化
    useEffect(() => {
        if (expandAll) {
            const allKeys = serviceInst.map(item => item.id);
            setExpandedRowKeys(allKeys);
        } else {
            setExpandedRowKeys([]);
        }
    }, [expandAll]);

    // 实例表格列
    const instanceColumns = [
        {
            title: '实例名称',
            dataIndex: 'name',
            key: 'name',
            render: (text: string, record: any) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {editingInstance === record.id ? (
                        <Input
                            value={editingInstanceName}
                            onChange={(e) => setEditingInstanceName(e.target.value)}
                            onPressEnter={() => {
                                message.success('实例名称修改成功');
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
            title: '进程数量',
            dataIndex: 'process_count',
            key: 'process_count'
        },
        {
            title: '标签',
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
            title: '操作',
            key: 'action',
            render: (record: any) => (
                <Space>
                    <Button
                        type="link"
                        onClick={() => handleAddProcess(record)}
                    >
                        添加进程
                    </Button>
                    <Button
                        type="link"
                        onClick={() => handleCloneInstance(record)}
                    >
                        克隆
                    </Button>
                    <Popconfirm
                        title="确定删除该实例?"
                        onConfirm={() => handleDeleteInstance(record)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <Button type="link" danger>删除</Button>
                    </Popconfirm>
                </Space>
            )
        }
    ];

    // 展开的进程实例列
    const expandedRowRender = () => {
        const columns = [
            {
                title: '进程名称',
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
            { title: '进程启动', dataIndex: ['property', 'bk_func_name'], key: 'func_name' },
            { title: '进程启动参数', dataIndex: ['property', 'bk_start_param_regex'], key: 'start_param' },
            { title: '绑定信息', dataIndex: ['property', 'bind_info'], key: 'bind_info', render: () => '--' },
            {
                title: '操作',
                key: 'action',
                render: (processRecord: any) => (
                    <Space>
                        <Button
                            type="link"
                            onClick={() => handleEditProcess(processRecord)}
                        >
                            编辑
                        </Button>
                        <Popconfirm
                            title="确定删除该进程?"
                            onConfirm={() => handleDeleteProcess(processRecord)}
                            okText="确定"
                            cancelText="取消"
                        >
                            <Button type="link" danger>删除</Button>
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
        message.success('标签保存成功');
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
        console.log('克隆实例:', record);
        message.info('克隆实例功能');
    };

    const handleDeleteInstance = (record: any) => {
        console.log('删除实例:', record);
        message.success('删除实例成功');
    };

    const handleDeleteProcess = (record: any) => {
        console.log('删除进程:', record);
        message.success('删除进程成功');
    };

    const renderDrawerContent = () => {
        if (drawerType === 'view') {
            return (
                <div>
                    <h3>基础信息</h3>
                    <div style={{ marginBottom: 16 }}>
                        <div>创建时间：2025-05-27 14:52:15</div>
                        <div>创建人：bk-cmdb</div>
                        <div>进程名称：devTest</div>
                        <div>更新时间：2025-05-27 14:52:15</div>
                        <div>进程别名：devTest</div>
                        <div>备注：--</div>
                    </div>

                    <h3>监听信息</h3>
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
                        locale={{ emptyText: '暂无数据' }}
                    />

                    <div style={{ marginTop: 16 }}>
                        <Button type="primary">编辑</Button>
                    </div>
                </div>
            );
        }

        return (
            <Form layout="vertical">
                <h3>基础信息</h3>
                <div style={{ display: 'flex', gap: 16 }}>
                    <Form.Item label="进程名称" style={{ flex: 1 }}>
                        <Input defaultValue="devTest" />
                    </Form.Item>
                    <Form.Item label="进程别名" style={{ flex: 1 }}>
                        <Input defaultValue="devTest" />
                    </Form.Item>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                    <Form.Item label="进程启动参数" style={{ flex: 1 }}>
                        <Input placeholder="请输入进程启动参数" />
                    </Form.Item>
                    <Form.Item label="备注" style={{ flex: 1 }}>
                        <Input placeholder="请输入备注" />
                    </Form.Item>
                </div>

                <div style={{ marginTop: 16 }}>
                    <Button type="primary" style={{ marginRight: 8 }}>保存</Button>
                    <Button onClick={() => setDrawerVisible(false)}>取消</Button>
                </div>
            </Form>
        );
    };

    return (
        <div>
            {/* 表格 */}
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

            {/* 分页 */}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>已选择 {selectedRowKeys.length} 条</span>
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

            {/* 编辑标签弹窗 */}
            <Modal
                title="编辑标签"
                open={labelModalVisible}
                onOk={handleSaveLabels}
                onCancel={() => setLabelModalVisible(false)}
                okText="确定"
                cancelText="取消"
                width={600}
            >
                <div style={{ marginBottom: 16 }}>
                    {labelList.map((label, index) => (
                        <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                            <Input
                                placeholder="键"
                                value={label.key}
                                onChange={(e) => handleLabelChange(index, 'key', e.target.value)}
                                style={{ flex: 1 }}
                            />
                            <span>:</span>
                            <Input
                                placeholder="值"
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

            {/* 抽屉 */}
            <Drawer
                title={drawerType === 'view' ? '查看进程' : drawerType === 'add' ? '添加进程' : '编辑进程'}
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
