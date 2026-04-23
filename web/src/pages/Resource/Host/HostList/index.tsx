import React, { useCallback, useEffect, useState } from 'react';
import { Table, Button, Input, Dropdown, message, Modal, Tooltip } from 'antd';
import { DownOutlined, ExclamationCircleFilled, HistoryOutlined } from '@ant-design/icons';
import {
  resourceAssignMenuItems,
  resourceCopyMenuItems,
  resourceMoreMenuItems,
} from '../../constants';
import { MenuItemProps, ResourceCopyKey, ResourceMoreKey } from '../../Types';
import Pagination from '@/components/common/Pagination';
import { AssignType, TabsKey } from '../../Types';
import AssignModal from '../components/AssignModal';
import { getHostCopyValue, checkHostsInHostPool } from '../../utils';
import { useTranslation } from 'react-i18next';
import { transferBaseMenuItems } from '@/pages/Business/constants';
import { TransferHostType, TransferMenuItemType, TreeData } from '@/pages/Business/Types';
import { useTransferHostStore } from '@/store/TransferHostStore';
import { checkHostsInIdlePool } from '@/pages/Business/utils';
import TransferHostModal from '@/pages/Business/BusinessTopology/components/TransferHostModal';
import ReleaseHostModal from '@/pages/Business/BusinessTopology/components/ReleaseHostModal';
import { getTransferHostPath } from '@/utils/routes';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ImportHost from '../components/ImportHost';
import './style.css';
import { useDirectoryStore } from '@/store/DirectoryStore';
import { usePoolHostStore } from '@/store/PoolHostStore';
import { getHostList } from '@/api';
import { useAuthStore } from '@/store/AuthStore';

interface HostListProps {
  selectedId?: number;
  tabKey: TabsKey;
}

interface RawHostItem {
  id: string;
  primary_ip?: string;
  ip_addresses?: string[];
  status?: string;
  cloud_area_id?: string | null;
  business_ids?: string[];
  module_ids?: number[];
}

export const hostResourcePath = '/resource/host';
export const deleteHistoryPath = hostResourcePath + '/deleteHistory';

const HostList: React.FC<HostListProps> = ({ selectedId, tabKey }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canWrite = useAuthStore((state) => state.canWrite());
  const { confirm } = Modal;
  const { idleSetID, setTransferHostData } = useTransferHostStore();
  const directories = useDirectoryStore((state) => state.directories);
  const fetchDirectories = useDirectoryStore((state) => state.fetchDirectories);
  const poolHosts = usePoolHostStore((state) => state.hosts);
  const poolHostTotal = usePoolHostStore((state) => state.total);
  const poolHostLoading = usePoolHostStore((state) => state.loading);
  const query = usePoolHostStore((state) => state.query);
  const setPoolHostQuery = usePoolHostStore((state) => state.setQuery);
  const fetchPoolHosts = usePoolHostStore((state) => state.fetchHosts);
  const [generalHostLoading, setGeneralHostLoading] = useState(false);
  const [generalHostTotal, setGeneralHostTotal] = useState(0);
  // import、assign、transfer host
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [assignType, setAssignType] = useState<AssignType>(AssignType.None);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferModalType, setTransferModalType] = useState<TransferHostType>();
  const [releaseModalVisible, setReleaseModalVisible] = useState(false);
  // Host list
  const [hostsList, setHostsList] = useState<any>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const adaptGeneralHost = useCallback((item: RawHostItem) => {
    const ipv6 = item.ip_addresses?.find((address) => address.includes(':')) || '';
    const cloudID = item.cloud_area_id || '';
    const moduleIDs = item.module_ids || [];

    return {
      host: {
        bk_host_id: item.id,
        bk_host_innerip: item.primary_ip || '',
        bk_host_innerip_v6: ipv6,
        bk_cloud_host_status: item.status || '--',
        bk_cloud_id: cloudID
          ? [
              {
                bk_inst_id: cloudID,
                bk_inst_name: cloudID,
              },
            ]
          : [],
      },
      module: moduleIDs.map((moduleID) => ({
        bk_module_id: moduleID,
        topo_module_name: `模块##${moduleID}`,
      })),
      set: [],
      business_ids: item.business_ids || [],
      module_ids: moduleIDs,
    };
  }, []);

  const fetchGeneralHosts = useCallback(async () => {
    setGeneralHostLoading(true);

    try {
      const response = await getHostList({
        params: {
          page: query.page,
          page_size: query.pageSize,
        },
      });

      const hosts = ((response as any)?.hosts || []) as RawHostItem[];
      const adaptedHosts = hosts.map(adaptGeneralHost);
      const filteredHosts =
        tabKey === TabsKey.Assigned
          ? adaptedHosts.filter(
              (item) =>
                (item.business_ids as string[] | undefined)?.length
                || (item.module_ids as number[] | undefined)?.length,
            )
          : adaptedHosts;

      setHostsList(filteredHosts);
      setGeneralHostTotal(
        tabKey === TabsKey.Assigned
          ? filteredHosts.length
          : ((response as any)?.total ?? filteredHosts.length),
      );
    } catch (error) {
      console.error('Failed to fetch general hosts:', error);
      setHostsList([]);
      setGeneralHostTotal(0);
      message.error(t('resource.host.messages.loadFailed'));
    } finally {
      setGeneralHostLoading(false);
    }
  }, [adaptGeneralHost, query.page, query.pageSize, t, tabKey]);

  useEffect(() => {
    if (tabKey !== TabsKey.Unassigned) {
      setSelectedRowKeys([]);
      return;
    }

    setPoolHostQuery({
      directoryId: selectedId && selectedId > 0 ? selectedId : undefined,
      page: 1,
    });
  }, [selectedId, setPoolHostQuery, tabKey]);

  useEffect(() => {
    if (tabKey !== TabsKey.Unassigned) {
      void fetchGeneralHosts();
      return;
    }

    void fetchPoolHosts();
  }, [fetchGeneralHosts, fetchPoolHosts, query.directoryId, query.page, query.pageSize, tabKey]);

  useEffect(() => {
    if (tabKey === TabsKey.Unassigned) {
      setHostsList(poolHosts);
    }
  }, [poolHosts, tabKey]);

  // Check if all hosts are in the idle pool
  const hostIdleStatuses = checkHostsInIdlePool(selectedRowKeys, hostsList, idleSetID);
  const hostsNotInIdlePool = hostIdleStatuses.some((item) => item.inIdlePool === false);

  // Check if all hosts are in the host pool (only used in "all" TAB)
  const hostPoolStatuses = checkHostsInHostPool(selectedRowKeys, hostsList, directories);
  const hostsNotAllInHostPool = hostPoolStatuses.some((item) => item.inHostPool === false);
  const isHostPoolHost = tabKey === TabsKey.All && hostsNotAllInHostPool;

  // Check if all are in the business host pool:
  // If even one host is in a host pool, then not all are in the business host pool
  const hostsNotAllInBizPool = hostPoolStatuses.some((item) => item.inHostPool === true);

  const handleSelectedRows = (rowKeys: React.Key[], _rows: any) => {
    setSelectedRowKeys(rowKeys);
  };

  const handleTransferMenuClick = (key: string) => {
    if (!canWrite) return;
    // Release menu item
    if (key === TransferMenuItemType.hostPool) {
      setReleaseModalVisible(true);
    } else if (Object.values(TransferMenuItemType).includes(key as TransferMenuItemType)) {
      // Transfer menu item
      setTransferModalVisible(true);
      setTransferModalType(key as TransferHostType);
    }
  };

  const handleCopyMenuClick = useCallback(
    (copyKey: ResourceCopyKey) => {
      if (!selectedRowKeys.length) return;
      const selectedHosts = hostsList.filter((h: any) =>
        selectedRowKeys.includes(h.host.bk_host_id),
      );

      const text = selectedHosts.map((rec: any) => getHostCopyValue(rec, copyKey)).join('\n');
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
    [hostsList, selectedRowKeys],
  );

  const handleMoreMenuClick = (key: ResourceMoreKey) => {
    if (!canWrite) return;
    if (key === ResourceMoreKey.Delete) {
      confirm({
        title: t('resource.host.messages.confirmDelete'),
        icon: <ExclamationCircleFilled />,
        okText: t('common.confirm'),
        cancelText: t('common.cancel'),
        onOk() {
          // TODO: api
          message.success(t('resource.host.messages.deleteSuccess'));
        },
        onCancel() {},
      });
    }
  };

  const handleTransferHosts = useCallback(
    (targetModules: TreeData[]) => {
      if (!canWrite) return;
      if (
        (transferModalType === TransferMenuItemType.idlePool && !hostsNotInIdlePool) ||
        transferModalType === TransferMenuItemType.otherBusiness
      ) {
        // TODO: api
        setTransferModalVisible(false);
        return;
      }

      setTransferHostData(hostIdleStatuses, targetModules, transferModalType);
      navigate(getTransferHostPath + '?' + searchParams.toString());
    },
    [canWrite, transferModalType, hostsNotInIdlePool, hostIdleStatuses],
  );

  const handleReleaseHosts = useCallback((_dirId: number) => {
    if (!canWrite) return;
    // TODO: api
    // params: selectedRowKeys, dirId
    setReleaseModalVisible(false);
  }, [canWrite]);

  const handleDeleteHistory = () => {
    navigate(deleteHistoryPath + '?' + searchParams.toString());
  };

  const handleImportSuccess = () => {
    void fetchDirectories();
    void fetchPoolHosts();
  };

  const columns = [
    {
      title: t('resource.host.columns.id'),
      sorter: true,
      width: 80,
      render: (_: any, record: any) => {
        return record.host.bk_host_id;
      },
    },
    {
      title: t('resource.host.columns.innerIpv4'),
      sorter: true,
      render: (_: any, record: any) => {
        return record.host.bk_host_innerip;
      },
    },
    {
      title: t('resource.host.columns.innerIpv6'),
      sorter: true,
      render: (_: any, record: any) => {
        return record.host.bk_host_innerip_v6 || '--';
      },
    },
    {
      title: t('resource.host.columns.cloudArea'),
      render: (_: any, record: any) => {
        const cloudInfo = record.host.bk_cloud_id;
        const region =
          cloudInfo.length > 0 ? (
            <span>{`${cloudInfo[0].bk_inst_name}[${cloudInfo[0].bk_inst_id}]`}</span>
          ) : null;
        return region;
      },
    },
    {
      title: t('resource.host.columns.businessTopology'),
      render: (_: any, record: any) => {
        const topo = record.module.length > 0 ? record.module[0].topo_module_name : '';
        return topo.replace(/##/g, '/');
      },
    },
    {
      title: t('resource.host.columns.cloudHostStatus'),
      sorter: true,
      render: (_: any, record: any) => {
        return record.host.bk_cloud_host_status || '--';
      },
    },
  ];

  const getTransferDropdownMenu = () => {
    const items: MenuItemProps[] = [];

    transferBaseMenuItems.forEach((base) => {
      let disabled = false;
      let tip: string | undefined;

      if (
        base.key === TransferMenuItemType.hostPool ||
        base.key === TransferMenuItemType.otherBusiness
      ) {
        disabled = hostsNotInIdlePool;
        tip =
          base.key === TransferMenuItemType.hostPool
            ? t('resource.host.tooltips.onlyIdleHostsToHostPool')
            : t('resource.host.tooltips.onlyIdleHostsCrossBusiness');
      }

      if (disabled) {
        items.push({
          ...base,
          label: (
            <Tooltip title={disabled ? tip : undefined} styles={{ root: { maxWidth: 'none' } }}>
              {t(base.label)}
            </Tooltip>
          ),
          disabled,
        });
      } else {
        items.push({
          ...base,
          label: t(base.label),
        });
      }
    });
    return { items };
  };

  return (
    <div className="host-list-wrapper">
      <div className="host-list-header">
        <div className="header-left">
          {tabKey === TabsKey.Unassigned && (
            <Button
              type="primary"
              onClick={() => setImportModalVisible(true)}
              disabled={!canWrite}
            >
              {t('resource.host.actions.importHost')}
            </Button>
          )}

          {tabKey !== TabsKey.Assigned && (
            <Dropdown
              menu={{
                items: resourceAssignMenuItems.map((item) => ({
                  ...item,
                  label: t(item.label),
                })),
                onClick: (e) => setAssignType(e.key as AssignType),
              }}
              trigger={['click']}
            >
              <Tooltip
                title={isHostPoolHost ? t('resource.host.tooltips.onlyHostPoolHosts') : undefined}
                styles={{ root: { maxWidth: 'none' } }}
              >
                <Button disabled={!canWrite || selectedRowKeys.length === 0 || isHostPoolHost}>
                  {t('resource.host.actions.assignTo')} <DownOutlined />
                </Button>
              </Tooltip>
            </Dropdown>
          )}

          {tabKey !== TabsKey.Unassigned && (
            <Dropdown
              menu={{
                ...getTransferDropdownMenu(),
                onClick: (e) => handleTransferMenuClick(e.key),
              }}
              trigger={['click']}
            >
              <Tooltip
                title={
                  hostsNotAllInBizPool ? t('resource.host.tooltips.onlyBusinessHosts') : undefined
                }
                styles={{ root: { maxWidth: 'none' } }}
              >
                <Button
                  disabled={!canWrite || selectedRowKeys.length === 0 || hostsNotAllInBizPool}
                >
                  {t('resource.host.actions.transferTo')} <DownOutlined />
                </Button>
              </Tooltip>
            </Dropdown>
          )}

          <Dropdown
            menu={{
              items: resourceCopyMenuItems.map((item: any) => ({
                ...item,
                label: t(item.label),
                children: item.children?.map((child: any) => ({
                  ...child,
                  label: t(child.label),
                })),
              })),
              onClick: ({ key }) => handleCopyMenuClick(key as ResourceCopyKey),
            }}
            trigger={['click']}
            overlayStyle={{ width: 190 }}
          >
            <Button disabled={selectedRowKeys.length === 0}>
              {t('resource.host.actions.copy')} <DownOutlined />
            </Button>
          </Dropdown>

          {tabKey === TabsKey.Unassigned && canWrite && (
            <Dropdown
              menu={{
                items: resourceMoreMenuItems.map((item) => ({
                  ...item,
                  label: t(item.label),
                  disabled: selectedRowKeys.length === 0,
                })),
                onClick: ({ key }) => handleMoreMenuClick(key as ResourceMoreKey),
              }}
              trigger={['click']}
            >
              <Button>
                {t('resource.host.actions.more')} <DownOutlined />
              </Button>
            </Dropdown>
          )}
        </div>

        <div className="header-right">
          <Input.Search
            placeholder={t('resource.host.search.placeholder')}
            style={{ width: 300, marginRight: 8 }}
          />
          <Tooltip title={t('resource.host.tooltips.viewDeleteHistory')}>
            <Button icon={<HistoryOutlined />} onClick={handleDeleteHistory} />
          </Tooltip>
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={hostsList}
        loading={tabKey === TabsKey.Unassigned ? poolHostLoading : generalHostLoading}
        rowKey={(record) => record.host.bk_host_id}
        showSorterTooltip={false}
        pagination={false}
        rowSelection={{
          selectedRowKeys,
          onChange: (rowKeys, rows) => handleSelectedRows(rowKeys, rows),
        }}
      />

      <Pagination
        total={tabKey === TabsKey.Unassigned ? poolHostTotal : generalHostTotal}
        pageSize={query.pageSize}
        current={query.page}
        onChange={(nextPage, nextPageSize) =>
          setPoolHostQuery({
            page: nextPage,
            pageSize: nextPageSize,
          })
        }
        onSizeChange={(_, size) => {
          setPoolHostQuery({
            page: 1,
            pageSize: size,
          });
        }}
      />

      {/* Assign host modal */}
      <AssignModal
        assignType={assignType}
        selectedRowKeys={selectedRowKeys}
        hostPoolStatuses={hostPoolStatuses}
        onClose={() => setAssignType(AssignType.None)}
      />

      {/* Transfer host modal */}
      <TransferHostModal
        visible={transferModalVisible}
        transferType={transferModalType}
        selectedHosts={hostIdleStatuses}
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

      {/* Import Host Drawer */}
      <ImportHost
        visible={importModalVisible}
        selectedDirId={selectedId}
        onClose={() => setImportModalVisible(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
};

export default HostList;
