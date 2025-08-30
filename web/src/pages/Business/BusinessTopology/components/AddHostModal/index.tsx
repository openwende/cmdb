import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Modal, Tabs, Table, Button, Input, Collapse, List, message, TabsProps, CollapseProps, Dropdown, MenuProps } from 'antd';
import { CloseOutlined, MoreOutlined } from '@ant-design/icons';
import { allHosts2, businessData2, idleCluster2 } from '@/mock/business';
import Pagination from '@/components/common/Pagination';
import EmptySearchResult from '@/components/common/EmptySearchResult';
import DragHandle from '@/components/common/DragHandle';
import TopologyTree from '../TopologyTree';
import { buildTreeData, filterTree } from '@/pages/Business/utils';
import { TransferHostItem, TailEleType, TransferHostType, RemoveMenuItemKey } from '@/pages/Business/Types';
import './style.css';

const MIN_WIDTH = 280;
const MAX_WIDTH = 420;
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
const createNewHost = (ip: string, index: number) => {
    return {
        bk_host_id: Date.now() + index,
        bk_host_innerip: ip,
        bk_host_innerip_v6: '',
        bk_cloud_id: [{
            id: "90000001",
            bk_obj_id: "plat",
            bk_obj_icon: "",
            bk_inst_id: 90000001,
            bk_obj_name: "",
            bk_inst_name: "未分配"
        }]
    };
};

interface Props {
    visible: boolean;
    initialSelectedHosts?: TransferHostItem[];
    transferHostType?: TransferHostType;
    onClose: () => void;
    onConfirm: (hosts: TransferHostItem[]) => void;
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

const AddHostModal: React.FC<Props> = ({ visible, onClose, onConfirm, initialSelectedHosts, transferHostType }) => {
    const [activeTab, setActiveTab] = useState<string>(TabItemKey.StaticTopo);
    const [selectedHosts, setSelectedHosts] = useState<React.Key[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [sidebarWidth, setSidebarWidth] = useState<number>(320);
    // Custom input states
    const [customInput, setCustomInput] = useState<string>('');
    const [customHosts, setCustomHosts] = useState<HostData[]>([]);
    const [inputError, setInputError] = useState<boolean>(false);
    // Search related states
    const [treeSearchValue, setTreeSearchValue] = useState<string>('');
    const [hostSearchValue, setHostSearchValue] = useState<string>('');
    const [expandedKeys, setExpandedKeys] = useState<string[]>();
    // Result preview list items - independent of tab switching
    const [resultPreviewItems, setResultPreviewItems] = useState<TransferHostItem[]>([]);
    const [hoveredHostId, setHoveredHostId] = useState<React.Key | null>(null);
    const [allHostsMapping, setAllHostsMapping] = useState<Map<React.Key, TransferHostItem>>(new Map());
    // Ref for tree wrapper to control popover container
    const [treeKey, setTreeKey] = useState(0);
    // Track the previous visibility state of the modal
    const prevVisibleRef = useRef<boolean>();
    const [shouldInitializeKeys, setShouldInitializeKeys] = useState(true);

    const fullTreeData = useMemo(() => {
        // Build complete tree data
        return buildTreeData(businessData2, idleCluster2);
    }, []);

    const filteredTreeData = useMemo(() => {
        // Filter tree data based on search value
        if (!treeSearchValue) {
            return fullTreeData;
        }
        return filterTree(fullTreeData, treeSearchValue);
    }, [fullTreeData, treeSearchValue]);

    useEffect(() => {
        if (visible) setTreeKey(Date.now());
    }, [visible]);

    useEffect(() => {
        const prevVisible = prevVisibleRef.current;
        if (visible && !prevVisible) {
            if (!filteredTreeData || filteredTreeData.length === 0) return;
            setShouldInitializeKeys(true);
            setExpandedKeys([filteredTreeData[0].key]);
        } else {
            setShouldInitializeKeys(false);
        }
        // Update previous visible status after initialization
        prevVisibleRef.current = visible;
    }, [visible, filteredTreeData]);

    useEffect(() => {
        if (visible && initialSelectedHosts && initialSelectedHosts.length > 0) {
            const hostMapping = new Map(initialSelectedHosts.map(host => [
                host.id,
                { id: host.id, ip: host.ip }
            ]));

            setAllHostsMapping(hostMapping);
            setResultPreviewItems(initialSelectedHosts.map(host => ({
                id: host.id,
                ip: host.ip
            })));
            setSelectedHosts(initialSelectedHosts.map(host => host.id));
        }
    }, [visible, initialSelectedHosts]);

    const handleHostSelectionChange = (newSelectedKeys: React.Key[]) => {
        setSelectedHosts(newSelectedKeys);

        // Get current hosts and update mapping
        const currentHosts = getCurrentHosts();
        const newMapping = new Map(allHostsMapping);

        // Add current hosts to mapping
        currentHosts.forEach(host => {
            if (!newMapping.has(host.key)) {
                newMapping.set(host.key, {
                    id: host.key,
                    ip: host.bk_host_innerip
                });
            }
        });

        setAllHostsMapping(newMapping);

        // Update result preview using mapping
        const newResultItems = newSelectedKeys.map(hostId => {
            return newMapping.get(hostId);
        }).filter(Boolean) as Array<{ id: React.Key, ip: string }>;

        setResultPreviewItems(newResultItems);
    };

    const getCurrentHosts = () => {
        let hosts: any[] = [];

        if (activeTab === TabItemKey.StaticTopo) {
            hosts = allHosts2.map(item => ({
                ...item.host,
                key: item.host.bk_host_id
            }));
        } else {
            hosts = customHosts.map(host => ({
                ...host,
                key: host.bk_host_id
            }));
        }

        // Apply search filter
        if (hostSearchValue && hostSearchValue.trim()) {
            const searchTerm = hostSearchValue.trim().toLowerCase();
            hosts = hosts.filter(host =>
                host.bk_host_innerip?.toLowerCase().includes(searchTerm) ||
                host.bk_host_innerip_v6?.toLowerCase().includes(searchTerm)
            );
        }

        return hosts;
    };

    const handleAddCustomHosts = () => {
        if (!customInput.trim()) {
            message.warning('请输入IP');
            return;
        }

        // TODO: check ip is valid or not
        // if (!customInput.isValid) {
        //     setInputError(true);
        // }

        const ips = customInput.split('\n').filter(ip => ip.trim());
        const newHosts: HostData[] = [];
        const existingIps = new Set(customHosts.map(h => h.bk_host_innerip));

        ips.forEach((ip, index) => {
            const trimmedIp = ip.trim();
            if (trimmedIp && !existingIps.has(trimmedIp)) {
                // TODO: the default field name is what?
                newHosts.push(createNewHost(trimmedIp, index));
            }
        });

        if (newHosts.length > 0) {
            const updatedHosts = [...customHosts, ...newHosts];
            setCustomHosts(updatedHosts);
            setCustomInput('');
            message.success(`成功添加 ${newHosts.length} 台主机`);
        } else {
            message.warning('没有新的主机可添加');
        }
    };

    const handleRemoveHost = (hostId: React.Key) => {
        setSelectedHosts(prev => prev.filter(id => id !== hostId));
        // Also remove from result preview items
        setResultPreviewItems(prev => prev.filter(item => item.id !== hostId));
    };

    const handleCopyIPs = async () => {
        const currentHosts = getCurrentHosts();
        const selectedIPs = resultPreviewItems.map(resItem => {
            const host = currentHosts.find(h => h.key === resItem.id);
            return host?.bk_host_innerip;
        }).filter(Boolean).join('\n');

        try {
            await navigator.clipboard.writeText(selectedIPs);
            message.success('复制成功');
        } catch (error) {
            message.error('复制失败');
        }
    };

    const handleRemoveAll = () => {
        setSelectedHosts([]);
        setResultPreviewItems([]);
    };

    const handleNodeSelect = () => {
       // do nothing
    };

    const handleNextStep = () => {
        let output = resultPreviewItems;
        if (transferHostType === RemoveMenuItemKey.CurrentModule) {
            output = resultPreviewItems.map(item => {
                const hostInfo = allHosts2.find(h => h.host.bk_host_id === item.id);
                const cloud = hostInfo?.host.bk_cloud_id?.[0];
                const region = cloud ? `${cloud.bk_inst_name}[${cloud.bk_inst_id}]` : '';
                return { ...item, cloudInfo: region } as TransferHostItem;
            });
        }
        onConfirm(output);
        handleCancel();
    };

    const handleCancel = () => {
        setActiveTab(TabItemKey.StaticTopo);
        setSelectedHosts([]);
        setCustomInput('');
        setCustomHosts([]);
        setHoveredHostId(null);
        setTreeSearchValue('');
        setHostSearchValue('');
        setResultPreviewItems([]);
        setAllHostsMapping(new Map());
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
        const hosts = getCurrentHosts();
        const total = hosts.length;
        const isEmptySearchResult = hostSearchValue && hosts.length === 0;

        return (
            <div className='table-wrapper'>
                <Input.Search
                    placeholder="请输入"
                    className='search-input'
                    allowClear
                    value={hostSearchValue}
                    onChange={(e) => setHostSearchValue(e.target.value.trim())}
                    onClear={() => setHostSearchValue('')}
                />
                {isEmptySearchResult ? (
                    <EmptySearchResult onClearFilter={() => setHostSearchValue('')} />
                ) : (
                    <>
                        <Table
                            rowSelection={{
                                selectedRowKeys: selectedHosts,
                                onChange: handleHostSelectionChange,
                            }}
                            columns={columns}
                            dataSource={hosts}
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
                    </>
                )}
            </div>
        )
    }

    const renderStaticTopology = () => {
        const isEmptySearchResult = treeSearchValue && filteredTreeData.length === 0;

        return (
            <div className='topology-wrapper'>
                <div className='tree-wrapper'
                    style={{
                        width: sidebarWidth,
                        minWidth: MIN_WIDTH,
                        maxWidth: MAX_WIDTH,
                    }}
                >
                    <Input.Search
                        placeholder="搜索拓扑节点"
                        className='search-input'
                        allowClear
                        value={treeSearchValue}
                        onChange={e => setTreeSearchValue(e.target.value.trim())}
                        onClear={() => setTreeSearchValue('')}
                    />
                    {isEmptySearchResult ? (
                        <EmptySearchResult onClearFilter={() => setTreeSearchValue('')} />
                    ) : (
                        <TopologyTree
                            key={treeKey}
                            treeData={filteredTreeData}
                            onlyLeafSelectable={true}
                            expandedKeys={shouldInitializeKeys ? expandedKeys : undefined}
                            tailEleType={TailEleType.Count}
                            searchValue={treeSearchValue}
                            onNodeSelect={handleNodeSelect}
                        />
                    )}
                    {/* The dragger */}
                    <DragHandle
                        minWidth={MIN_WIDTH}
                        maxWidth={MAX_WIDTH}
                        currentWidth={sidebarWidth}
                        onWidthChange={setSidebarWidth}
                    />
                </div>
                {renderHostList()}
            </div>
        )
    }

    const renderCustomInput = () => (
        <div className='custom-input-wrapper'>
            <div className='input-area'>
                <>
                    <Input.TextArea
                        value={customInput}
                        onChange={(e) => {
                            setCustomInput(e.target.value);
                            setInputError(false);
                        }}
                        placeholder="请输入IP，换行分隔"
                        className='text-area'
                    />
                    {
                        inputError && <div className='error-text'>
                            IP不正确或主机不存在
                        </div>
                    }
                </>
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

    const renderResultPreview = () => (
        <>
            <List
                size="small"
                dataSource={resultPreviewItems}
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
                locale={{ emptyText: '暂无主机选中' }}
            />
        </>
    );

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
            disabled: resultPreviewItems.length === 0
        },
        {
            key: MenuItemKey.RemoveAll,
            label: '移除所有',
            disabled: resultPreviewItems.length === 0
        }
    ]

    const collapseItems: CollapseProps['items'] = [
        {
            key: 'result',
            label: <span>已选择 <span className="selected-count">{resultPreviewItems.length}</span> 台主机</span>,
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
        <>
            <Modal
                title={initialSelectedHosts ? '选择主机' : '新增主机到模块'}
                open={visible}
                onCancel={handleCancel}
                width={1200}
                footer={[
                    <Button key="cancel" onClick={handleCancel}>
                        取消
                    </Button>,
                    <Button key="confirm" type="primary" disabled={!resultPreviewItems.length} onClick={handleNextStep}>
                        {initialSelectedHosts ? '确定' : '下一步'}
                    </Button>
                ]}
                maskClosable={false}
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
        </>
    );
};

export default AddHostModal;