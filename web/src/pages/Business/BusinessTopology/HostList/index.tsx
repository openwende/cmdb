import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Table, Button, Dropdown, Input, message, Tooltip, Empty, Typography } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import Pagination from '@/components/common/Pagination';
import {
  getTopologyNodeHosts,
  TopologyNodeHostItem,
  transferTopologyHosts,
  transferTopologyHostsToPool,
} from '@/api/services/business';
import {
  TransferHostItem,
  AppendMenuItemKey,
  DropdownMenuType,
  MoreMenuItemKey,
  RemoveMenuItemKey,
  TopoTreeNodeType,
  TransferMenuItemType,
  TransferHostType,
  TreeData,
  CopyMenuItemKey as HostCopyKey,
} from '../../Types';
import AddHostModal from '../components/AddHostModal';
import { useTransferHostStore } from '@/store/TransferHostStore';
import { getTransferHostPath, getBusinessIdFromUrl } from '../../../../utils/routes';
import TransferHostModal from '../components/TransferHostModal';
import ReleaseHostModal from '../components/ReleaseHostModal';
import './style.css';
import { checkHostsInIdlePool, getHostCopyValue, getSelectedNodeStatus } from '../../utils';
import CreateNodeModal from '../components/CreateNodeModal';
import { hostCopyKeys, hostCopyMenuItems, transferBaseMenuItems } from '../../constants';
import EmptySearchResult from '@/components/common/EmptySearchResult';
import { useAuthStore } from '@/store/AuthStore';

interface Props {
  selectedNode: TreeData;
  parentNodes: TreeData[];
  onTopologyChanged: () => void;
}

const HostList: React.FC<Props> = ({ selectedNode, parentNodes, onTopologyChanged }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { idleSetID, setTransferHostData } = useTransferHostStore();
  const [searchParams] = useSearchParams();

  const [searchValue, setSearchValue] = useState<string>('');
  const [hostsList, setHostsList] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferModalType, setTransferModalType] = useState<TransferHostType>();
  const [releaseModalVisible, setReleaseModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const canWrite = useAuthStore((state) => state.canWrite());

  const adaptTopologyHost = useCallback((item: TopologyNodeHostItem) => {
    return {
      host: {
        bk_host_id: item.host_id,
        bk_host_innerip: item.inner_ipv4,
        bk_host_innerip_v6: item.inner_ipv6,
        bk_cloud_host_status: item.status,
        bk_cloud_id: item.cloud_area
          ? [
              {
                bk_inst_id: item.cloud_area.id,
                bk_inst_name: item.cloud_area.name,
              },
            ]
          : [],
      },
      module: item.module
        ? [
            {
              bk_module_id: item.module.id,
              bk_module_name: item.module.name,
              topo_module_name: item.module.name,
            },
          ]
        : [],
      set: item.set
        ? [
            {
              bk_set_id: item.set.id,
              bk_set_name: item.set.name,
            },
          ]
        : [],
    };
  }, []);

  const fetchNodeHosts = useCallback(async () => {
    const nodeType = selectedNode.backendType || selectedNode.type;
    const nodeId = selectedNode.nodeId;

    if (!nodeType || !nodeId) {
      setHostsList([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const response = await getTopologyNodeHosts(`${nodeType}-${nodeId}`, {
        page: currentPage,
        page_size: pageSize,
        keyword: searchValue.trim(),
      });

      const items = response?.data?.items || [];
      const pagination = response?.data?.pagination;

      setHostsList(items.map(adaptTopologyHost));
      setTotal(pagination?.total ?? items.length);
    } catch (error) {
      console.error('Failed to fetch topology node hosts:', error);
      setHostsList([]);
      setTotal(0);
      message.error(t('resource.host.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [
    adaptTopologyHost,
    currentPage,
    pageSize,
    searchValue,
    selectedNode.backendType,
    selectedNode.nodeId,
    selectedNode.type,
    t,
  ]);

  useEffect(() => {
    fetchNodeHosts();
  }, [fetchNodeHosts]);

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [selectedNode.key]);

  const selectedTransferHosts = useMemo(() => {
    const idleStatusMap = new Map(
      checkHostsInIdlePool(selectedRowKeys, hostsList, idleSetID).map((host) => [
        String(host.id),
        host,
      ]),
    );

    return selectedRowKeys.map((id) => {
      const hostInfo = hostsList.find((host) => host.host.bk_host_id === id);
      const cloud = hostInfo?.host.bk_cloud_id?.[0];
      const region = cloud ? `${cloud.bk_inst_name}[${cloud.bk_inst_id}]` : '';
      const idleStatus = idleStatusMap.get(String(id));

      return {
        id,
        ip: hostInfo?.host.bk_host_innerip || '',
        cloudInfo: region,
        inIdlePool: idleStatus?.inIdlePool,
      } as TransferHostItem;
    });
  }, [hostsList, idleSetID, selectedRowKeys]);

  const hostsNotInIdlePool = selectedTransferHosts.some((item) => item.inIdlePool !== true);

  const copyHostData = useCallback(
    (copyKey: HostCopyKey) => {
      if (!selectedRowKeys.length) return;
      const selectedHosts = hostsList.filter((h) => selectedRowKeys.includes(h.host.bk_host_id));

      const text = selectedHosts.map((rec) => getHostCopyValue(rec, copyKey)).join('\n');
      if (!text) {
        message.warning(t('resource.host.messages.noCopyContent'));
        return;
      }
      navigator.clipboard
        ?.writeText(text)
        .then(() => {
          message.success(t('resource.host.messages.copySuccess'));
        })
        .catch(() => {
          message.error(t('resource.host.messages.copyFailed'));
        });
    },
    [selectedRowKeys],
  );

  const handleMenuClick = (key: string) => {
    // Copy menu iem
    if ((hostCopyKeys as string[]).includes(key)) {
      copyHostData(key as HostCopyKey);
      return;
    }

    // Other menu item (transfer / release / append etc.)
    if (key === TransferMenuItemType.hostPool) {
      setReleaseModalVisible(true);
    } else if (
      Object.values(TransferMenuItemType).includes(key as TransferMenuItemType) ||
      key === AppendMenuItemKey.AppendToBusinessModule
    ) {
      // Transfer and append menu item/
      setTransferModalVisible(true);
      setTransferModalType(key as TransferHostType);
    } else if (key === RemoveMenuItemKey.CurrentModule) {
      // Remove from current module
      const enrichedHosts: TransferHostItem[] = selectedRowKeys.map((id) => {
        const hostInfo = hostsList.find((h) => h.host.bk_host_id === id);
        const cloud = hostInfo?.host.bk_cloud_id?.[0];
        const region = cloud ? `${cloud.bk_inst_name}[${cloud.bk_inst_id}]` : '';
        return {
          id,
          ip: hostInfo?.host.bk_host_innerip || '',
          cloudInfo: region,
        } as TransferHostItem;
      });
      setTransferHostData(enrichedHosts, [selectedNode], RemoveMenuItemKey.CurrentModule);
      handleNavToTransferPage();
    }
  };

  const handleAddHosts = () => {
    setAddModalVisible(true);
  };

  const handleNavToTransferPage = () => {
    // Get business ID from current URL
    const businessId = getBusinessIdFromUrl();
    if (businessId) {
      const transferPath = getTransferHostPath(businessId);
      // Create fresh URL params with current selected node
      const params = new URLSearchParams(searchParams);
      params.set('node', selectedNode.key);
      navigate(transferPath + '?' + params.toString());
    }
  };

  const selectedNodeStatus = useMemo(() => {
    return getSelectedNodeStatus([selectedNode]);
  }, [selectedNode]);

  const handleConfirmAddHosts = useCallback(
    async (hosts: TransferHostItem[]) => {
      if (!selectedNodeStatus.isModule || !selectedNode.nodeId) {
        setTransferHostData(hosts, [selectedNode]);
        handleNavToTransferPage();
        return;
      }

      try {
        await transferTopologyHosts({
          host_ids: hosts.map((host) => String(host.id)),
          target_module_id: Number(selectedNode.nodeId),
        });
        message.success(
          t('business.topology.addHostModal.messages.addSuccess', { count: hosts.length }),
        );
        onTopologyChanged();
        await fetchNodeHosts();
      } catch (error) {
        console.error('Failed to transfer hosts to topology module:', error);
        message.error(t('resource.host.messages.loadFailed'));
      }
    },
    [
      fetchNodeHosts,
      handleNavToTransferPage,
      onTopologyChanged,
      selectedNode,
      selectedNodeStatus.isModule,
      setTransferHostData,
      t,
    ],
  );

  const handleTransferHosts = useCallback(
    (targetModules: TreeData[]) => {
      if (transferModalType === TransferMenuItemType.idlePool && !hostsNotInIdlePool) {
        setTransferModalVisible(false);
        return;
      }

      setTransferHostData(selectedTransferHosts, targetModules, transferModalType);
      handleNavToTransferPage();
    },
    [
      handleNavToTransferPage,
      hostsNotInIdlePool,
      selectedTransferHosts,
      setTransferHostData,
      transferModalType,
    ],
  );

  const handleReleaseHosts = useCallback(
    async (_dirId: number) => {
      try {
        await transferTopologyHostsToPool({
          host_ids: selectedTransferHosts.map((host) => String(host.id)),
        });
        message.success(t('resource.host.messages.removeSuccess'));
        setReleaseModalVisible(false);
        onTopologyChanged();
        await fetchNodeHosts();
      } catch (error) {
        console.error('Failed to transfer hosts to resource pool:', error);
        message.error(t('resource.host.messages.loadFailed'));
      }
    },
    [fetchNodeHosts, onTopologyChanged, selectedTransferHosts, t],
  );

  const handleSearch = (value: string) => {
    setSearchValue(value);
  };

  const handleClearSearch = () => {
    setSearchValue('');
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: ['host', 'bk_host_id'],
      render: (id: number) => <a>{id}</a>,
    },
    {
      title: t('resource.host.columns.innerIpv4'),
      dataIndex: ['host', 'bk_host_innerip'],
    },
    {
      title: t('resource.host.columns.innerIpv6'),
      dataIndex: ['host', 'bk_host_innerip_v6'],
      render: (text: string) => text || '--',
    },
    {
      title: t('resource.host.columns.cloudArea'),
      render: (_: any, record: any) => {
        const cloudInfo = record.host.bk_cloud_id;
        if (!cloudInfo || cloudInfo.length === 0) return '--';
        const { bk_inst_name } = cloudInfo[0];
        // If the name looks like a UUID (contains only hex + dashes, 36 chars), show a friendly fallback
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const displayName = uuidPattern.test(bk_inst_name)
          ? t('resource.host.cloudArea.direct')
          : bk_inst_name;
        return <span>{displayName}</span>;
      },
    },
    {
      title: t('business.topology.hostList.columns.moduleName'),
      render: (_: any, record: any) => {
        const moduleInfo = record.module;
        return moduleInfo.length > 0 ? <span>{moduleInfo[0].bk_module_name}</span> : '--';
      },
    },
    {
      title: t('business.topology.hostList.columns.clusterName'),
      render: (_: any, record: any) => {
        const setInfo = record.set;
        return setInfo.length > 0 ? <span>{setInfo[0].bk_set_name}</span> : '--';
      },
    },
  ];

  const getDropdownMenu = (type: DropdownMenuType) => {
    const items = [];

    if (type === DropdownMenuType.Transfer) {
      transferBaseMenuItems
        .filter((base) => base.key !== TransferMenuItemType.otherBusiness)
        .forEach((base) => {
          if (base.key === TransferMenuItemType.hostPool) {
            const disabled = hostsNotInIdlePool;
            const tip = t('business.topology.hostList.transfer.hostPoolTip');
            items.push({
              ...base,
              label: disabled ? (
                <Tooltip title={tip} styles={{ root: { maxWidth: 'none' } }}>
                  {t(base.label)}
                </Tooltip>
              ) : (
                t(base.label)
              ),
              disabled,
            });
          } else {
            items.push({
              ...base,
              label: t(base.label),
            } as any);
          }
        });
    } else if (type === DropdownMenuType.Append) {
      items.push({
        key: AppendMenuItemKey.AppendToBusinessModule,
        label: t('business.topology.hostList.menus.businessModule'),
      });
    } else if (type === DropdownMenuType.Remove) {
      items.push({
        key: RemoveMenuItemKey.CurrentModule,
        label: t('business.topology.hostList.menus.currentModule'),
      });
    } else if (type === DropdownMenuType.Copy) {
      const translatedCopyItems = hostCopyMenuItems.map((item) => {
        if ('children' in item && item.children) {
          return {
            ...item,
            label: t(item.label),
            children: item.children.map((child) => ({
              ...child,
              label: t(child.label),
            })),
          };
        } else {
          return {
            ...item,
            label: item.label === 'ID' ? 'ID' : t(item.label),
          };
        }
      });
      items.push(...translatedCopyItems);
    } else if (type === DropdownMenuType.More) {
      items.push(
        {
          key: MoreMenuItemKey.ExportSelected,
          label: t('business.topology.hostList.menus.exportSelected'),
          disabled: selectedRowKeys.length === 0,
        },
        {
          key: MoreMenuItemKey.ExportAll,
          label: t('business.topology.hostList.menus.exportAll'),
        },
        {
          key: MoreMenuItemKey.ImportExcel,
          label: t('business.topology.hostList.menus.importExcel'),
        },
      );
    }

    return { items };
  };

  const isEmptySet = useMemo(() => {
    const node = selectedNode;
    // The key is formatted as "<type>-<id>" (e.g., "set-1")
    const keyParts = node.key.split('-');
    if (keyParts.length !== 2) {
      return false;
    }

    const isSetType = keyParts[0] === TopoTreeNodeType.Set;
    const hasNoChildren = !node.children || node.children.length === 0;
    return isSetType && hasNoChildren;
  }, [selectedNode]);

  const hostScopeTitle = useMemo(() => String(selectedNode.title), [selectedNode.title]);
  const hasSelection = selectedRowKeys.length > 0;

  return (
    <>
      {isEmptySet ? (
        <Empty
          className="empty-wrapper"
          description={
            <Typography.Text>
              {t('business.topology.hostList.empty.noModuleCreated')}
            </Typography.Text>
          }
        >
          <Button type="primary" onClick={() => setCreateModalVisible(true)} disabled={!canWrite}>
            {t('business.topology.hostList.empty.createNow')}
          </Button>
        </Empty>
      ) : (
        <div className="list-wrapper">
          <div className="host-workspace">
            <div className="host-workspace__scope">
              <div>
                <div className="host-workspace__eyebrow">{t('business.topology.workspace.currentNode')}</div>
                <div className="host-workspace__title">{hostScopeTitle}</div>
              </div>
              <div className="host-workspace__summary">
                {t('business.topology.workspace.hostList')}
              </div>
            </div>

            <div className="host-workspace__toolbar">
              <div className="host-workspace__actions">
                {selectedNodeStatus.isModule ? (
                  <Button type="primary" onClick={handleAddHosts} disabled={!canWrite}>
                    {t('business.topology.hostList.buttons.add')}
                  </Button>
                ) : (
                  <Tooltip title={t('business.topology.hostList.tooltips.onlyModuleCanAdd')}>
                    <Button type="primary" disabled>
                      {t('business.topology.hostList.buttons.add')}
                    </Button>
                  </Tooltip>
                )}

                <Button disabled={!hasSelection || !canWrite}>
                  {t('business.topology.hostList.buttons.edit')}
                </Button>

                {canWrite ? (
                  <Dropdown
                    menu={{
                      ...getDropdownMenu(DropdownMenuType.More),
                      onClick: ({ key }) => handleMenuClick(key),
                    }}
                    trigger={['click']}
                  >
                    <Button>
                      {t('business.topology.hostList.buttons.more')} <DownOutlined />
                    </Button>
                  </Dropdown>
                ) : null}
              </div>

              <div className="search-bar">
                <Input.Search
                  placeholder={t('business.topology.hostList.search.placeholder')}
                  style={{ width: 300 }}
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onSearch={(value) => handleSearch(value)}
                />
              </div>
            </div>

            <div className="host-workspace__table-shell">
              <Table
                rowSelection={{
                  selectedRowKeys,
                  onChange: setSelectedRowKeys,
                }}
                columns={columns}
                dataSource={hostsList}
                loading={loading}
                rowKey={(record) => record.host.bk_host_id}
                pagination={false}
                locale={{
                  emptyText:
                    searchValue && hostsList.length === 0 ? (
                      <EmptySearchResult onClearFilter={handleClearSearch} />
                    ) : undefined,
                }}
              />
            </div>

            {hostsList.length > 0 && (
              <div className="pagination-wrapper">
                <span className="host-workspace__pagination-copy">
                  {t('business.topology.hostList.pagination.total', { count: total })}
                </span>
                <Pagination
                  total={total}
                  pageSize={pageSize}
                  current={currentPage}
                  onChange={(page, size) => {
                    setCurrentPage(page);
                    setPageSize(size);
                  }}
                  onSizeChange={(_, size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}

            {hasSelection && (
              <div className="host-floating-actions" data-testid="hostlist-floating-actions">
                <div className="host-floating-actions__count">
                  {t('business.topology.hostList.floating.selectedCount', {
                    count: selectedRowKeys.length,
                  })}
                </div>
                <span className="host-floating-actions__divider" />

                {canWrite ? (
                  <Dropdown
                    menu={{
                      ...getDropdownMenu(DropdownMenuType.Transfer),
                      onClick: ({ key }) => handleMenuClick(key),
                    }}
                    trigger={['click']}
                  >
                    <Button type="text">
                      {t('business.topology.hostList.buttons.transferTo')} <DownOutlined />
                    </Button>
                  </Dropdown>
                ) : null}

                {canWrite && !selectedNodeStatus.isIdle && (
                  <Dropdown
                    menu={{
                      ...getDropdownMenu(DropdownMenuType.Append),
                      onClick: ({ key }) => handleMenuClick(key),
                    }}
                    trigger={['click']}
                  >
                    <Button type="text">
                      {t('business.topology.hostList.buttons.appendTo')} <DownOutlined />
                    </Button>
                  </Dropdown>
                )}

                {canWrite && selectedNodeStatus.isModule && (
                  <Dropdown
                    menu={{
                      ...getDropdownMenu(DropdownMenuType.Remove),
                      onClick: ({ key }) => handleMenuClick(key),
                    }}
                    trigger={['click']}
                  >
                    <Button type="text">
                      {t('business.topology.hostList.buttons.removeFrom')} <DownOutlined />
                    </Button>
                  </Dropdown>
                )}

                <Dropdown
                  menu={{
                    ...getDropdownMenu(DropdownMenuType.Copy),
                    onClick: ({ key }) => handleMenuClick(key as HostCopyKey),
                  }}
                  overlayStyle={{ width: 190 }}
                  trigger={['click']}
                >
                  <Button type="text">
                    {t('business.topology.hostList.buttons.copy')} <DownOutlined />
                  </Button>
                </Dropdown>

                <button
                  type="button"
                  className="host-floating-actions__clear"
                  data-testid="hostlist-clear-selection"
                  onClick={() => setSelectedRowKeys([])}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add host modal */}
      <AddHostModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onConfirm={handleConfirmAddHosts}
      />

      {/* Transfer host modal */}
      <TransferHostModal
        visible={transferModalVisible}
        transferType={transferModalType}
        selectedHosts={selectedTransferHosts}
        onClose={() => setTransferModalVisible(false)}
        onConfirm={handleTransferHosts}
      />

      {/* Release host modal */}
      <ReleaseHostModal
        visible={releaseModalVisible}
        selectedCount={selectedRowKeys.length}
        onClose={() => setReleaseModalVisible(false)}
        onConfirm={handleReleaseHosts}
      />

      {/* Creating set and module modal*/}
      <CreateNodeModal
        visible={createModalVisible}
        selectedNode={selectedNode}
        parentNodes={parentNodes}
        onCreated={onTopologyChanged}
        onClose={() => setCreateModalVisible(false)}
      />
    </>
  );
};

export default HostList;
