import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Modal,
  Tabs,
  Table,
  Button,
  Input,
  Collapse,
  List,
  message,
  TabsProps,
  CollapseProps,
  Dropdown,
  MenuProps,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { CloseOutlined, MoreOutlined } from '@ant-design/icons';
import Pagination from '@/components/common/Pagination';
import EmptySearchResult from '@/components/common/EmptySearchResult';
import TableEmpty from '@/components/common/TableEmpty';
import DragHandle from '@/components/common/DragHandle';
import TopologyTree from '../TopologyTree';
import { filterTree, collectAllKeys } from '@/pages/Business/utils';
import {
  TransferHostItem,
  TailEleType,
  TransferHostType,
  TreeData,
  RemoveMenuItemKey,
  TopoTreeNodeType,
} from '@/pages/Business/Types';
import {
  getHostList,
  getTopologyNodeHosts,
  getTopologyTree,
  TopologyNodeHostItem,
} from '@/api/services/business';
import { adaptTopologyTree } from '@/api/adapters/topologyAdapter';
import { getBusinessIdFromUrl } from '@/utils/routes';
import './style.css';

const MIN_WIDTH = 280;
const MAX_WIDTH = 420;

interface Props {
  visible: boolean;
  initialSelectedHosts?: TransferHostItem[];
  transferHostType?: TransferHostType;
  onClose: () => void;
  onConfirm: (hosts: TransferHostItem[]) => void;
}
interface HostData {
  bk_host_id: React.Key;
  bk_host_innerip: string;
  bk_host_innerip_v6?: string;
  bk_cloud_id: any[];
}
enum MenuItemKey {
  CopyIP = 'copyIP',
  RemoveAll = 'removeAll',
}
enum TabItemKey {
  StaticTopo = 'staticTopo',
  CustomInput = 'customInput',
}

const AddHostModal: React.FC<Props> = ({
  visible,
  onClose,
  onConfirm,
  initialSelectedHosts,
  transferHostType,
}) => {
  const { t } = useTranslation();

  const columns = [
    {
      title: t('business.topology.addHostModal.columns.innerIP'),
      dataIndex: 'bk_host_innerip',
      key: 'bk_host_innerip',
    },
    {
      title: t('business.topology.addHostModal.columns.innerIPv6'),
      dataIndex: 'bk_host_innerip_v6',
      key: 'bk_host_innerip_v6',
      render: (text: string) => text || '--',
    },
    {
      title: t('business.topology.addHostModal.columns.cloudArea'),
      dataIndex: 'bk_cloud_id',
      key: 'bk_cloud_id',
      render: (cloudInfo: any[]) => {
        return cloudInfo.length > 0
          ? `${cloudInfo[0].bk_inst_name}[${cloudInfo[0].bk_inst_id}]`
          : '--';
      },
    },
  ];

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
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  // Result preview list items - independent of tab switching
  const [resultPreviewItems, setResultPreviewItems] = useState<TransferHostItem[]>([]);
  const [hoveredHostId, setHoveredHostId] = useState<React.Key | null>(null);
  const [allHostsMapping, setAllHostsMapping] = useState<Map<React.Key, TransferHostItem>>(
    new Map(),
  );
  const [fullTreeData, setFullTreeData] = useState<TreeData[]>([]);
  const [lookupHosts, setLookupHosts] = useState<HostData[]>([]);
  const [selectedModuleNode, setSelectedModuleNode] = useState<TreeData | null>(null);
  const [moduleHosts, setModuleHosts] = useState<HostData[]>([]);
  const [moduleHostsTotal, setModuleHostsTotal] = useState(0);
  const [moduleHostsLoading, setModuleHostsLoading] = useState(false);
  // Ref for tree wrapper to control popover container
  const [treeKey, setTreeKey] = useState(0);
  const [shouldInitializeKeys, setShouldInitializeKeys] = useState(true);
  const moduleHostRequestSeqRef = useRef(0);

  const adaptTopologyHost = useCallback((item: TopologyNodeHostItem): HostData => {
    return {
      bk_host_id: item.host_id,
      bk_host_innerip: item.inner_ipv4 || '',
      bk_host_innerip_v6: item.inner_ipv6 || '',
      bk_cloud_id: item.cloud_area
        ? [
            {
              bk_inst_id: item.cloud_area.id,
              bk_inst_name: item.cloud_area.name,
            },
          ]
        : [],
    };
  }, []);

  const loadTopologyAndHosts = useCallback(async () => {
    const businessId = getBusinessIdFromUrl();
    if (!businessId) {
      setFullTreeData([]);
      setLookupHosts([]);
      setModuleHosts([]);
      setModuleHostsTotal(0);
      return;
    }

    const [treeResponse, hostResponse] = await Promise.all([
      getTopologyTree({
        business_id: businessId,
        include_hosts: false,
        max_depth: 10,
      }),
      getHostList({
        params: {
          page: 1,
          page_size: 100,
        },
      }),
    ]);

    if (treeResponse.code === 0 && treeResponse.data) {
      setFullTreeData(adaptTopologyTree(treeResponse.data));
    } else {
      setFullTreeData([]);
    }

    const hosts = (((hostResponse as any)?.hosts || []) as any[]).map((item) => ({
      bk_host_id: item.id,
      bk_host_innerip: item.primary_ip || '',
      bk_host_innerip_v6: '',
      bk_cloud_id: item.cloud_area_id
        ? [
            {
              bk_inst_id: item.cloud_area_id,
              bk_inst_name: item.cloud_area_id,
            },
          ]
        : [],
    }));
    setLookupHosts(hosts);
  }, []);

  const loadSelectedModuleHosts = useCallback(async () => {
    const requestSeq = moduleHostRequestSeqRef.current + 1;
    moduleHostRequestSeqRef.current = requestSeq;

    if (
      !visible ||
      activeTab !== TabItemKey.StaticTopo ||
      !selectedModuleNode ||
      selectedModuleNode.type !== TopoTreeNodeType.Module ||
      selectedModuleNode.extra?.isSyntheticIdleModule
    ) {
      setModuleHosts([]);
      setModuleHostsTotal(0);
      setModuleHostsLoading(false);
      return;
    }

    setModuleHostsLoading(true);
    try {
      const response = await getTopologyNodeHosts(selectedModuleNode.key, {
        page,
        page_size: pageSize,
        keyword: hostSearchValue.trim() || undefined,
      });

      if (requestSeq !== moduleHostRequestSeqRef.current) {
        return;
      }

      const items = response?.data?.items || [];
      const pagination = response?.data?.pagination;

      setModuleHosts(items.map(adaptTopologyHost));
      setModuleHostsTotal(pagination?.total ?? items.length);
    } catch (error) {
      if (requestSeq !== moduleHostRequestSeqRef.current) {
        return;
      }
      console.error('Failed to fetch selected module hosts:', error);
      setModuleHosts([]);
      setModuleHostsTotal(0);
      message.error(t('resource.host.messages.loadFailed'));
    } finally {
      if (requestSeq === moduleHostRequestSeqRef.current) {
        setModuleHostsLoading(false);
      }
    }
  }, [
    activeTab,
    adaptTopologyHost,
    hostSearchValue,
    message,
    page,
    pageSize,
    selectedModuleNode,
    t,
    visible,
  ]);

  const filteredTreeData = useMemo(() => {
    // Filter tree data based on search value
    if (!treeSearchValue) {
      return fullTreeData;
    }
    return filterTree(fullTreeData, treeSearchValue);
  }, [fullTreeData, treeSearchValue]);

  // Generate expanded keys based on search results
  const expandedKeysForSearch = useMemo(() => {
    if (!treeSearchValue || filteredTreeData.length === 0) {
      return [];
    }

    return collectAllKeys(filteredTreeData);
  }, [treeSearchValue, filteredTreeData]);

  useEffect(() => {
    if (visible) setTreeKey(Date.now());
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    void loadTopologyAndHosts();
  }, [loadTopologyAndHosts, visible]);

  useEffect(() => {
    void loadSelectedModuleHosts();
  }, [loadSelectedModuleHosts]);

  useEffect(() => {
    if (visible) {
      if (filteredTreeData.length === 0) return;
      setShouldInitializeKeys(true);
      // Expand if there are search results
      if (expandedKeysForSearch.length > 0) {
        setExpandedKeys(expandedKeysForSearch);
      } else if (expandedKeys.length === 0) {
        setExpandedKeys([filteredTreeData[0].key]);
      }
    } else {
      setShouldInitializeKeys(false);
    }
  }, [visible, filteredTreeData, expandedKeysForSearch, treeSearchValue]);

  useEffect(() => {
    if (visible && initialSelectedHosts && initialSelectedHosts.length > 0) {
      const hostMapping = new Map(
        initialSelectedHosts.map((host) => [host.id, { id: host.id, ip: host.ip }]),
      );

      setAllHostsMapping(hostMapping);
      setResultPreviewItems(
        initialSelectedHosts.map((host) => ({
          id: host.id,
          ip: host.ip,
        })),
      );
      setSelectedHosts(initialSelectedHosts.map((host) => host.id));
    }
  }, [visible, initialSelectedHosts]);

  const handleHostSelectionChange = (newSelectedKeys: React.Key[]) => {
    setSelectedHosts(newSelectedKeys);

    // Get current hosts and update mapping
    const currentHosts = getCurrentHosts();
    const newMapping = new Map(allHostsMapping);

    // Add current hosts to mapping
    currentHosts.forEach((host) => {
      if (!newMapping.has(host.key)) {
        newMapping.set(host.key, {
          id: host.key,
          ip: host.bk_host_innerip,
        });
      }
    });

    setAllHostsMapping(newMapping);

    // Update result preview using mapping
    const newResultItems = newSelectedKeys
      .map((hostId) => {
        return newMapping.get(hostId);
      })
      .filter(Boolean) as Array<{ id: React.Key; ip: string }>;

    setResultPreviewItems(newResultItems);
  };

  const getCurrentHosts = () => {
    let hosts: any[] = [];

    if (activeTab === TabItemKey.StaticTopo) {
      hosts = moduleHosts.map((item) => ({
        ...item,
        key: item.bk_host_id,
      }));
    } else {
      hosts = customHosts.map((host) => ({
        ...host,
        key: host.bk_host_id,
      }));
    }

    // Apply search filter
    if (activeTab === TabItemKey.CustomInput && hostSearchValue && hostSearchValue.trim()) {
      const searchTerm = hostSearchValue.trim().toLowerCase();
      hosts = hosts.filter(
        (host) =>
          host.bk_host_innerip?.toLowerCase().includes(searchTerm) ||
          host.bk_host_innerip_v6?.toLowerCase().includes(searchTerm),
      );
    }

    return hosts;
  };

  const handleAddCustomHosts = () => {
    if (!customInput.trim()) {
      message.warning(t('business.topology.addHostModal.messages.pleaseInputIP'));
      return;
    }

    // TODO: check ip is valid or not
    // if (!customInput.isValid) {
    //     setInputError(true);
    // }

    const ips = customInput.split('\n').filter((ip) => ip.trim());
    const newHosts: HostData[] = [];
    const existingIps = new Set(customHosts.map((h) => h.bk_host_innerip));

    ips.forEach((ip) => {
      const trimmedIp = ip.trim();
      const matchedHost = lookupHosts.find(
        (host) =>
          host.bk_host_innerip === trimmedIp || host.bk_host_innerip_v6 === trimmedIp,
      );
      if (trimmedIp && matchedHost && !existingIps.has(trimmedIp)) {
        newHosts.push(matchedHost);
      }
    });

    if (newHosts.length > 0) {
      const updatedHosts = [...customHosts, ...newHosts];
      setCustomHosts(updatedHosts);
      setCustomInput('');
      message.success(
        t('business.topology.addHostModal.messages.addSuccess', { count: newHosts.length }),
      );
    } else {
      message.warning(t('business.topology.addHostModal.messages.noNewHosts'));
    }
  };

  const handleRemoveHost = (hostId: React.Key) => {
    setSelectedHosts((prev) => prev.filter((id) => id !== hostId));
    // Also remove from result preview items
    setResultPreviewItems((prev) => prev.filter((item) => item.id !== hostId));
  };

  const handleCopyIPs = async () => {
    const selectedIPs = resultPreviewItems
      .map((resItem) => resItem.ip)
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(selectedIPs);
      message.success(t('business.topology.addHostModal.messages.copySuccess'));
    } catch {
      message.error(t('business.topology.addHostModal.messages.copyFailed'));
    }
  };

  const handleRemoveAll = () => {
    setSelectedHosts([]);
    setResultPreviewItems([]);
  };

  const handleNodeSelect = (selectedNode: TreeData) => {
    setSelectedModuleNode(selectedNode);
    setModuleHosts([]);
    setModuleHostsTotal(0);
    setHostSearchValue('');
    setPage(1);
  };

  const handleNextStep = () => {
    let output = resultPreviewItems;
    if (transferHostType === RemoveMenuItemKey.CurrentModule) {
      output = resultPreviewItems.map((item) => {
        const hostInfo = [...moduleHosts, ...customHosts, ...lookupHosts].find(
          (h) => h.bk_host_id === item.id,
        );
        const cloud = hostInfo?.bk_cloud_id?.[0];
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
    setSelectedModuleNode(null);
    setModuleHosts([]);
    setModuleHostsTotal(0);
    setModuleHostsLoading(false);
    setTreeSearchValue('');
    setHostSearchValue('');
    setResultPreviewItems([]);
    setAllHostsMapping(new Map());
    setExpandedKeys(filteredTreeData[0] ? [filteredTreeData[0].key] : []);
    onClose();
  };

  const handleMenuClick = (key: MenuItemKey, domEvent: React.MouseEvent | React.KeyboardEvent) => {
    domEvent.stopPropagation();
    if (key === MenuItemKey.CopyIP) {
      handleCopyIPs();
    } else if (key === MenuItemKey.RemoveAll) {
      handleRemoveAll();
    }
  };

  const renderHostList = () => {
    const hosts = getCurrentHosts();
    const total = activeTab === TabItemKey.StaticTopo ? moduleHostsTotal : hosts.length;
    const isStaticHostLoading = activeTab === TabItemKey.StaticTopo && moduleHostsLoading;

    return (
      <div className="table-wrapper">
        <Input.Search
          placeholder={t('business.topology.addHostModal.placeholders.pleaseInput')}
          className="search-input"
          allowClear
          value={hostSearchValue}
          onChange={(e) => {
            setHostSearchValue(e.target.value.trim());
            setPage(1);
          }}
          onClear={() => {
            setHostSearchValue('');
            setPage(1);
          }}
        />
        <Table
          rowSelection={{
            selectedRowKeys: selectedHosts,
            onChange: handleHostSelectionChange,
            preserveSelectedRowKeys: true,
          }}
          columns={columns}
          dataSource={hosts}
          rowKey={(item) => item.bk_host_id}
          pagination={false}
          size="small"
          loading={isStaticHostLoading}
          className="table-list"
          locale={{ emptyText: <TableEmpty /> }}
        />
        {total > 0 && (
          <Pagination
            total={total}
            pageSize={pageSize}
            current={page}
            onChange={setPage}
            onSizeChange={(_, size) => {
              setPage(1);
              setPageSize(size);
            }}
            size="small"
          />
        )}
      </div>
    );
  };

  const renderStaticTopology = () => {
    const isEmptySearchResult = treeSearchValue && filteredTreeData.length === 0;

    return (
      <div className="topology-wrapper">
        <div
          className="tree-wrapper"
          style={{
            width: sidebarWidth,
            minWidth: MIN_WIDTH,
            maxWidth: MAX_WIDTH,
          }}
        >
          <Input.Search
            placeholder={t('business.topology.addHostModal.placeholders.searchTopologyNode')}
            className="search-input"
            allowClear
            value={treeSearchValue}
            onChange={(e) => setTreeSearchValue(e.target.value.trim())}
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
    );
  };

  const renderCustomInput = () => (
    <div className="custom-input-wrapper">
      <div className="input-area">
        <>
          <Input.TextArea
            value={customInput}
            onChange={(e) => {
              setCustomInput(e.target.value);
              setInputError(false);
            }}
            placeholder={t('business.topology.addHostModal.placeholders.inputIPNewline')}
            className="text-area"
          />
          {inputError && (
            <div className="error-text">
              {t('business.topology.addHostModal.messages.ipIncorrectOrNotExists')}
            </div>
          )}
        </>
        <Button onClick={handleAddCustomHosts} color="primary" variant="outlined">
          {t('business.topology.addHostModal.buttons.addToList')}
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
            className="result-item"
            onMouseEnter={() => setHoveredHostId(item.id)}
            onMouseLeave={() => setHoveredHostId(null)}
          >
            <div className="item-content">
              <span>{item.ip}</span>
              {hoveredHostId === item.id && (
                <CloseOutlined className="remove-icon" onClick={() => handleRemoveHost(item.id)} />
              )}
            </div>
          </List.Item>
        )}
        locale={{ emptyText: t('business.topology.addHostModal.messages.noHostSelected') }}
      />
    </>
  );

  const inputTabItems: TabsProps['items'] = [
    {
      key: TabItemKey.StaticTopo,
      label: t('business.topology.addHostModal.tabs.staticTopology'),
      children: renderStaticTopology(),
    },
    {
      key: TabItemKey.CustomInput,
      label: t('business.topology.addHostModal.tabs.customInput'),
      children: renderCustomInput(),
    },
  ];

  const menuItems: MenuProps['items'] = [
    {
      key: MenuItemKey.CopyIP,
      label: t('business.topology.addHostModal.menu.copyIP'),
      disabled: resultPreviewItems.length === 0,
    },
    {
      key: MenuItemKey.RemoveAll,
      label: t('business.topology.addHostModal.menu.removeAll'),
      disabled: resultPreviewItems.length === 0,
    },
  ];

  const collapseItems: CollapseProps['items'] = [
    {
      key: 'result',
      label: (
        <span>
          {t('business.topology.addHostModal.labels.selectedCount', {
            count: resultPreviewItems.length,
          })}
        </span>
      ),
      children: renderResultPreview(),
      extra: (
        <Dropdown
          menu={{
            items: menuItems,
            onClick: ({ key, domEvent }) => handleMenuClick(key as MenuItemKey, domEvent),
          }}
          placement="bottomRight"
          trigger={['click']}
        >
          <div className="more-operation" onClick={(e) => e.stopPropagation()}>
            <MoreOutlined />
          </div>
        </Dropdown>
      ),
    },
  ];

  const resultTabItems: TabsProps['items'] = [
    {
      key: 'result',
      label: t('business.topology.addHostModal.tabs.resultPreview'),
      children: <Collapse ghost defaultActiveKey={['result']} items={collapseItems} />,
    },
  ];

  return (
    <>
      <Modal
        title={
          initialSelectedHosts
            ? t('business.topology.addHostModal.titles.selectHost')
            : t('business.topology.addHostModal.titles.addHostToModule')
        }
        open={visible}
        onCancel={handleCancel}
        width={1200}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            {t('business.topology.addHostModal.buttons.cancel')}
          </Button>,
          <Button
            key="confirm"
            type="primary"
            disabled={!resultPreviewItems.length}
            onClick={handleNextStep}
          >
            {initialSelectedHosts
              ? t('business.topology.addHostModal.buttons.confirm')
              : t('business.topology.addHostModal.buttons.nextStep')}
          </Button>,
        ]}
        maskClosable={false}
        className="add-modal"
      >
        <div className="modal-content">
          {/* Left side - Tabs for mode selection */}
          <div className="left-content">
            <Tabs items={inputTabItems} activeKey={activeTab} onChange={setActiveTab} />
          </div>

          {/* Right side - Results and table */}
          <div className="right-content">
            <Tabs items={resultTabItems} />
          </div>
        </div>
      </Modal>
    </>
  );
};

export default AddHostModal;
