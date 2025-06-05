import React, { useState } from 'react';
import { Modal, Button, Collapse, Form, Input, Select, Switch, Tooltip, Table, Space } from 'antd';
import { EditOutlined, LeftOutlined } from '@ant-design/icons';
import AddHostModal from '../AddHostModal';
import { transferTarget } from '@/mock/business';
import './style.css';

const { Panel } = Collapse;

interface Props {
    visible: boolean;
    onClose: () => void;
    onBack?: () => void;
    selectedHosts: any[];
    targetModuleId?: string;
}

interface ListenInfo {
    id: string;
    ip: string;
    port: string;
    protocol: string;
    enable: boolean;
}

const AddProcessModal: React.FC<Props> = ({ visible, onClose, onBack, selectedHosts, targetModuleId }) => {
    const [showEditHostModal, setShowEditHostModal] = useState(false);
    const [currentHosts, setCurrentHosts] = useState(selectedHosts);
    const [form] = Form.useForm();
    
    // Listen info state for the form
    const [listenInfoList, setListenInfoList] = useState<ListenInfo[]>([
        { id: '1', ip: '', port: '', protocol: 'TCP', enable: true }
    ]);

    // Get tooltip content for transfer target
    const getTransferTargetTooltip = () => {
        if (!targetModuleId) return '';
        
        const target = transferTarget.nodes.find(node => 
            node.topo_node.bk_inst_id.toString() === targetModuleId
        );
        
        if (!target) return '';
        
        // Build topology path string
        const pathReversed = [...target.topo_path].reverse();
        return pathReversed.map(item => item.bk_inst_name).join(' > ');
    };

    // Handle edit hosts
    const handleEditHosts = () => {
        setShowEditHostModal(true);
    };

    // Handle confirm edit hosts
    const handleConfirmEditHosts = (hosts: any[]) => {
        setCurrentHosts(hosts);
        setShowEditHostModal(false);
    };

    // Handle add listen info row
    const handleAddListenInfo = () => {
        const newId = Date.now().toString();
        setListenInfoList([...listenInfoList, {
            id: newId,
            ip: '',
            port: '',
            protocol: 'TCP',
            enable: true
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
                        disabled={listenInfoList.length === 1}
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
            <Modal
                title={<div className="modal-header">
                    <LeftOutlined className="back-icon" onClick={onBack} />
                    <span>添加进程</span>
                </div>}
                open={visible}
                onCancel={onClose}
                width={1000}
                footer={[
                    <Button key="cancel" onClick={onClose}>
                        取消
                    </Button>,
                    <Button key="confirm" type="primary" onClick={handleSubmitProcess}>
                        提交
                    </Button>
                ]}
                className="add-process-modal"
            >
                <div className="add-process-content">
                    {/* Selected hosts section */}
                    <div className="hosts-section">
                        <div className="hosts-header">
                            <span>已选择 {currentHosts.length} 台主机</span>
                            <EditOutlined 
                                className="edit-icon" 
                                onClick={handleEditHosts}
                            />
                        </div>
                        <div className="hosts-list">
                            {currentHosts.map((host, index) => (
                                <span key={index} className="host-item">
                                    {host.bk_host_innerip}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Transfer target section */}
                    <div className="transfer-section">
                        <span>转移到</span>
                        <Tooltip title={getTransferTargetTooltip()}>
                            <span className="transfer-target">
                                {targetModuleId ? `模块 ${targetModuleId}` : '未选择目标模块'}
                            </span>
                        </Tooltip>
                    </div>

                    {/* Process configuration form */}
                    <Form
                        form={form}
                        layout="vertical"
                        className="process-form"
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
                                <div style={{ color: 'red', marginBottom: '16px', fontSize: '14px' }}>
                                    有未正确配置的监听信息
                                </div>
                                <Table
                                    dataSource={listenInfoList}
                                    columns={listenInfoColumns}
                                    pagination={false}
                                    rowKey="id"
                                    size="small"
                                />
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
                                        name="reloadCommand"
                                        label="重载命令"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入重载命令" />
                                    </Form.Item>
                                    <Form.Item
                                        name="forceStopCommand"
                                        label="强制停止命令"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入强制停止命令" />
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
            </Modal>

            {/* Edit hosts modal */}
            <AddHostModal
                visible={showEditHostModal}
                onClose={() => setShowEditHostModal(false)}
                onConfirm={handleConfirmEditHosts}
                initialSelectedHosts={currentHosts}
            />
        </>
    );
};

export default AddProcessModal; 