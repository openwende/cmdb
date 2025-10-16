import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Table, Button, Dropdown, Input, message, Tooltip, Empty, Typography } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { allHosts2 } from '@/mock/business';
import Pagination from '@/components/common/Pagination';
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
  CopyMenuItemKey as HostCopyKey
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

interface Props {
  selectedNode: TreeData;
  parentNodes: TreeData[];
}

const HostList: React.FC<Props> = ({ selectedNode, parentNodes }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { idleSetID, setTransferHostData } = useTransferHostStore();
  const [searchParams] = useSearchParams();

  const [searchValue, setSearchValue] = useState<string>("");
  const [hostsList, setHostsList] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferModalType, setTransferModalType] = useState<TransferHostType>();
  const [releaseModalVisible, setReleaseModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  useEffect(() => {
    // TODO: api
    setHostsList(allHosts2);
  }, [searchValue, currentPage, pageSize])

  const hostIdleStatuses = checkHostsInIdlePool(selectedRowKeys, hostsList, idleSetID);
  const hostsNotInIdlePool = hostIdleStatuses.some(item => item.inIdlePool === false);

  const copyHostData = useCallback((copyKey: HostCopyKey) => {
    if (!selectedRowKeys.length) return;
    const selectedHosts = hostsList.filter(h => selectedRowKeys.includes(h.host.bk_host_id));

    const text = selectedHosts.map(rec => getHostCopyValue(rec, copyKey)).join('\n');
    if (!text) {
      message.warning(t('resource.host.messages.noCopyContent'));
      return;
    }
    navigator.clipboard?.writeText(text).then(() => {
      message.success(t('resource.host.messages.copySuccess'));
    }).catch(() => {
      message.error(t('resource.host.messages.copyFailed'));
    });
  }, [selectedRowKeys]);

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
      Object.values(TransferMenuItemType).includes(key as TransferMenuItemType)
      || key === AppendMenuItemKey.AppendToBusinessModule
    ) {
      // Transfer and append menu item/
      setTransferModalVisible(true);
      setTransferModalType(key as TransferHostType);
    } else if (key === RemoveMenuItemKey.CurrentModule) {
      // Remove from current module
      const enrichedHosts: TransferHostItem[] = selectedRowKeys.map(id => {
        const hostInfo = hostsList.find(h => h.host.bk_host_id === id);
        const cloud = hostInfo?.host.bk_cloud_id?.[0];
        const region = cloud ? `${cloud.bk_inst_name}[${cloud.bk_inst_id}]` : '';
        return { id, ip: hostInfo?.host.bk_host_innerip || '', cloudInfo: region } as TransferHostItem;
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
  }

  const handleConfirmAddHosts = useCallback((hosts: TransferHostItem[]) => {
    setTransferHostData(hosts, [selectedNode]);
    handleNavToTransferPage();
  }, [selectedNode])

  const handleTransferHosts = useCallback((targetModules: TreeData[]) => {
    if (
      transferModalType === TransferMenuItemType.idlePool && !hostsNotInIdlePool
      || transferModalType === TransferMenuItemType.otherBusiness
    ) {
      // TODO: api
      setTransferModalVisible(false);
      return;
    }

    setTransferHostData(hostIdleStatuses, targetModules, transferModalType);
    handleNavToTransferPage();
  }, [transferModalType, hostsNotInIdlePool, hostIdleStatuses])

  const handleReleaseHosts = useCallback((dirId: number) => {
    // TODO: api
    // params: selectedRowKeys, dirId
    setReleaseModalVisible(false);
  }, [])

  const handleSearch = (value: string) => {
    setSearchValue(value);
  }

  const handleClearSearch = () => {
    setSearchValue('');
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: ['host', 'bk_host_id'],
      render: (id: number) => <a>{id}</a>
    },
    {
      title: t('resource.host.columns.innerIpv4'),
      dataIndex: ['host', 'bk_host_innerip'],
    },
    {
      title: t('resource.host.columns.innerIpv6'),
      dataIndex: ['host', 'bk_host_innerip_v6'],
      render: (text: string) => text || '--'
    },
    {
      title: t('resource.host.columns.cloudArea'),
      render: (_: any, record: any) => {
        const cloudInfo = record.host.bk_cloud_id;
        const region = cloudInfo.length > 0
          ? <span>{`${cloudInfo[0].bk_inst_name}[${cloudInfo[0].bk_inst_id}]`}</span>
          : null;
        return region;
      }
    },
    {
      title: t('business.topology.hostList.columns.moduleName'),
      render: (_: any, record: any) => {
        const moduleInfo = record.module;
        return moduleInfo.length > 0 ? <span>{moduleInfo[0].bk_module_name}</span> : '--';
      }
    },
    {
      title: t('business.topology.hostList.columns.clusterName'),
      render: (_: any, record: any) => {
        const setInfo = record.set;
        return setInfo.length > 0 ? <span>{setInfo[0].bk_set_name}</span> : '--';
      }
    }
  ];

  // The operation button menu
  const getDropdownMenu = (type: DropdownMenuType) => {
    const items = [];

    if (type === DropdownMenuType.Transfer) {
      transferBaseMenuItems.forEach(base => {
        const translatedLabel = base.key === TransferMenuItemType.idlePool
          ? t('business.topology.transferMenu.idlePool')
          : base.key === TransferMenuItemType.businessModule
            ? t('business.topology.transferMenu.businessModule')
            : base.key === TransferMenuItemType.hostPool
              ? t('business.topology.transferMenu.hostPool')
              : t('business.topology.transferMenu.otherBusiness');

        if (
          base.key === TransferMenuItemType.hostPool
          || base.key === TransferMenuItemType.otherBusiness
        ) {
          const disabled = hostsNotInIdlePool;
          const tip = base.key === TransferMenuItemType.hostPool
            ? t('business.topology.hostList.transfer.hostPoolTip')
            : t('business.topology.hostList.transfer.otherBusinessTip');
          items.push(
            {
              ...base,
              label: disabled
                ? <Tooltip title={tip} styles={{ root: { maxWidth: 'none' } }}>
                  {translatedLabel}
                </Tooltip>
                : translatedLabel,
              disabled
            }
          );
        } else {
          items.push({
            ...base,
            label: translatedLabel
          } as any);
        }
      });
    } else if (type === DropdownMenuType.Append) {
      items.push(
        {
          key: AppendMenuItemKey.AppendToBusinessModule,
          label: t('business.topology.hostList.menus.businessModule')
        }
      );
    } else if (type === DropdownMenuType.Remove) {
      items.push(
        {
          key: RemoveMenuItemKey.CurrentModule,
          label: t('business.topology.hostList.menus.currentModule')
        }
      );
    } else if (type === DropdownMenuType.Copy) {
      // Map copy menu items to use translations
      const translatedCopyItems = hostCopyMenuItems.map(item => {
        if ('children' in item && item.children) {
          return {
            ...item,
            label: t('business.topology.copyMenu.cloudIdGroup'),
            children: item.children.map(child => ({
              ...child,
              label: child.key === HostCopyKey.CloudIdIPv4
                ? t('business.topology.copyMenu.cloudIdIPv4')
                : child.key === HostCopyKey.CloudIdIPv6
                  ? t('business.topology.copyMenu.cloudIdIPv6')
                  : child.key === HostCopyKey.CloudIdIPIPv4First
                    ? t('business.topology.copyMenu.cloudIdIPIPv4First')
                    : t('business.topology.copyMenu.cloudIdIPIPv6First')
            }))
          };
        } else {
          const translatedLabel = item.key === HostCopyKey.Id
            ? 'ID'
            : item.key === HostCopyKey.IPv4
              ? t('business.topology.copyMenu.ipv4')
              : item.key === HostCopyKey.IPv6
                ? t('business.topology.copyMenu.ipv6')
                : item.key === HostCopyKey.CloudRegion
                  ? t('business.topology.copyMenu.cloudRegion')
                  : item.key === HostCopyKey.ModuleName
                    ? t('business.topology.copyMenu.moduleName')
                    : t('business.topology.copyMenu.setName');

          return {
            ...item,
            label: translatedLabel
          };
        }
      });
      items.push(...translatedCopyItems);
    } else if (type === DropdownMenuType.More) {
      items.push(
        {
          key: MoreMenuItemKey.ExportSelected,
          label: t('business.topology.hostList.menus.exportSelected'),
          disabled: selectedRowKeys.length === 0
        },
        {
          key: MoreMenuItemKey.ExportAll,
          label: t('business.topology.hostList.menus.exportAll')
        },
        {
          key: MoreMenuItemKey.ImportExcel,
          label: t('business.topology.hostList.menus.importExcel')
        }
      );
    }

    return { items };
  };

  const selectedNodeStatus = useMemo(() => {
    return getSelectedNodeStatus([selectedNode]);
  }, [selectedNode]);

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

  return (
    <>
      {
        isEmptySet ? <Empty
          className='empty-wrapper'
          description={<Typography.Text>
            {t('business.topology.hostList.empty.noModuleCreated')}
          </Typography.Text>}
        >
          <Button
            type="primary"
            onClick={() => setCreateModalVisible(true)}>
            {t('business.topology.hostList.empty.createNow')}
          </Button>
        </Empty> : <div className='list-wrapper'>
          {/* The operation botton bar */}
          <div className='operation-bar'>
            {selectedNodeStatus.isModule ? (
              <Button type="primary" onClick={handleAddHosts}>
                {t('business.topology.hostList.buttons.add')}
              </Button>
            ) : (
              <Tooltip title={t('business.topology.hostList.tooltips.onlyModuleCanAdd')}>
                <Button type="primary" disabled>
                  {t('business.topology.hostList.buttons.add')}
                </Button>
              </Tooltip>
            )}

            <Button disabled={selectedRowKeys.length === 0}>
              {t('business.topology.hostList.buttons.edit')}
            </Button>

            <Dropdown
              menu={{
                ...getDropdownMenu(DropdownMenuType.Transfer),
                onClick: ({ key }) => handleMenuClick(key)
              }}
              trigger={['click']}
            >
              <Button disabled={selectedRowKeys.length === 0}>
                {t('business.topology.hostList.buttons.transferTo')} <DownOutlined />
              </Button>
            </Dropdown>

            {
              !selectedNodeStatus.isIdle && <Dropdown
                menu={{
                  ...getDropdownMenu(DropdownMenuType.Append),
                  onClick: ({ key }) => handleMenuClick(key)
                }}
                trigger={['click']}
              >
                <Button disabled={selectedRowKeys.length === 0}>
                  {t('business.topology.hostList.buttons.appendTo')} <DownOutlined />
                </Button>
              </Dropdown>
            }


            {
              selectedNodeStatus.isModule && <Dropdown
                menu={{
                  ...getDropdownMenu(DropdownMenuType.Remove),
                  onClick: ({ key }) => handleMenuClick(key)
                }}
                trigger={['click']}
              >
                <Button disabled={selectedRowKeys.length === 0}>
                  {t('business.topology.hostList.buttons.removeFrom')} <DownOutlined />
                </Button>
              </Dropdown>
            }

            <Dropdown
              menu={{
                ...getDropdownMenu(DropdownMenuType.Copy),
                onClick: ({ key }) => handleMenuClick(key as HostCopyKey)
              }}
              overlayStyle={{ width: 190 }}
              trigger={['click']}
            >
              <Button disabled={selectedRowKeys.length === 0}>
                {t('business.topology.hostList.buttons.copy')} <DownOutlined />
              </Button>
            </Dropdown>

            <Dropdown
              menu={{
                ...getDropdownMenu(DropdownMenuType.More),
                onClick: ({ key }) => handleMenuClick(key)
              }}
              trigger={['click']}
            >
              <Button>
                {t('business.topology.hostList.buttons.more')} <DownOutlined />
              </Button>
            </Dropdown>

            <div className='search-bar'>
              <Input.Search
                placeholder={t('business.topology.hostList.search.placeholder')}
                style={{ width: 300 }}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onSearch={(value) => handleSearch(value)}
              />
            </div>
          </div>

          <Table
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys
            }}
            columns={columns}
            dataSource={hostsList}
            rowKey={(record) => record.host.bk_host_id}
            pagination={false}
            locale={{
              emptyText: searchValue && hostsList.length === 0
                ? <EmptySearchResult onClearFilter={handleClearSearch} />
                : undefined
            }
            }
          />

          {
            hostsList.length > 0 && <div className='pagination-wrapper'>
              <span>
                {t('business.topology.hostList.pagination.selected')}
                &nbsp;<span className='selected-count'>{selectedRowKeys.length}
                </span>
                &nbsp;{t('business.topology.hostList.pagination.items')}
              </span>
              <Pagination
                total={hostsList.length}
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
          }
        </div>
      }

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

      {/* Creating set and module modal*/}
      <CreateNodeModal
        visible={createModalVisible}
        type={TopoTreeNodeType.Module}
        selectedNode={selectedNode}
        parentNodes={parentNodes}
        onClose={() => setCreateModalVisible(false)}
      />
    </>
  );
};

export default HostList;