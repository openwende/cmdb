import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Table, Button, Dropdown, Input, Tooltip, Empty, Typography, Checkbox, Spin } from 'antd';
import { useAppMessage } from '@/utils/message';
import { DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import Pagination from '@/components/common/Pagination';
import {
  getTopologyNodeHosts,
  TopologyNodeHostItem,
  reclaimTopologyHostsToPool,
  transferTopologyHosts,
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
  const message = useAppMessage();
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
  const requestSeqRef = useRef(0);

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
    const canContainHosts = selectedNode.type === TopoTreeNodeType.Module;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;

    if (!canContainHosts || !nodeType || !nodeId) {
      setHostsList([]);
      setTotal(0);
      setLoading(false);
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

      if (requestSeq !== requestSeqRef.current) {
        return;
      }

      setHostsList(items.map(adaptTopologyHost));
      setTotal(pagination?.total ?? items.length);
    } catch (error) {
      if (requestSeq !== requestSeqRef.current) {
        return;
      }
      console.error('Failed to fetch topology node hosts:', error);
      setHostsList([]);
      setTotal(0);
      message.error(t('resource.host.messages.loadFailed'));
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  }, [
    adaptTopologyHost,
    currentPage,
    message,
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

  const selectedNodeStatus = useMemo(() => {
    return getSelectedNodeStatus([selectedNode]);
  }, [selectedNode]);

  const currentModuleId = useMemo(() => {
    if (!selectedNodeStatus.isModule) {
      return undefined;
    }
    const value = Number(selectedNode.nodeId || selectedNode.key.split('-').at(-1));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  }, [selectedNode.key, selectedNode.nodeId, selectedNodeStatus.isModule]);

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
      const hostModuleId = Number(hostInfo?.module?.[0]?.bk_module_id);
      const sourceModuleId =
        currentModuleId ||
        (Number.isFinite(hostModuleId) && hostModuleId > 0 ? hostModuleId : undefined);

      return {
        id,
        ip: hostInfo?.host.bk_host_innerip || '',
        cloudInfo: region,
        inIdlePool: selectedNodeStatus.isIdle || idleStatus?.inIdlePool,
        sourceModuleId,
      } as TransferHostItem;
    });
  }, [currentModuleId, hostsList, idleSetID, selectedNodeStatus.isIdle, selectedRowKeys]);

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

  const handleConfirmAddHosts = useCallback(
    async (hosts: TransferHostItem[]) => {
      if (!selectedNodeStatus.isModule) {
        message.error(
          t(
            'business.topology.hostList.tooltips.onlyModuleCanAdd',
            '只有模块节点才能绑定主机，请选择模块后重试',
          ),
        );
        return;
      }
      if (!selectedNode.nodeId) {
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

      const sourceModuleId =
        transferModalType === TransferMenuItemType.businessModule ? currentModuleId : undefined;
      setTransferHostData(selectedTransferHosts, targetModules, transferModalType, sourceModuleId);
      handleNavToTransferPage();
    },
    [
      currentModuleId,
      handleNavToTransferPage,
      hostsNotInIdlePool,
      selectedTransferHosts,
      setTransferHostData,
      transferModalType,
    ],
  );

  const handleReleaseHosts = useCallback(
    async (dirId: number) => {
      try {
        const response = await reclaimTopologyHostsToPool({
          host_ids: selectedTransferHosts.map((host) => String(host.id)),
          directory_id: dirId,
        });

        const failedCount = Number(response?.data?.failed ?? 0);
        if (failedCount > 0) {
          const failedMessage =
            response?.data?.failed_items?.[0]?.message || response?.data?.errors?.[0];
          throw new Error(failedMessage || t('resource.host.messages.loadFailed'));
        }

        message.success(t('resource.host.messages.removeSuccess'));
        setReleaseModalVisible(false);
        setSelectedRowKeys([]);
        onTopologyChanged();
        await fetchNodeHosts();
      } catch (error) {
        console.error('Failed to transfer hosts to resource pool:', error);
        message.error(t('resource.host.messages.loadFailed'));
      }
    },
    [fetchNodeHosts, message, onTopologyChanged, selectedTransferHosts, t],
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
          if (base.key === TransferMenuItemType.idlePool) {
            items.push({
              ...base,
              label: t(base.label),
              disabled: !hostsNotInIdlePool,
            } as any);
          } else if (base.key === TransferMenuItemType.hostPool) {
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

  const hasSelection = selectedRowKeys.length > 0;
  const toggleSelectedHost = (hostId: React.Key, checked: boolean) => {
    setSelectedRowKeys((current) =>
      checked ? Array.from(new Set([...current, hostId])) : current.filter((key) => key !== hostId),
    );
  };
  const getCloudAreaLabel = (record: any) => {
    const cloudInfo = record.host.bk_cloud_id;
    if (!cloudInfo || cloudInfo.length === 0) return '--';
    return cloudInfo[0].bk_inst_name;
  };
  const getModuleLabel = (record: any) =>
    record.module.length > 0 ? record.module[0].bk_module_name : '--';
  const getSetLabel = (record: any) => (record.set.length > 0 ? record.set[0].bk_set_name : '--');
  const emptyHostDescription = t('common.noData', '暂无数据');

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
            <div className="host-workspace__toolbar">
              <div className="host-workspace__actions">
                {selectedNodeStatus.isModule ? (
                  <Tooltip
                    title={!canWrite ? t('common.noPermission', '权限不足，无法操作') : undefined}
                  >
                    <Button type="primary" onClick={handleAddHosts} disabled={!canWrite}>
                      {t('business.topology.hostList.buttons.add')}
                    </Button>
                  </Tooltip>
                ) : (
                  <Tooltip title={t('business.topology.hostList.tooltips.onlyModuleCanAdd')}>
                    <Button type="primary" disabled>
                      {t('business.topology.hostList.buttons.add')}
                    </Button>
                  </Tooltip>
                )}

                {canWrite ? (
                  <Dropdown
                    menu={{
                      ...getDropdownMenu(DropdownMenuType.Transfer),
                      onClick: ({ key }) => handleMenuClick(key),
                    }}
                    trigger={['click']}
                    disabled={!hasSelection || !selectedNodeStatus.isModule}
                  >
                    <Button
                      disabled={!hasSelection || !selectedNodeStatus.isModule}
                      title={
                        !selectedNodeStatus.isModule
                          ? t('business.topology.hostList.tooltips.onlyModuleCanAdd')
                          : !hasSelection
                            ? t(
                                'business.topology.hostList.tooltips.selectHostFirst',
                                '请先勾选主机',
                              )
                            : undefined
                      }
                    >
                      {t('business.topology.hostList.buttons.transferTo')} <DownOutlined />
                    </Button>
                  </Dropdown>
                ) : null}

                {canWrite && selectedNodeStatus.isModule && !selectedNodeStatus.isIdle ? (
                  <Dropdown
                    menu={{
                      ...getDropdownMenu(DropdownMenuType.Append),
                      onClick: ({ key }) => handleMenuClick(key),
                    }}
                    trigger={['click']}
                    disabled={!hasSelection}
                  >
                    <Button
                      disabled={!hasSelection}
                      title={
                        !hasSelection
                          ? t('business.topology.hostList.tooltips.selectHostFirst', '请先勾选主机')
                          : undefined
                      }
                    >
                      {t('business.topology.hostList.buttons.appendTo')} <DownOutlined />
                    </Button>
                  </Dropdown>
                ) : null}

                {canWrite && selectedNodeStatus.isModule ? (
                  <Dropdown
                    menu={{
                      ...getDropdownMenu(DropdownMenuType.Remove),
                      onClick: ({ key }) => handleMenuClick(key),
                    }}
                    trigger={['click']}
                    disabled={!hasSelection}
                  >
                    <Button
                      disabled={!hasSelection}
                      title={
                        !hasSelection
                          ? t('business.topology.hostList.tooltips.selectHostFirst', '请先勾选主机')
                          : undefined
                      }
                    >
                      {t('business.topology.hostList.buttons.removeFrom')} <DownOutlined />
                    </Button>
                  </Dropdown>
                ) : null}

                <Dropdown
                  menu={{
                    ...getDropdownMenu(DropdownMenuType.Copy),
                    onClick: ({ key }) => handleMenuClick(key as HostCopyKey),
                  }}
                  overlayStyle={{ width: 190 }}
                  trigger={['click']}
                  disabled={!hasSelection}
                >
                  <Button
                    disabled={!hasSelection}
                    title={
                      !hasSelection
                        ? t('business.topology.hostList.tooltips.selectHostFirst', '请先勾选主机')
                        : undefined
                    }
                  >
                    {t('business.topology.hostList.buttons.copy')} <DownOutlined />
                  </Button>
                </Dropdown>

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
                scroll={{ x: 900 }}
                locale={{
                  emptyText:
                    searchValue && hostsList.length === 0 ? (
                      <EmptySearchResult onClearFilter={handleClearSearch} />
                    ) : !loading && hostsList.length === 0 ? (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={emptyHostDescription}
                      >
                        {selectedNodeStatus.isModule && canWrite ? (
                          <Button type="primary" size="small" onClick={handleAddHosts}>
                            {t('business.topology.hostList.buttons.add')}
                          </Button>
                        ) : null}
                      </Empty>
                    ) : undefined,
                }}
              />
            </div>

            <div className="topology-host-mobile-list" aria-live="polite">
              {loading ? (
                <div className="topology-host-mobile-loading">
                  <Spin />
                </div>
              ) : hostsList.length > 0 ? (
                hostsList.map((record) => {
                  const hostId = record.host.bk_host_id;
                  const selected = selectedRowKeys.includes(hostId);
                  return (
                    <article key={hostId} className="topology-host-mobile-card">
                      <div className="topology-host-mobile-card__head">
                        <Checkbox
                          checked={selected}
                          onChange={(event) => toggleSelectedHost(hostId, event.target.checked)}
                          aria-label={t('resource.host.actions.selectHost', {
                            id: hostId,
                            defaultValue: `选择主机 ${hostId}`,
                          })}
                        />
                        <div>
                          <div className="topology-host-mobile-card__title">
                            {record.host.bk_host_innerip || hostId}
                          </div>
                          <div className="topology-host-mobile-card__meta">ID {hostId}</div>
                        </div>
                      </div>
                      <dl className="topology-host-mobile-card__grid">
                        <div>
                          <dt>{t('resource.host.columns.innerIpv6')}</dt>
                          <dd>{record.host.bk_host_innerip_v6 || '--'}</dd>
                        </div>
                        <div>
                          <dt>{t('resource.host.columns.cloudArea')}</dt>
                          <dd>{getCloudAreaLabel(record)}</dd>
                        </div>
                        <div>
                          <dt>{t('business.topology.hostList.columns.moduleName')}</dt>
                          <dd>{getModuleLabel(record)}</dd>
                        </div>
                        <div>
                          <dt>{t('business.topology.hostList.columns.clusterName')}</dt>
                          <dd>{getSetLabel(record)}</dd>
                        </div>
                      </dl>
                    </article>
                  );
                })
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyHostDescription}>
                  {selectedNodeStatus.isModule && canWrite ? (
                    <Button type="primary" size="small" onClick={handleAddHosts}>
                      {t('business.topology.hostList.buttons.add')}
                    </Button>
                  ) : null}
                </Empty>
              )}
            </div>

            {hostsList.length > 0 && (
              <div className="pagination-wrapper">
                <span className="host-workspace__pagination-copy">
                  {t('business.topology.hostList.pagination.selected')} {selectedRowKeys.length}{' '}
                  {t('business.topology.hostList.pagination.items')}
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
