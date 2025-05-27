import React, { useState } from 'react';
import { Table, Button, Radio, Space, Drawer, Form, Input, Switch, Select, Modal, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { serviceInst, processInst, processInfo, processDetail } from '@/mock/business';
import Pagination from '@/components/common/Pagination';

interface Props {
    selectedNode?: any;
}

const ServiceInstance: React.FC<Props> = ({ selectedNode }) => {
    const [viewType, setViewType] = useState<'instance' | 'process'>('instance');
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [current, setCurrent] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [drawerType, setDrawerType] = useState<'view' | 'add' | 'edit'>('view');
    const [currentRecord, setCurrentRecord] = useState<any>(null);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [pendingAction, setPendingAction] = useState<() => void>(() => { });

    // 实例表格列
    const instanceColumns = [
        {
            title: '实例名称',
            dataIndex: 'name',
            key: 'name'
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
            render: (labels: any) => labels || '--'
        },
        {
            title: '操作',
            key: 'action',
            render: (record: any) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewProcess(record)}
                    >
                        查看进程
                    </Button>
                    <Button
                        type="link"
                        icon={<PlusOutlined />}
                        onClick={() => handleAddProcess(record)}
                    >
                        添加进程
                    </Button>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEditProcess(record)}
                    >
                        编辑
                    </Button>
                    <Button
                        type="link"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteProcess(record)}
                    >
                        删除
                    </Button>
                </Space>
            )
        }
    ];

    // 进程表格列
    const processColumns = [
        {
            title: '进程名称',
            dataIndex: 'bk_process_name',
            key: 'bk_process_name'
        },
        {
            title: '进程ID',
            dataIndex: 'process_ids',
            key: 'process_ids',
            render: (ids: number[]) => ids?.join(', ') || '--'
        },
        {
            title: '操作',
            key: 'action',
            render: (record: any) => (
                <Space>
                    <Button
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => handleViewProcess(record)}
                    >
                        查看进程
                    </Button>
                    <Button
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => handleEditProcess(record)}
                    >
                        编辑
                    </Button>
                    <Button
                        type="link"
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteProcess(record)}
                    >
                        删除
                    </Button>
                </Space>
            )
        }
    ];

    // 展开的进程实例列
    const expandedRowRender = (record: any) => {
        const columns = [
            { title: '进程名称', dataIndex: ['property', 'bk_process_name'], key: 'process_name' },
            { title: '进程启动', dataIndex: ['property', 'bk_func_name'], key: 'func_name' },
            { title: '进程启动参数', dataIndex: ['property', 'bk_start_param_regex'], key: 'start_param' },
            { title: '绑定信息', dataIndex: ['property', 'bind_info'], key: 'bind_info', render: () => '--' },
            {
                title: '操作',
                key: 'action',
                render: (processRecord: any) => (
                    <Space>
                        <a onClick={() => handleViewProcess(processRecord)}>查看</a>
                        <a onClick={() => handleEditProcess(processRecord)}>编辑</a>
                        <a onClick={() => handleDeleteProcess(processRecord)}>删除</a>
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

    const handleViewProcess = (record: any) => {
        setCurrentRecord(record);
        setDrawerType('view');
        setDrawerVisible(true);
    };

    const handleAddProcess = (record: any) => {
        setCurrentRecord(record);
        setDrawerType('add');
        setDrawerVisible(true);
    };

    const handleEditProcess = (record: any) => {
        setCurrentRecord(record);
        setDrawerType('edit');
        setDrawerVisible(true);
    };

    const handleDeleteProcess = (record: any) => {
        setPendingAction(() => () => {
            message.success('删除成功');
            setConfirmModalVisible(false);
        });
        setConfirmModalVisible(true);
    };

    const handleConfirmAction = () => {
        pendingAction();
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

                <h3>监听信息</h3>
                <Table
                    columns={[
                        { title: 'IP', dataIndex: 'ip', key: 'ip', render: () => <Input placeholder="请输入或选择IP" /> },
                        { title: 'Port', dataIndex: 'port', key: 'port', render: () => <Input placeholder="请输入Port" /> },
                        { title: 'Protocol', dataIndex: 'protocol', key: 'protocol', render: () => <Select placeholder="请选择Protocol" style={{ width: '100%' }} /> },
                        { title: 'Enable', dataIndex: 'enable', key: 'enable', render: () => <Switch /> },
                        {
                            title: '操作',
                            key: 'action',
                            render: () => (
                                <Space>
                                    <a>添加</a>
                                    <a>删除</a>
                                </Space>
                            )
                        }
                    ]}
                    dataSource={[{}, {}]}
                    pagination={false}
                    size="small"
                    rowKey={(record, index) => index || 0}
                />

                <div style={{ marginTop: 16 }}>
                    <Button type="primary" style={{ marginRight: 8 }}>保存</Button>
                    <Button onClick={() => setDrawerVisible(false)}>取消</Button>
                </div>
            </Form>
        );
    };

    return (
        <div style={{ background: '#fff', padding: 16 }}>
            {/* 顶部切换和操作栏 */}
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <Button type="primary" style={{ marginRight: 8 }}>新增</Button>
                    <Button
                        disabled={selectedRowKeys.length === 0}
                        style={{ marginRight: 8 }}
                    >
                        编辑
                    </Button>
                    <Button
                        disabled={selectedRowKeys.length === 0}
                    >
                        删除
                    </Button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span>全部展开</span>
                    <Radio.Group value={viewType} onChange={(e) => setViewType(e.target.value)}>
                        <Radio.Button value="instance">实例</Radio.Button>
                        <Radio.Button value="process">进程</Radio.Button>
                    </Radio.Group>
                </div>
            </div>

            {/* 表格 */}
            <Table
                rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys
                }}
                columns={viewType === 'instance' ? instanceColumns : processColumns}
                dataSource={viewType === 'instance' ? serviceInst : processInfo}
                rowKey={viewType === 'instance' ? 'id' : 'bk_process_name'}
                expandable={viewType === 'instance' ? {
                    expandedRowRender,
                    defaultExpandAllRows: false
                } : {
                    expandedRowRender,
                    defaultExpandAllRows: false
                }}
                pagination={false}
                bordered
            />

            {/* 分页 */}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>已选择 {selectedRowKeys.length} 条</span>
                <Pagination
                    total={viewType === 'instance' ? serviceInst.length : processInfo.length}
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

            {/* 抽屉 */}
            <Drawer
                title={drawerType === 'view' ? '查看进程' : drawerType === 'add' ? '添加进程' : '编辑进程'}
                placement="right"
                width={800}
                open={drawerVisible}
                onClose={() => setDrawerVisible(false)}
                destroyOnClose
            >
                {renderDrawerContent()}
            </Drawer>

            {/* 确认弹框 */}
            <Modal
                title="确定删除该服务实例?"
                open={confirmModalVisible}
                onOk={handleConfirmAction}
                onCancel={() => setConfirmModalVisible(false)}
                okText="确定"
                cancelText="取消"
            >
                <p>删除后不可恢复，请谨慎操作</p>
            </Modal>
        </div>
    );
};

export default ServiceInstance; 