import React, { useState } from 'react';
import { Modal, Tabs, Table, Button, Input, Collapse, List, message, TabsProps, CollapseProps, Dropdown, MenuProps } from 'antd';
import { CloseOutlined, MoreOutlined } from '@ant-design/icons';
import TopologyTree from '../TopologyTree';
import { allHosts2 } from '@/mock/business';
import { TailEleType } from '@/pages/Business/Types';
import Pagination from '@/components/common/Pagination';
import './style.css';

interface Props {
    visible: boolean;
    onClose: () => void;
    onConfirm: (hosts: any[]) => void;
}

interface HostData {
    bk_host_id: number;
    bk_host_innerip: string;
    bk_host_innerip_v6?: string;
    bk_cloud_id: any[];
}

enum MenuItemKey {
    CopyIP = 'copyIP',
    RemoveAll = 'removeAll'
}

enum TabItemKey {
    StaticTopo = 'staticTopo',
    CustomInput = 'customInput'
}

const AddHostModal: React.FC<Props> = ({ visible, onClose, onConfirm }) => {
    const [activeTab, setActiveTab] = useState<string>(TabItemKey.StaticTopo);
    const [selectedTreeKey, setSelectedTreeKey] = useState<string | null>(null);
    const [selectedHosts, setSelectedHosts] = useState<React.Key[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [customInput, setCustomInput] = useState<string>('');
    const [customHosts, setCustomHosts] = useState<HostData[]>([]);
    const [hoveredHostId, setHoveredHostId] = useState<React.Key | null>(null);

    // Table columns definition
    const columns = [
        {
            title: '内网IP',
            dataIndex: 'bk_host_innerip',
            key: 'bk_host_innerip'
        },
        {
            title: '内网IPv6',
            dataIndex: 'bk_host_innerip_v6',
            key: 'bk_host_innerip_v6',
            render: (text: string) => text || '--'
        },
        {
            title: '管控区域',
            dataIndex: 'bk_cloud_id',
            key: 'bk_cloud_id',
            render: (cloudInfo: any[]) => {
                return cloudInfo.length > 0
                    ? `${cloudInfo[0].bk_inst_name}[${cloudInfo[0].bk_inst_id}]`
                    : '--';
            }
        }
    ];

    // Get current hosts data based on active tab
    const getCurrentHosts = () => {
        if (activeTab === TabItemKey.StaticTopo) {
            return allHosts2.map(item => ({
                ...item.host,
                key: item.host.bk_host_id
            }));
        } else {
            return customHosts.map(host => ({
                ...host,
                key: host.bk_host_id
            }));
        }
    };

    // Handle custom input add hosts
    const handleAddCustomHosts = () => {
        if (!customInput.trim()) {
            message.warning('请输入主机IP');
            return;
        }

        const ips = customInput.split('\n').filter(ip => ip.trim());
        const newHosts: HostData[] = [];
        const existingIps = new Set(customHosts.map(h => h.bk_host_innerip));

        ips.forEach((ip, index) => {
            const trimmedIp = ip.trim();
            if (trimmedIp && !existingIps.has(trimmedIp)) {
                newHosts.push({
                    bk_host_id: Date.now() + index,
                    bk_host_innerip: trimmedIp,
                    bk_host_innerip_v6: '',
                    bk_cloud_id: [{
                        id: "90000001",
                        bk_obj_id: "plat",
                        bk_obj_icon: "",
                        bk_inst_id: 90000001,
                        bk_obj_name: "",
                        bk_inst_name: "未分配"
                    }]
                });
            }
        });

        if (newHosts.length > 0) {
            const updatedHosts = [...customHosts, ...newHosts];
            setCustomHosts(updatedHosts);
            // Auto select newly added hosts
            const newSelectedKeys = [...selectedHosts, ...newHosts.map(h => h.bk_host_id)];
            setSelectedHosts(newSelectedKeys);
            setCustomInput('');
            message.success(`成功添加 ${newHosts.length} 台主机`);
        } else {
            message.warning('没有新的主机可添加');
        }
    };

    // Handle remove host
    const handleRemoveHost = (hostId: React.Key) => {
        if (activeTab === TabItemKey.StaticTopo) {
            setSelectedHosts(prev => prev.filter(id => id !== hostId));
        } else {
            setCustomHosts(prev => prev.filter(h => h.bk_host_id !== hostId));
            setSelectedHosts(prev => prev.filter(id => id !== hostId));
        }
    };

    // Handle copy IPs
    const handleCopyIPs = async () => {
        const currentHosts = getCurrentHosts();
        const selectedIPs = selectedHosts.map(hostId => {
            const host = currentHosts.find(h => h.key === hostId);
            return host?.bk_host_innerip;
        }).filter(Boolean).join('\n');

        try {
            await navigator.clipboard.writeText(selectedIPs);
            message.success('IP复制成功');
        } catch (error) {
            message.error('复制失败');
        }
    };

    // Handle remove all selected hosts
    const handleRemoveAll = () => {
        setSelectedHosts([]);
        if (activeTab === TabItemKey.CustomInput) {
            setCustomHosts([]);
        }
    };

    // Get selected hosts for list display
    const getSelectedHostsList = () => {
        return selectedHosts.map(hostId => {
            const currentHosts = getCurrentHosts();
            const host = currentHosts.find(h => h.key === hostId);
            return host ? {
                id: hostId,
                ip: host.bk_host_innerip
            } : null;
        }).filter(Boolean);
    };

    const handleConfirm = () => {
        const currentHosts = getCurrentHosts();
        const selectedHostData = selectedHosts.map(hostId =>
            currentHosts.find(h => h.key === hostId)
        ).filter(Boolean);

        onConfirm(selectedHostData);
        handleCancel();
    };

    const handleCancel = () => {
        setActiveTab(TabItemKey.StaticTopo);
        setSelectedTreeKey(null);
        setSelectedHosts([]);
        setCustomInput('');
        setCustomHosts([]);
        setHoveredHostId(null);
        onClose();
    };

    const handleMenuClick = (key: MenuItemKey, domEvent: React.MouseEvent | React.KeyboardEvent) => {
        domEvent.stopPropagation();
        if (key === MenuItemKey.CopyIP) {
            handleCopyIPs();
        } else if (key === MenuItemKey.RemoveAll) {
            handleRemoveAll();
        }
    }

    const renderHostList = () => {
        const total = getCurrentHosts().length;
        return (
            <div className='table-wrapper'>
                <Input.Search
                    placeholder="请输入"
                    className='search-input'
                />
                <Table
                    rowSelection={{
                        selectedRowKeys: selectedHosts,
                        onChange: setSelectedHosts
                    }}
                    columns={columns}
                    dataSource={getCurrentHosts()}
                    rowKey={item => item.bk_host_id}
                    pagination={false}
                    size="small"
                    className='table-list'
                />
                {
                    total > 0 && <Pagination
                        total={total}
                        pageSize={pageSize}
                        current={page}
                        onChange={setPage}
                        onSizeChange={(_, size) => {
                            setPage(1);
                            setPageSize(size);
                        }}
                    />
                }
            </div>
        )
    }

    // Render static topology tab content
    const renderStaticTopology = () => (
        <div className='topology-wrapper'>
            <div className='tree-wrapper'>
                <Input.Search
                    placeholder="搜索拓扑节点"
                    className='search-input'
                />
                <TopologyTree
                    selectedKey={selectedTreeKey}
                    onSelect={(key) => setSelectedTreeKey(key)}
                    tailEleType={TailEleType.Count}
                />
            </div>
            {renderHostList()}
        </div>
    );

    // Render custom input tab content
    const renderCustomInput = () => (
        <div className='custom-input-wrapper'>
            <div className='input-area'>
                <Input.TextArea
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="请输入IP，换行分隔"
                    className='text-area'
                />
                <div className='error-text'>
                    IP不正确或主机不存在
                </div>
                <Button
                    onClick={handleAddCustomHosts}
                    color="primary"
                    variant="outlined"
                >
                    添加至列表
                </Button>
            </div>
            {renderHostList()}
        </div>
    );

    // Render result preview
    const renderResultPreview = () => (
        <>
            <List
                size="small"
                dataSource={getSelectedHostsList()}
                renderItem={(item: any) => (
                    <List.Item
                        className='result-item'
                        onMouseEnter={() => setHoveredHostId(item.id)}
                        onMouseLeave={() => setHoveredHostId(null)}
                    >
                        <div className='item-content'>
                            <span>{item.ip}</span>
                            {hoveredHostId === item.id && (
                                <CloseOutlined
                                    className='remove-icon'
                                    onClick={() => handleRemoveHost(item.id)}
                                />
                            )}
                        </div>
                    </List.Item>
                )}
                locale={{ emptyText: '暂无选中主机' }}
            />
        </>
    )

    const inputTabItems: TabsProps['items'] = [
        {
            key: TabItemKey.StaticTopo,
            label: '静态拓扑',
            children: renderStaticTopology(),
        },
        {
            key: TabItemKey.CustomInput,
            label: '自定义输入',
            children: renderCustomInput(),
        }
    ]

    const menuItems: MenuProps['items'] = [
        {
            key: MenuItemKey.CopyIP,
            label: '复制IP',
            disabled: selectedHosts.length === 0
        },
        {
            key: MenuItemKey.RemoveAll,
            label: '移除所有',
            disabled: selectedHosts.length === 0
        }
    ]

    const collapseItems: CollapseProps['items'] = [
        {
            key: 'result',
            label: <span>已选择 <span className="selected-count">{selectedHosts.length}</span> 台主机</span>,
            children: renderResultPreview(),
            extra: <Dropdown menu={{
                items: menuItems,
                onClick: ({ key, domEvent }) => handleMenuClick(key as MenuItemKey, domEvent)
            }}
                placement='bottomRight'
                trigger={['click']}
            >
                <div className='more-operation' onClick={(e) => e.stopPropagation()}>
                    <MoreOutlined />
                </div>
            </Dropdown>
        }
    ]

    const resultTabItems: TabsProps['items'] = [
        {
            key: 'result',
            label: '结果预览',
            children: <Collapse
                ghost
                defaultActiveKey={['result']}
                items={collapseItems}
            />,
        }
    ]

    return (
        <Modal
            title="新增主机到模块"
            open={visible}
            onCancel={handleCancel}
            width={1200}
            footer={[
                <Button key="cancel" onClick={handleCancel}>
                    取消
                </Button>,
                <Button key="confirm" type="primary" onClick={handleConfirm}>
                    下一步
                </Button>
            ]}
            className='add-modal'
        >
            <div className='modal-content'>
                {/* Left side - Tabs for mode selection */}
                <div className='left-content'>
                    <Tabs items={inputTabItems} activeKey={activeTab} onChange={setActiveTab} />
                </div>

                {/* Right side - Results and table */}
                <div className='right-content'>
                    <Tabs items={resultTabItems} />
                </div>
            </div>
        </Modal>
    );
};

export default AddHostModal;
