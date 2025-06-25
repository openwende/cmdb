import React, { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Button, Table, Collapse, Tabs, TabsProps, Space, Tooltip, Popconfirm } from 'antd';
import { EditOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { useTransferHostStore } from '@/store/TransferHostStore';
import AddHostModal from '../AddHostModal';
import AddProcessModal, { ListenInfo } from '../AddProcessModal';
import './style.css';
import { transferTarget, transferWithClearServiceInstance } from '@/mock/business';
import { getFormattedTopoPath, isHostAlreadyInTarget } from '@/pages/Business/utils';
import { TransferHostItem, TransferMenuItemType, TreeData } from '@/pages/Business/Types';
import { useNavigate } from 'react-router-dom';
import { businessTopoPath } from '../..';
import TransferHostModal from '../TransferHostModal';
import { allHosts2 } from '@/mock/business';

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
    const { selectedHosts, targetModules, transferHostType, setTransferHostData } = useTransferHostStore();
    const [showEditHostModal, setShowEditHostModal] = useState(false);
    const [showAddProcessModal, setShowAddProcessModal] = useState(false);
    const [hostProcessMap, setHostProcessMap] = useState<Record<string, ProcessItem[]>>({});
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingProcess, setEditingProcess] = useState<ProcessItem | null>(null);
    const [processModalMode, setProcessModalMode] = useState<'add' | 'edit'>('add');
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [optionsSticky, setOptionsSticky] = useState(false);
    const optionsRef = useRef<HTMLDivElement>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const sentinel = sentinelRef.current;
        if (!sentinel) return;
        // Track if the sentinelRef element enters/leaves the viewport
        // Determine whether the bottom button is in a sticky/pinned state based on this
        const observer = new IntersectionObserver(
            entries => {
                const entry = entries[0];
                setOptionsSticky(!entry.isIntersecting);
            }
        );
        observer.observe(sentinel);
        // Disconnect the observer on component unmount to avoid memory leaks
        return () => observer.disconnect();
    }, []);

    const selectedTopoPaths = useMemo(() => {
        return targetModules.map(module => getFormattedTopoPath(module, transferTarget));
    }, [targetModules]);

    const formatBindInfoText = (bindInfo: ListenInfo[]) =>
        bindInfo
            .filter(i => i.protocol && i.ip && i.port)
            .map(i => `${i.protocol} ${i.ip}:${i.port}`);

    const handleConfirm = () => {
        // TODO: api
        // bk_host_ids:[1, 2]
        // default_internal_module:9
        // is_remove_from_all:true
        console.log(selectedHosts, targetModules, hostProcessMap);
        backToPrePage();
    };

    const handleCancel = () => {
        backToPrePage();
    };

    const backToPrePage = () => {
        navigate(businessTopoPath + window.location.search, { replace: true });
    }

    const handleEditHosts = () => {
        setShowEditHostModal(true);
    };

    const handleConfirmEditHosts = useCallback((hosts: TransferHostItem[]) => {
        setTransferHostData(hosts, targetModules, transferHostType);
        setShowEditHostModal(false);
    }, [targetModules, transferHostType])

    const getProcessKey = useCallback((moduleKey: React.Key, hostId: string) => `${moduleKey}-${hostId}`, []);

    const handleAddProcess = (moduleKey: React.Key, hostId: string) => {
        setEditingKey(getProcessKey(moduleKey, hostId));
        setEditingProcess(null);
        setProcessModalMode('add');
        setShowAddProcessModal(true);
    };

    const handleEditProcess = (moduleKey: React.Key, hostId: string, process: ProcessItem) => {
        setEditingKey(getProcessKey(moduleKey, hostId));
        setEditingProcess(process);
        setProcessModalMode('edit');
        setShowAddProcessModal(true);
    };

    const handleDeleteProcess = (moduleKey: React.Key, hostId: string, process: ProcessItem) => {
        setHostProcessMap(prev => {
            const key = getProcessKey(moduleKey, hostId);
            const list = prev[key] || [];
            return { ...prev, [key]: list.filter(item => item.id !== process.id) };
        });
    };

    const handleConfirmAddProcess = useCallback((process: ProcessItem) => {
        if (!editingKey) return;
        const mapKey = editingKey;
        setHostProcessMap(prev => {
            const list = prev[mapKey] || [];
            if (processModalMode === 'add') {
                return { ...prev, [mapKey]: [...list, { ...process, id: Date.now().toString() }] };
            }
            // edit mode
            return {
                ...prev,
                [mapKey]: list.map(item => (item.id === process.id ? process : item))
            };
        });
        setShowAddProcessModal(false);
    }, [editingKey, processModalMode]);

    const handleTransferNode = useCallback((selectedNodes: TreeData[]) => {
        setTransferHostData(selectedHosts, selectedNodes, transferHostType);
    }, [selectedHosts, transferHostType])

    const handleServiceInstances = () => {
        const serviceInstances = transferWithClearServiceInstance
            .flatMap(item => item.to_remove_from_modules.flatMap(mod => mod.service_instances));
        return serviceInstances || [];
    }

    // Calculate the list of hosts to be added for each target module
    const hostsToAddByModule = useMemo(() => {
        const map: Record<string, TransferHostItem[]> = {};
        targetModules.forEach(mod => {
            const needAdd: TransferHostItem[] = [];
            selectedHosts.forEach(h => {
                if (!isHostAlreadyInTarget(allHosts2, h.id, mod)) {
                    needAdd.push(h);
                }
            });
            map[mod.key] = needAdd;
        });
        return map;
    }, [targetModules, selectedHosts, isHostAlreadyInTarget]);

    const hasChanges = useMemo(() => {
        return Object.values(hostsToAddByModule).some(list => list.length > 0);
    }, [hostsToAddByModule]);

    const isConfirmBtnAvailable = transferHostType === TransferMenuItemType.idlePool ? true : hasChanges;

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
                <Space className="tip-text">
                    <InfoCircleOutlined />
                    主机转移到目标模块后，若目标模块配置有服务模板，则新增相应的服务实例
                </Space>
                {
                    targetModules
                        .map((module) => {
                            const hostsForModule = hostsToAddByModule[module.key] || [];
                            if (hostsForModule.length === 0) return null;
                            const topoPath = getFormattedTopoPath(module, transferTarget);
                            return (
                                <div key={module.key} className="module-section">
                                    {hostsForModule.map((host: TransferHostItem, index: number) => (
                                        <Collapse
                                            className={index !== 0 ? 'inst-panel' : undefined}
                                            key={`${module.key}-${host.id}`}
                                            items={[{
                                                key: `${module.key}-${host.id}`,
                                                label: (
                                                    <div className="host-header">
                                                        <span>{host.ip}</span>
                                                        <span className="status-text">
                                                            {(hostProcessMap[getProcessKey(module.key, String(host.id))]?.length || 0) === 0 ? '（未添加进程）' : null}
                                                        </span>
                                                    </div>
                                                ),
                                                extra: topoPath,
                                                children: (
                                                    <div className="host-content">
                                                        <Table
                                                            columns={columns.map(col =>
                                                                col.key === 'action'
                                                                    ? {
                                                                        ...col,
                                                                        render: (_: any, record: ProcessItem) => (
                                                                            <>
                                                                                <Button
                                                                                    type="link"
                                                                                    size="small"
                                                                                    onClick={() => handleEditProcess(module.key, String(host.id), record)}
                                                                                >
                                                                                    编辑
                                                                                </Button>
                                                                                <Popconfirm
                                                                                    title="确定删除该进程?"
                                                                                    onConfirm={() => handleDeleteProcess(module.key, String(host.id), record)}
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
                                                            dataSource={hostProcessMap[getProcessKey(module.key, String(host.id))] || []}
                                                            pagination={false}
                                                            size="small"
                                                            rowKey="id"
                                                        />
                                                        <div className="add-button">
                                                            <Button
                                                                type="link"
                                                                onClick={() => handleAddProcess(module.key, String(host.id))}
                                                            >
                                                                + 添加进程
                                                            </Button>
                                                        </div>
                                                    </div>
                                                )
                                            }]}
                                        />
                                    ))}
                                </div>
                            );
                        }
                        )
                }
            </div>
        );
    }

    const renderDelInst = () => {
        const serviceInstances = handleServiceInstances();
        const tableData = serviceInstances.map(inst => {
            // Find owning module 
            let topoPath = '';
            if (inst.bk_module_id) {
                const node = transferTarget.nodes.find(n => n.topo_node.bk_inst_id === inst.bk_module_id);
                if (node && node.topo_path) {
                    topoPath = node.topo_path.slice().reverse().map(p => p.bk_inst_name).join(' / ');
                }
            }
            return {
                id: inst.id,
                name: inst.name,
                module: topoPath,
            };
        });
        return (
            <>
                <Space className='tip-text'>
                    <InfoCircleOutlined />
                    移出当前模块，主机的服务实例信息也一同被删除
                </Space>
                <Table
                    columns={[
                        { title: '操作', dataIndex: 'action', render: () => <span className='del-action'>删除</span> },
                        { title: '服务实例', dataIndex: 'name' },
                        { title: '所属模块', dataIndex: 'module' },
                    ]}
                    dataSource={tableData}
                    rowKey="id"
                    pagination={false}
                />
            </>
        );
    };

    const renderEmpty = () => {
        return <div className="empty-wrapper">
            <Space className='tip-text'>
                <InfoCircleOutlined /> 目标模块为源模块，无变更信息
            </Space>
        </div>
    }

    const delTabItems: TabsProps['items'] = [
        {
            key: 'delInst',
            label: <span className='del-label'>
                删除服务实例
                <span className='inst-count'>
                    {handleServiceInstances().length}
                </span>
            </span>,
            children: renderDelInst(),
        }
    ]

    const addTabItems: TabsProps['items'] = [
        {
            key: 'addInst',
            label: '新增服务实例',
            children: hasChanges ? renderAddInst() : renderEmpty(),
        },
        ...(handleServiceInstances().length > 0 ? delTabItems : [])
    ]

    const tabItems = transferHostType === TransferMenuItemType.idlePool
        ? delTabItems
        : addTabItems;

    const initialKeys = useMemo(() => targetModules.map(m => m.key), [targetModules]);

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
                    {targetModules.map((module, idx) => (
                        <Tooltip title={selectedTopoPaths[idx]} key={module.key}>
                            <Button
                                color="default"
                                variant="outlined"
                                className={`info-button ${idx !== 0 ? 'info-button-right' : ''}`}
                            >
                                {module.title}
                            </Button>
                        </Tooltip>
                    ))}
                    {
                        transferHostType && <EditOutlined
                            className="edit-icon"
                            onClick={() => setShowTransferModal(true)}
                        />
                    }
                </div>
            </div>

            <div className='info-item'>
                <label className='info-label'>
                    变更确认：
                </label>
                <div className='info-content'>
                    <Tabs defaultActiveKey="1" items={tabItems} />
                    <div
                        className={`options${optionsSticky ? ' sticky-active' : ''}`}
                        ref={optionsRef}
                    >
                        <Button
                            type="primary"
                            onClick={handleConfirm}
                            disabled={!isConfirmBtnAvailable}
                        >
                            确认变更
                        </Button>
                        <Button onClick={handleCancel}>
                            取消
                        </Button>
                    </div>
                    <div ref={sentinelRef} style={{ height: 1 }} />
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

            {/* Transfer host modal */}
            <TransferHostModal
                visible={showTransferModal}
                transferType={transferHostType as TransferMenuItemType}
                selectedHosts={selectedHosts}
                onClose={() => setShowTransferModal(false)}
                onConfirm={handleTransferNode}
                initialSelectedKeys={initialKeys}
                initialExpandedKeys={initialKeys}
            />
        </div>
    );
};

export default TransferHost; 