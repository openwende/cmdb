import React, { useState } from 'react';
import { Drawer, Button, Collapse, Form, Input, Select, Switch, Table, Space, Divider } from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import './style.css';

const { Panel } = Collapse;

interface Props {
    visible: boolean;
    onClose: () => void;
    onSubmit: () => void;
}

interface ListenInfo {
    id: string;
    ip: string;
    port: string;
    protocol: string;
    enable: boolean;
}

const AddProcessModal: React.FC<Props> = ({ visible, onClose, onSubmit }) => {
    const [form] = Form.useForm();

    // Listen info state for the form
    const [listenInfoList, setListenInfoList] = useState<ListenInfo[]>([]);

    // Handle add listen info row
    const handleAddListenInfo = () => {
        const newId = Date.now().toString();
        setListenInfoList([...listenInfoList, {
            id: newId,
            ip: '',
            port: '',
            protocol: '',
            enable: false
        }]);
    };

    // Handle delete listen info row
    const handleDeleteListenInfo = (id: string) => {
        setListenInfoList(listenInfoList.filter(item => item.id !== id));
    };

    // Update listen info
    const handleUpdateListenInfo = (id: string, field: string, value: any) => {
        setListenInfoList(listenInfoList.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    // Listen info table columns
    const listenInfoColumns = [
        {
            title: 'IP',
            dataIndex: 'ip',
            key: 'ip',
            render: (value: string, record: ListenInfo) => (
                <Input
                    placeholder="请选择或输入IP"
                    value={value}
                    onChange={e => handleUpdateListenInfo(record.id, 'ip', e.target.value)}
                />
            )
        },
        {
            title: 'Port',
            dataIndex: 'port',
            key: 'port',
            render: (value: string, record: ListenInfo) => (
                <Input
                    placeholder="请输入Port"
                    value={value}
                    onChange={e => handleUpdateListenInfo(record.id, 'port', e.target.value)}
                />
            )
        },
        {
            title: 'Protocol',
            dataIndex: 'protocol',
            key: 'protocol',
            render: (value: string, record: ListenInfo) => (
                <Select
                    value={value}
                    style={{ width: '100%' }}
                    placeholder="请选择Protocol"
                    onChange={val => handleUpdateListenInfo(record.id, 'protocol', val)}
                >
                    <Select.Option value="TCP">TCP</Select.Option>
                    <Select.Option value="UDP">UDP</Select.Option>
                    <Select.Option value="TCP6">TCP6</Select.Option>
                    <Select.Option value="UDP6">UDP6</Select.Option>
                </Select>
            )
        },
        {
            title: 'Enable',
            dataIndex: 'enable',
            key: 'enable',
            render: (value: boolean, record: ListenInfo) => (
                <Switch
                    checked={value}
                    onChange={checked => handleUpdateListenInfo(record.id, 'enable', checked)}
                />
            )
        },
        {
            title: '操作',
            key: 'action',
            render: (_: any, record: ListenInfo) => (
                <Space>
                    <Button type="link" onClick={handleAddListenInfo}>
                        添加
                    </Button>
                    <Button
                        type="link"
                        danger
                        onClick={() => handleDeleteListenInfo(record.id)}
                    >
                        删除
                    </Button>
                </Space>
            )
        }
    ];

    // Handle submit process form
    const handleSubmitProcess = () => {
        form.validateFields().then(values => {
            console.log('Process form values:', values);
            console.log('Listen info:', listenInfoList);
        });
    };

    return (
        <>
            <Drawer
                title={'添加进程'}
                open={visible}
                onClose={onClose}
                width={1000}
                footer={
                    <div className='footer-wrapper'>
                        <Button key="confirm" type="primary" onClick={handleSubmitProcess}>
                            提交
                        </Button>
                        <Button key="cancel" onClick={onClose}>
                            取消
                        </Button>
                    </div>
                }
                className="process-drawer"
            >
                <div className="process-content">
                    <Form
                        form={form}
                        layout="vertical"
                    >
                        {/* Basic Info */}
                        <Collapse defaultActiveKey={['basic']} ghost>
                            <Panel header="基础信息" key="basic">
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                    <Form.Item
                                        name="processName"
                                        label="进程名称"
                                        rules={[{ required: true, message: '请输入进程名称' }]}
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入进程名称" />
                                    </Form.Item>
                                    <Form.Item
                                        name="processAlias"
                                        label="进程别名"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入进程别名" />
                                    </Form.Item>
                                </div>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <Form.Item
                                        name="startupParams"
                                        label="进程启动参数"
                                        style={{ flex: 1 }}
                                    >
                                        <Input.TextArea
                                            placeholder="请输入进程启动参数"
                                            rows={3}
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        name="description"
                                        label="备注"
                                        style={{ flex: 1 }}
                                    >
                                        <Input.TextArea
                                            placeholder="请输入备注"
                                            rows={3}
                                        />
                                    </Form.Item>
                                </div>
                            </Panel>
                        </Collapse>

                        {/* Listen Info */}
                        <Collapse defaultActiveKey={['listen']} ghost>
                            <Panel header="监听信息" key="listen">
                                <div className="listen-content">
                                    <Table
                                        dataSource={listenInfoList}
                                        columns={listenInfoColumns}
                                        pagination={false}
                                        rowKey="id"
                                        size="small"
                                    />
                                    {
                                        listenInfoList.length === 0 && (
                                            <div className="add-button">
                                                <Button
                                                    type="link"
                                                    onClick={handleAddListenInfo}
                                                >
                                                    + 立即添加
                                                </Button>
                                            </div>
                                        )
                                    }
                                </div>
                            </Panel>
                        </Collapse>

                        {/* Process Management Info */}
                        <Collapse ghost>
                            <Panel header="进程管理信息" key="management">
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                    <Form.Item
                                        name="workPath"
                                        label="工作路径"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入工作路径" />
                                    </Form.Item>
                                    <Form.Item
                                        name="pidFile"
                                        label="PID文件路径"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入PID文件路径" />
                                    </Form.Item>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                    <Form.Item
                                        name="startUser"
                                        label="启动用户"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入启动用户" />
                                    </Form.Item>
                                    <Form.Item
                                        name="processCount"
                                        label="启动数量"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入启动数量" />
                                    </Form.Item>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                    <Form.Item
                                        name="priority"
                                        label="启动优先级"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入启动优先级" />
                                    </Form.Item>
                                    <Form.Item
                                        name="startCommand"
                                        label="启动命令"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入启动命令" />
                                    </Form.Item>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                    <Form.Item
                                        name="stopCommand"
                                        label="停止命令"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入停止命令" />
                                    </Form.Item>
                                    <Form.Item
                                        name="restartCommand"
                                        label="重启命令"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入重启命令" />
                                    </Form.Item>
                                </div>
                                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                                    <Form.Item
                                        name="forceStopCommand"
                                        label="强制停止命令"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入强制停止命令" />
                                    </Form.Item>
                                    <Form.Item
                                        name="reloadCommand"
                                        label="进程重载命令"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入进程重载命令" />
                                    </Form.Item>
                                </div>
                                <div style={{ display: 'flex', gap: '16px' }}>
                                    <Form.Item
                                        name="startWaitTime"
                                        label="启动等待时长"
                                        style={{ flex: 1 }}
                                    >
                                        <Input
                                            placeholder="请输入启动等待时长"
                                            suffix="s"
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        name="operationTimeout"
                                        label="操作超时时长"
                                        style={{ flex: 1 }}
                                    >
                                        <Input
                                            placeholder="请输入操作超时时长"
                                            suffix="s"
                                        />
                                    </Form.Item>
                                </div>
                            </Panel>
                        </Collapse>
                    </Form>
                </div>
            </Drawer>
        </>
    );
};

export default AddProcessModal; 