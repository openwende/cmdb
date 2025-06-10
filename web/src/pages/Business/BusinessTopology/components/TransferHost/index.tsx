import React, { useState } from 'react';
import { Button, Table, Collapse, Tabs, TabsProps, Space, Tooltip } from 'antd';
import { EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTransferHostStore } from '@/store/TransferHostStore';
import AddHostModal from '../AddHostModal';
import AddProcessModal from '../AddProcessModal';
import './style.css';
import { transferTarget } from '@/mock/business';
import { getFormattedTopoPath } from '@/pages/Business/utils';

const { Panel } = Collapse;

interface Props {
    onBack?: () => void;
}

const TransferHost: React.FC<Props> = ({ onBack }) => {
    const { selectedHosts, selectedNode } = useTransferHostStore();
    const [showEditHostModal, setShowEditHostModal] = useState(false);
    const [showAddProcessModal, setShowAddProcessModal] = useState(false);

    const selectedTopoPath = getFormattedTopoPath(selectedNode, transferTarget);

    const columns = [
        {
            title: '进程名称',
            dataIndex: 'processName',
            key: 'processName',
        },
        {
            title: '进程端口',
            dataIndex: 'port',
            key: 'port',
        },
        {
            title: '监听协议端口',
            dataIndex: 'protocol',
            key: 'protocol',
        },
        {
            title: '绑定配置模板',
            dataIndex: 'bindConfig',
            key: 'bindConfig',
        },
        {
            title: '操作',
            key: 'action',
            render: () => (
                <Button type="link" size="small">
                    编辑
                </Button>
            ),
        },
    ];

    const handleConfirm = () => {

    };

    const handleCancel = () => {
        onBack?.();
    };

    const handleEditHosts = () => {
        setShowEditHostModal(true);
    };

    const handleConfirmEditHosts = () => {
        setShowEditHostModal(false);
    };

    const handleAddProcess = () => {
        setShowAddProcessModal(true);
    };

    const handleConfirmAddProcess = () => {
        
    }

    const renderAddInst = () => {
        return (
            <div className="add-inst-wrapper">
                <Space className='tip-text'>
                    <InfoCircleOutlined />
                    主机转移到目标模块后，若目标模块配置有服务模板，则新增相应的服务实例
                </Space>
                <Collapse>
                    {selectedHosts.length > 0 ? selectedHosts.map((host) => (
                        <Panel
                            header={
                                <div className="host-header">
                                    <span>{host.ip}</span>
                                    <span className="status-text">（未添加进程）</span>
                                </div>
                            }
                            extra={selectedTopoPath}
                            key={host.id.toString()}
                        >
                            <div className="host-content">
                                <Table
                                    columns={columns}
                                    dataSource={[]}
                                    pagination={false}
                                    size="small"
                                />
                                <div className="add-button">
                                    <Button
                                        type="link"
                                        onClick={handleAddProcess}
                                    >
                                        + 添加进程
                                    </Button>
                                </div>
                            </div>
                        </Panel>
                    )) : null}
                </Collapse>
            </div>
        );
    }

    const tabItems: TabsProps['items'] = [
        {
            key: 'addInst',
            label: '新增服务实例',
            children: renderAddInst(),
        }
    ]

    return (
        <div className="transfer-container">
            <div className='info-item'>
                <label className='info-label'>
                    已选主机：
                </label>
                <div className='info-content'>
                    <span className='info-number'>{selectedHosts.length}</span> 台
                    <EditOutlined
                        className="edit-icon"
                        onClick={handleEditHosts}
                    />
                </div>
            </div>

            <div className='info-item'>
                <label className='info-label'>
                    转移到：
                </label>
                <div className='info-content'>
                    <Tooltip title={selectedTopoPath}>
                        <Button color="default" variant="outlined" className='info-button'>
                            {selectedNode?.title}
                        </Button>
                    </Tooltip>
                    <div className='module-grep' />
                </div>
            </div>

            <div className='info-item'>
                <label className='info-label'>
                    变更确认：
                </label>
                <div className='info-content'>
                    <Tabs defaultActiveKey="1" items={tabItems} />
                    <div className="options">
                        <Button
                            type="primary"
                            onClick={handleConfirm}
                        >
                            确认添加
                        </Button>
                        <Button onClick={handleCancel}>
                            取消
                        </Button>
                    </div>
                </div>
            </div>

            {/* Edit hosts modal */}
            <AddHostModal
                visible={showEditHostModal}
                onClose={() => setShowEditHostModal(false)}
                onConfirm={handleConfirmEditHosts}
                initialSelectedHosts={selectedHosts}
            />

            {/* Add process modal */}
            <AddProcessModal
                visible={showAddProcessModal}
                onClose={() => setShowAddProcessModal(false)}
                onSubmit={handleConfirmAddProcess}
            />
        </div>
    );
};

export default TransferHost; 