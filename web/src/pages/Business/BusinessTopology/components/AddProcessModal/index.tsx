import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Drawer, Button, Collapse, Form, Input, Select, Switch, Table, Space, Tooltip, Modal } from 'antd';
import './style.css';
import { InfoCircleOutlined } from '@ant-design/icons';
import { listenIPOptions } from '@/mock/business';
import { ProcessItem } from '../TransferHost';

const { Panel } = Collapse;

const protocolOptions = [
    'TCP',
    'UDP',
    'TCP6',
    'UDP6'
]

interface Props {
    visible: boolean;
    onClose: () => void;
    onSubmit: (info: any) => void;
    mode: 'add' | 'edit';
    initialValues?: ProcessItem | null;
}

export interface ListenInfo {
    id: string;
    ip: string | null;
    port: string | null;
    protocol: string | null;
    enable: boolean;
}

const AddProcessModal: React.FC<Props> = ({ visible, onClose, onSubmit, mode, initialValues }) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();

    const [listenInfoList, setListenInfoList] = useState<ListenInfo[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [isChanged, setIsChanged] = useState(false);

    useEffect(() => {
        if (visible) {
            if (mode === 'edit' && initialValues) {
                form.setFieldsValue(initialValues);
                setListenInfoList(initialValues.bindInfo || []);
            } else if (mode === 'add') {
                form.resetFields();
                setListenInfoList([]);
            }
        }
    }, [visible, mode, initialValues, form]);

    useEffect(() => {
        if (mode !== 'edit' || !initialValues) {
            setIsChanged(true);
            return;
        }
        const formValues = form.getFieldsValue();
        const isFormChanged = Object.keys(formValues).some(key => formValues[key] !== initialValues[key]);
        const isListenChanged = JSON.stringify(listenInfoList) !== JSON.stringify(initialValues.bindInfo || []);
        setIsChanged(isFormChanged || isListenChanged);
    }, [listenInfoList, initialValues, mode]);

    // Listen to form changes
    const handleFormChange = () => {
        if (mode !== 'edit' || !initialValues) {
            setIsChanged(true);
            return;
        }
        const formValues = form.getFieldsValue();
        const isFormChanged = Object.keys(formValues).some(key => formValues[key] !== initialValues[key]);
        const isListenChanged = JSON.stringify(listenInfoList) !== JSON.stringify(initialValues.bindInfo || []);
        setIsChanged(isFormChanged || isListenChanged);
    };

    // Handle add listen info row
    const handleAddListenInfo = () => {
        const newId = Date.now().toString();
        setListenInfoList([...listenInfoList, {
            id: newId,
            ip: null,
            port: null,
            protocol: null,
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
            width: 180,
            render: (value: string, record: ListenInfo) => (
                <Select
                    value={value}
                    style={{ width: '100%' }}
                    placeholder="请选择或输入IP"
                    onChange={val => handleUpdateListenInfo(record.id, 'ip', val)}
                >
                    {
                        listenIPOptions.options.map(item => (
                            <Select.Option value={item} key={item}>{item}</Select.Option>
                        ))
                    }
                </Select>
            )
        },
        {
            title: 'Port',
            dataIndex: 'port',
            key: 'port',
            width: 180,
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
            width: 180,
            render: (value: string, record: ListenInfo) => (
                <Select
                    value={value}
                    style={{ width: '100%' }}
                    placeholder="请选择Protocol"
                    onChange={val => handleUpdateListenInfo(record.id, 'protocol', val)}
                >
                    {
                        protocolOptions.map(item => (
                            <Select.Option value={item} key={item}>{item}</Select.Option>
                        ))
                    }
                </Select>
            )
        },
        {
            title: 'Enable',
            dataIndex: 'enable',
            key: 'enable',
            width: 150,
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
            // Keep the original ID（edit mode）
            const payload = mode === 'edit' && initialValues ? { id: initialValues.id, ...values } : {
                ...values,
            };
            onSubmit({ ...payload, bindInfo: listenInfoList });
        });
    };

    const handleClose = () => {
        if (mode === 'edit') {
            if (isChanged) {
                setShowModal(true);
            } else {
                onClose();
            }
        } else {
            setShowModal(true);
        }
    }

    const handleConfirmClose = () => {
        form.resetFields();
        setListenInfoList([]);
        setShowModal(false);
        onClose();
    }

    return (
        <>
            <Drawer
                title={mode === 'edit' ? '编辑进程' : '添加进程'}
                open={visible}
                onClose={handleClose}
                width={1000}
                footer={
                    <div className='footer-wrapper'>
                        <Button key="confirm" type="primary" onClick={handleSubmitProcess} disabled={mode === 'edit' && !isChanged}>
                            提交
                        </Button>
                        <Button key="cancel" onClick={handleClose}>
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
                        onValuesChange={handleFormChange}
                    >
                        {/* Basic Info */}
                        <Collapse defaultActiveKey={['basic']} ghost>
                            <Panel header="基础信息" key="basic">
                                <div className='form-row'>
                                    <Form.Item
                                        name="processName"
                                        label={<span>进程名称
                                            <Tooltip
                                                title={<span style={{ whiteSpace: 'nowrap' }}>
                                                    程序的二进制名称（比如zookeeper的二进制名称是java，则填java）
                                                </span>}
                                                styles={{ root: { maxWidth: 'none' } }}
                                                className='label-tip'
                                            >
                                                <InfoCircleOutlined />
                                            </Tooltip>
                                        </span>}
                                        rules={[{ required: true, message: t("common.form.rules_message") }]}
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入进程名称" />
                                    </Form.Item>
                                    <Form.Item
                                        name="processAlias"
                                        label={<span>进程别名
                                            <Tooltip
                                                title={<span style={{ whiteSpace: 'nowrap' }}>
                                                    对外显示的服务名（比如程序的二进制名称为java的服务zookeeper，则填zookeeper）
                                                </span>}
                                                styles={{ root: { maxWidth: 'none' } }}
                                                className='label-tip'
                                            >
                                                <InfoCircleOutlined />
                                            </Tooltip>
                                        </span>}
                                        rules={[{ required: true, message: t("common.form.rules_message") }]}
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入进程别名" />
                                    </Form.Item>
                                </div>
                                <div className='form-row'>
                                    <Form.Item
                                        name="startupParams"
                                        label={<span>进程启动参数
                                            <Tooltip
                                                title={<span style={{ whiteSpace: 'nowrap' }}>
                                                    程序启动参数，用于唯一识别一个进程（例如 -cp zookeeper）
                                                </span>}
                                                styles={{ root: { maxWidth: 'none' } }}
                                                className='label-tip'
                                            >
                                                <InfoCircleOutlined />
                                            </Tooltip>
                                        </span>}
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
                                <div className='form-row'>
                                    <Form.Item
                                        name="workPath"
                                        label={<span>工作路径
                                            <Tooltip
                                                title={<span style={{ whiteSpace: 'nowrap' }}>
                                                    执行进程启停等操作的工作路径
                                                </span>}
                                                styles={{ root: { maxWidth: 'none' } }}
                                                className='label-tip'
                                            >
                                                <InfoCircleOutlined />
                                            </Tooltip>
                                        </span>
                                        }
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
                                <div className='form-row'>
                                    <Form.Item
                                        name="startUser"
                                        label="启动用户"
                                        style={{ flex: 1 }}
                                    >
                                        <Input placeholder="请输入启动用户" />
                                    </Form.Item>
                                    <Form.Item
                                        name="startCount"
                                        label="启动数量"
                                        style={{ flex: 1 }}
                                    >
                                        <Input type='number' placeholder="请输入启动数量" />
                                    </Form.Item>
                                </div>
                                <div className='form-row'>
                                    <Form.Item
                                        name="priority"
                                        label={<span>启动优先级
                                            <Tooltip
                                                title={<span style={{ whiteSpace: 'nowrap' }}>
                                                    批量启动进程依据优先级从小到大排序操作，停止进程按反序操作。优先级数值范围支持输入 [ -100 ~ 10000 ]
                                                </span>}
                                                styles={{ root: { maxWidth: 'none' } }}
                                                className='label-tip'
                                            >
                                                <InfoCircleOutlined />
                                            </Tooltip>
                                        </span>}
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
                                <div className='form-row'>
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
                                <div className='form-row'>
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
                                <div className='form-row'>
                                    <Form.Item
                                        name="startWaitTime"
                                        label={<span>启动等待时长
                                            <Tooltip
                                                title={<span style={{ whiteSpace: 'nowrap' }}>
                                                    在执行启动命令后，等待多久检查PID存活的状态
                                                </span>}
                                                styles={{ root: { maxWidth: 'none' } }}
                                                className='label-tip'
                                            >
                                                <InfoCircleOutlined />
                                            </Tooltip>
                                        </span>}
                                        style={{ flex: 1 }}
                                    >
                                        <Input
                                            type='number'
                                            placeholder="请输入启动等待时长"
                                            suffix="s"
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        name="operationTimeout"
                                        label={<span>操作超时时长
                                            <Tooltip
                                                title={<span style={{ whiteSpace: 'nowrap' }}>
                                                    执行命令的超时时长
                                                </span>}
                                                styles={{ root: { maxWidth: 'none' } }}
                                                className='label-tip'
                                            >
                                                <InfoCircleOutlined />
                                            </Tooltip>
                                        </span>}
                                        style={{ flex: 1 }}
                                    >
                                        <Input
                                            type='number'
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
            <Modal
                title={null}
                width={400}
                open={showModal}
                okText='离开'
                cancelText='取消'
                maskClosable={false}
                onOk={handleConfirmClose}
                onCancel={() => setShowModal(false)}
                className='confirm-modal'
            >
                <p className='confirm-title'>确认离开当前页？</p>
                <p className='confirm-desc'>离开将会导致未保存信息丢失</p>
            </Modal>
        </>
    );
};

export default AddProcessModal; 