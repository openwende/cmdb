import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Tabs, Table, Button, Input, Collapse, List, message, TabsProps, CollapseProps, Dropdown, MenuProps, Popover } from 'antd';
import { CloseOutlined, MoreOutlined } from '@ant-design/icons';
import TopologyTree from '../TopologyTree';
import { allHosts2 } from '@/mock/business';
import { TransferHostItem, TailEleType, TreeData } from '@/pages/Business/Types';
import Pagination from '@/components/common/Pagination';
import EmptySearchResult from '@/components/common/EmptySearchResult';
import './style.css';

const MIN_WIDTH = 280;
const MAX_WIDTH = 420;

interface Props {
    visible: boolean;
    initialSelectedHosts?: TransferHostItem[];
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

const AddHostModal: React.FC<Props> = ({ visible, onClose, onConfirm, initialSelectedHosts }) => {
    const [activeTab, setActiveTab] = useState<string>(TabItemKey.StaticTopo);
    const [selectedHosts, setSelectedHosts] = useState<React.Key[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    // The sidebar state
    const [sidebarWidth, setSidebarWidth] = useState<number>(320);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isDraggerHover, setDraggerHover] = useState<boolean>(false);
    const dragging = useRef<boolean>(false);
    // Custom input states
    const [customInput, setCustomInput] = useState<string>('');
    const [customHosts, setCustomHosts] = useState<HostData[]>([]);
    const [inputError, setInputError] = useState<boolean>(false);
    // Search related states
    const [treeSearchValue, setTreeSearchValue] = useState<string>('');
    const [hostSearchValue, setHostSearchValue] = useState<string>('');
    const [hasTreeSearchResults, setHasTreeSearchResults] = useState<boolean>(true);
    const [showSearchPopover, setShowSearchPopover] = useState<boolean>(false);
    const [searchTreeData, setSearchTreeData] = useState<TreeData[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>();
    // Result preview list items - independent of tab switching
    const [resultPreviewItems, setResultPreviewItems] = useState<TransferHostItem[]>([]);
    const [hoveredHostId, setHoveredHostId] = useState<React.Key | null>(null);
    const [allHostsMapping, setAllHostsMapping] = useState<Map<React.Key, TransferHostItem>>(new Map());
    // Ref for tree wrapper to control popover container
    const treeWrapperRef = useRef<HTMLDivElement>(null);
    const [treeKey, setTreeKey] = useState(0);
    // Track the previous visibility state of the modal
    const prevVisibleRef = useRef<boolean>();
    const [shouldInitializeKeys, setShouldInitializeKeys] = useState(true);

    useEffect(() => {
        if (visible) setTreeKey(Date.now());
    }, [visible]);

    useEffect(() => {
        const prevVisible = prevVisibleRef.current;
        if (visible && !prevVisible) {
            if (!searchTreeData || searchTreeData.length === 0) return;
            setShouldInitializeKeys(true);
            setExpandedKeys([searchTreeData[0].key]);
        } else {
            setShouldInitializeKeys(false);
        }
        // Update previous visible status after initialization
        prevVisibleRef.current = visible;
    }, [visible, searchTreeData]);

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
        // Also clear result preview items
        setResultPreviewItems([]);
    };

    // Clear tree search
    // const handleClearTreeSearch = () => {
    //     setTreeSearchValue('');
    //     setShowSearchPopover(false);
    // };

    const handleClearHostSearch = () => {
        setHostSearchValue('');
    };

    const handleNodeSelect = () => {
        // Dismiss search panel by clearing search when item is clicked
        if (treeSearchValue) {
            setTreeSearchValue('');
            setShowSearchPopover(false);
        }
    };

    // Handle search popover result item click
    // const handleSearchResultClick = (key: string) => {
    //     setSelectedTreeKey(key);
    //     setTreeSearchValue('');
    //     setShowSearchPopover(false);
    // };

    const handleTreeSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setTreeSearchValue(value);
        setShowSearchPopover(!!value.trim());
    };

    const handleSearchDataChange = useCallback((data: any[]) => {
        setSearchTreeData(data);
        setHasTreeSearchResults(data.length > 0);
        const isSearching = !!(treeSearchValue && treeSearchValue.trim());
        setShowSearchPopover(isSearching && data.length > 0);
    }, [treeSearchValue])

    const handleNextStep = () => {
        onConfirm(resultPreviewItems);
        handleCancel();
    };

    const handleCancel = () => {
        // Reset all states to initial values
        setActiveTab(TabItemKey.StaticTopo);
        setSelectedHosts([]);
        setCustomInput('');
        setCustomHosts([]);
        setHoveredHostId(null);
        setTreeSearchValue('');
        setHostSearchValue('');
        setHasTreeSearchResults(true);
        setShowSearchPopover(false);
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

    const onMouseDown = (e: React.MouseEvent) => {
        dragging.current = true;
        setIsDragging(true);
        const startX = e.clientX;
        const startWidth = sidebarWidth;

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!dragging.current) return;
            const delta = moveEvent.clientX - startX;
            let newWidth = startWidth + delta;
            if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
            if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
            setSidebarWidth(newWidth);
        };

        const onMouseUp = () => {
            dragging.current = false;
            setIsDragging(false);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    const renderSearchPopoverContent = () => {
        // TODO: how to show
        return null;
        // if (!hasTreeSearchResults) {
        //     return <EmptySearchResult onClearFilter={handleClearTreeSearch} />;
        // }

        // return (
        //     <div className="search-popover-content">
        //         <Tree
        //             treeData={searchTreeData}
        //             blockNode={true}
        //             onSelect={(keys) => {
        //                 if (keys.length > 0) {
        //                     handleSearchResultClick(keys[0] as string);
        //                 }
        //             }}
        //             className="topology-tree"
        //         />
        //     </div>
        // );
    };

    const renderHostList = () => {
        const hosts = getCurrentHosts();
        const total = hosts.length;
        const hasHostSearchResults = hostSearchValue ? hosts.length > 0 : true;

        return (
            <div className='table-wrapper'>
                <Input.Search
                    placeholder="请输入"
                    className='search-input'
                    value={hostSearchValue}
                    onChange={(e) => setHostSearchValue(e.target.value)}
                    allowClear
                />
                {!hasHostSearchResults ? (
                    <EmptySearchResult onClearFilter={handleClearHostSearch} />
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

    const renderStaticTopology = () => (
        <div className='topology-wrapper'>
            <div className='tree-wrapper'
                style={{
                    width: sidebarWidth,
                    minWidth: MIN_WIDTH,
                    maxWidth: MAX_WIDTH,
                }}
                ref={treeWrapperRef}
            >
                <Popover
                    content={renderSearchPopoverContent()}
                    title="搜索结果"
                    trigger={[]}
                    open={showSearchPopover}
                    onOpenChange={setShowSearchPopover}
                    placement="bottomLeft"
                    overlayClassName="tree-search-popover"
                    getPopupContainer={() => treeWrapperRef.current || document.body}
                >
                    <Input.Search
                        placeholder="搜索拓扑节点"
                        className='search-input'
                        value={treeSearchValue}
                        onChange={handleTreeSearchChange}
                        allowClear
                        onClear={() => {
                            setTreeSearchValue('');
                            setShowSearchPopover(false);
                        }}
                    />
                </Popover>
                <TopologyTree
                    key={treeKey}
                    onlyLeafSelectable={true}
                    expandedKeys={shouldInitializeKeys ? expandedKeys : undefined}
                    tailEleType={TailEleType.Count}
                    searchValue={treeSearchValue}
                    onSelectNode={handleNodeSelect}
                    onSearchDataChange={handleSearchDataChange}
                />
                {/* The dragger */}
                <div
                    style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        width: 2,
                        height: "100%",
                        cursor: "col-resize",
                        zIndex: 10,
                        background: isDragging || isDraggerHover ? "#1890ff" : "transparent",
                        borderRadius: 3,
                        transition: "background 0.2s"
                    }}
                    onMouseDown={onMouseDown}
                    onMouseEnter={() => setDraggerHover(true)}
                    onMouseLeave={() => setDraggerHover(false)}
                />
            </div>
            {renderHostList()}
        </div>
    );

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