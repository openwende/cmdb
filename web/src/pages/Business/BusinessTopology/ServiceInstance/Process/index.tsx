import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Drawer, Form, Input, message, Popconfirm } from 'antd';
import { processInfo, processInstanceDetail } from '@/mock/business';
import Pagination from '@/components/common/Pagination';

interface Props {
    selectedNode?: any;
    selectedRowKeys: React.Key[];
    setSelectedRowKeys: (keys: React.Key[]) => void;
    expandAll: boolean;
    setExpandAll: (expand: boolean) => void;
}

const Process: React.FC<Props> = ({ 
    selectedRowKeys, 
    setSelectedRowKeys, 
    expandAll
}) => {
    const [current, setCurrent] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [drawerType, setDrawerType] = useState<'view' | 'edit'>('view');
    const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);

    // 监听expandAll变化
    useEffect(() => {
        if (expandAll) {
            const allKeys = processInfo.map((_, index) => index);
            setExpandedRowKeys(allKeys);
        } else {
            setExpandedRowKeys([]);
        }
    }, [expandAll]);

    // 进程表格列
    const processColumns = [
        {
            title: '进程别名',
            dataIndex: 'bk_process_name',
            key: 'bk_process_name'
        },
        {
            title: '实例数量',
            dataIndex: 'process_ids',
            key: 'process_ids',
            render: (ids: number[]) => ids?.join(', ') || '--'
        }
    ];

    // 进程视图的展开行渲染
    const processExpandedRowRender = () => {
        const columns = [
            {
                title: '所属实例',
                dataIndex: 'service_instance_name',
                key: 'service_instance_name',
                render: (value: string, record: any) => (
                    <Button
                        type="link"
                        onClick={() => handleViewProcess(record)}
                    >
                        {value}
                    </Button>
                )
            },
            {
                title: '进程名称',
                dataIndex: ['property', 'bk_func_name'],
                key: 'func_name'
            },
            {
                title: '进程启动参数',
                dataIndex: ['property', 'bk_start_param_regex'],
                key: 'start_param',
                render: (value: string) => value || '--'
            },
            {
                title: '绑定信息',
                dataIndex: ['property', 'bind_info'],
                key: 'bind_info',
                render: (value: []) => value.length > 0 ? value : '--'
            },
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
                dataSource={processInstanceDetail}
                pagination={false}
                size="small"
                rowKey={(record) => record.process_id}
            />
        );
    };

    const handleViewProcess = (_record: any) => {
        setDrawerType('view');
        setDrawerVisible(true);
    };

    const handleEditProcess = (_record: any) => {
        setDrawerType('edit');
        setDrawerVisible(true);
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
                    onChange: setSelectedRowKeys,
                    getCheckboxProps: () => ({
                        disabled: true // 进程视图中只有"所属实例"列可以选择
                    })
                }}
                columns={processColumns}
                dataSource={processInfo}
                rowKey={(record) => record.bk_process_name}
                expandable={{
                    expandedRowRender: processExpandedRowRender,
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
                    total={processInfo.length}
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
                title={drawerType === 'view' ? '查看进程' : '编辑进程'}
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

export default Process;
