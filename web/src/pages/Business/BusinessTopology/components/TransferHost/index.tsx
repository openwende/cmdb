import React, { useState } from 'react';
import { Button, Table, Collapse, Tabs, TabsProps, Space, Tooltip, Popconfirm } from 'antd';
import { EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTransferHostStore } from '@/store/TransferHostStore';
import AddHostModal from '../AddHostModal';
import AddProcessModal, { ListenInfo } from '../AddProcessModal';
import './style.css';
import { transferTarget } from '@/mock/business';
import { getFormattedTopoPath } from '@/pages/Business/utils';
import { AddHostItem } from '@/pages/Business/Types';
import { useNavigate } from 'react-router-dom';

export interface ProcessItem {
    id: string;
    processName: string;
    processAlias: string;
    startupParams?: string;
    bindInfo: ListenInfo[];
    [key: string]: any;
}

const TransferHost: React.FC = () => {
    const navigate = useNavigate();
    const { selectedHosts, selectedNode } = useTransferHostStore();
    const [showEditHostModal, setShowEditHostModal] = useState(false);
    const [showAddProcessModal, setShowAddProcessModal] = useState(false);
    const [hostProcessMap, setHostProcessMap] = useState<Record<string, ProcessItem[]>>({});
    const [editingHostId, setEditingHostId] = useState<string | null>(null);
    const [editingProcess, setEditingProcess] = useState<ProcessItem | null>(null);
    const [processModalMode, setProcessModalMode] = useState<'add' | 'edit'>('add');

    const selectedTopoPath = getFormattedTopoPath(selectedNode, transferTarget);

    const formatBindInfoText = (bindInfo: ListenInfo[]) =>
        bindInfo
            .filter(i => i.protocol && i.ip && i.port)
            .map(i => `${i.protocol} ${i.ip}:${i.port}`);

    const handleConfirmAdd = () => {
        // TODO: api
        backToPrePage();
    };

    const handleCancel = () => {
        backToPrePage();
    };

    const backToPrePage = () => {
        navigate('/business/topology' + window.location.search, { replace: true });
    }

    const handleEditHosts = () => {
        setShowEditHostModal(true);
    };

    const handleConfirmEditHosts = () => {
        setShowEditHostModal(false);
    };

    const handleAddProcess = (hostId: string) => {
        setEditingHostId(hostId);
        setEditingProcess(null);
        setProcessModalMode('add');
        setShowAddProcessModal(true);
    };

    const handleEditProcess = (hostId: string, process: ProcessItem) => {
        setEditingHostId(hostId);
        setEditingProcess(process);
        setProcessModalMode('edit');
        setShowAddProcessModal(true);
    };

    const handleDeleteProcess = (hostId: string, process: ProcessItem) => {
        setHostProcessMap(prev => {
            const list = prev[hostId] || [];
            return { ...prev, [hostId]: list.filter(item => item.id !== process.id) };
        });
    };

    const handleConfirmAddProcess = (process: ProcessItem) => {
        setHostProcessMap(prev => {
            const list = prev[editingHostId!] || [];
            if (processModalMode === 'add') {
                return { ...prev, [editingHostId!]: [...list, { ...process, id: Date.now().toString() }] };
            } else {
                return {
                    ...prev,
                    [editingHostId!]: list.map(item => item.id === process.id ? process : item)
                };
            }
        });
        setShowAddProcessModal(false);
    };

    const columns = [
        {
            title: '进程名称',
            dataIndex: 'processName',
            key: 'processName',
        },
        {
            title: '进程别名',
            dataIndex: 'processAlias',
            key: 'processAlias',
        },
        {
            title: '进程启动参数',
            dataIndex: 'startupParams',
            key: 'startupParams',
            render: (val: string) => {
                return val || '--'
            }
        },
        {
            title: '绑定信息',
            dataIndex: 'bindInfo',
            key: 'bindInfo',
            render: (bindInfo: ListenInfo[]) => {
                if (!Array.isArray(bindInfo) || bindInfo.length === 0) return '--';
                const items = formatBindInfoText(bindInfo);
                if (items.length === 0) return '--';
                return (
                    <Tooltip
                        title={<div style={{ whiteSpace: 'pre-line' }}>{items.join('\n')}</div>}
                        placement="top"
                    >
                        <span>
                            {items.join(', ')}
                            <span className='bind-number'>
                                {items.length}
                            </span>
                        </span>
                    </Tooltip>
                );
            },
        },
        {
            title: '操作',
            key: 'action'
        },
    ];

    const renderAddInst = () => {
        return (
            <div className="add-inst-wrapper">
                <Space className='tip-text'>
                    <InfoCircleOutlined />
                    主机转移到目标模块后，若目标模块配置有服务模板，则新增相应的服务实例
                </Space>
                {selectedHosts.length > 0 ? selectedHosts.map((host: AddHostItem, index: number) => (
                    <Collapse className={index !== 0 ? 'inst-panel' : undefined} key={String(host.id)} items={[{
                        key: String(host.id),
                        label: <div className="host-header">
                            <span>{host.ip}</span>
                            <span className="status-text">
                                {(hostProcessMap[String(host.id)]?.length || 0) === 0 ? '（未添加进程）' : null}
                            </span>
                        </div>,
                        extra: selectedTopoPath,
                        children: <div className="host-content">
                            <Table
                                columns={columns.map(col =>
                                    col.key === 'action'
                                        ? {
                                            ...col, render: (_: any, record: ProcessItem) => (
                                                <>
                                                    <Button
                                                        type="link"
                                                        size="small"
                                                        onClick={() => handleEditProcess(String(host.id), record)}
                                                    >
                                                        编辑
                                                    </Button>
                                                    <Popconfirm
                                                        title="确定删除该进程?"
                                                        onConfirm={() => handleDeleteProcess(String(host.id), record)}
                                                        okText="确定"
                                                        cancelText="取消"
                                                    >
                                                        <Button type="link" danger size="small">删除</Button>
                                                    </Popconfirm>
                                                </>
                                            )
                                        }
                                        : col
                                )}
                                dataSource={hostProcessMap[String(host.id)] || []}
                                pagination={false}
                                size="small"
                                rowKey="id"
                            />
                            <div className="add-button">
                                <Button
                                    type="link"
                                    onClick={() => handleAddProcess(String(host.id))}
                                >
                                    + 添加进程
                                </Button>
                            </div>
                        </div>
                    }]}>
                    </Collapse>
                )) : null}
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
                            onClick={handleConfirmAdd}
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
                mode={processModalMode}
                initialValues={editingProcess}
            />
        </div>
    );
};

export default TransferHost; 