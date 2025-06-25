import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Table, Button, Dropdown, Input, message, Tooltip, Empty, Typography } from 'antd';
import { DownOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
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
  TreeData
} from '../../Types';
import AddHostModal from '../components/AddHostModal';
import { useTransferHostStore } from '@/store/TransferHostStore';
import { transferHostPath } from '../index';
import TransferHostModal from '../components/TransferHostModal';
import ReleaseHostModal from '../components/ReleaseHostModal';
import './style.css';
import { checkHostsInIdlePool, findNodeAndParents } from '../../utils';
import CreateNodeModal from '../components/CreateNodeModal';

interface Props {
  selectedNodes: TreeData[];
  treeData: TreeData[];
}

const HostList: React.FC<Props> = ({ selectedNodes, treeData }) => {
  const navigate = useNavigate();
  const { idleSetID, setTransferHostData } = useTransferHostStore();
  const [searchParams] = useSearchParams();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [transferModalType, setTransferModalType] = useState<TransferMenuItemType>();
  const [releaseModalVisible, setReleaseModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);

  const hostIdleStatuses = checkHostsInIdlePool(selectedRowKeys, allHosts2, idleSetID);
  const hostsNotInIdlePool = hostIdleStatuses.some(item => item.inIdlePool === false);

  const handleMenuClick = (key: string) => {
    if (key === TransferMenuItemType.hostPool) {
      setReleaseModalVisible(true);
    } else {
      setTransferModalVisible(true);
      setTransferModalType(key as TransferMenuItemType);
    }
  };

  const handleAddHosts = () => {
    setAddModalVisible(true);
  };

  const handleNavToTransferPage = () => {
    navigate(transferHostPath + '?' + searchParams.toString());
  }

  const handleConfirmAddHosts = useCallback((hosts: TransferHostItem[]) => {
    if (selectedNodes.length > 0) setTransferHostData(hosts, selectedNodes);
    handleNavToTransferPage();
  }, [selectedNodes])

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

  const columns = [
    {
      title: 'ID',
      dataIndex: ['host', 'bk_host_id'],
      render: (id: number) => <a>{id}</a>
    },
    {
      title: '内网IPv4',
      dataIndex: ['host', 'bk_host_innerip'],
    },
    {
      title: '内网IPv6',
      dataIndex: ['host', 'bk_host_innerip_v6'],
      render: (text: string) => text || '--'
    },
    {
      title: "管控区域",
      render: (_: any, record: any) => {
        const cloudInfo = record.host.bk_cloud_id;
        const region = cloudInfo.length > 0
          ? <span>{`${cloudInfo[0].bk_inst_name}[${cloudInfo[0].bk_inst_id}]`}</span>
          : null;
        return region;
      }
    },
    {
      title: '模块名（模块）',
      render: (_: any, record: any) => {
        const moduleInfo = record.module;
        return moduleInfo.length > 0 ? <span>{moduleInfo[0].bk_module_name}</span> : '--';
      }
    },
    {
      title: '集群名（集群）',
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
      items.push(
        { key: TransferMenuItemType.idlePool, label: '空闲机池' },
        { key: TransferMenuItemType.businessModule, label: '业务模块' },
        {
          key: TransferMenuItemType.hostPool,
          label: hostsNotInIdlePool
            ? <Tooltip title='主机需在“空闲机池”下才允许转移至主机池' styles={{ root: { maxWidth: 'none' } }}>主机池</Tooltip>
            : '主机池',
          disabled: hostsNotInIdlePool,
        },
        {
          key: TransferMenuItemType.otherBusiness,
          label: hostsNotInIdlePool
            ? <Tooltip title='主机需在“空闲机池”下才允许转移至其他业务' styles={{ root: { maxWidth: 'none' } }}>其他业务</Tooltip>
            : '其他业务',
          disabled: hostsNotInIdlePool
        }
      );
    } else if (type === DropdownMenuType.Append) {
      items.push({ key: AppendMenuItemKey.Business, label: '业务模块' });
    } else if (type === DropdownMenuType.Remove) {
      items.push({ key: RemoveMenuItemKey.Current, label: '当前模块' });
    } else if (type === DropdownMenuType.Copy) {
      items.push({ key: 'id', label: 'ID' });
    } else if (type === DropdownMenuType.More) {
      items.push(
        { key: MoreMenuItemKey.ExportSelected, label: '导出选中', disabled: selectedRowKeys.length === 0 },
        { key: MoreMenuItemKey.ExportAll, label: '导出全部' },
        { key: MoreMenuItemKey.ImportExcel, label: '导入excel更新' }
      )
    }

    return { items };
  };

  const selectedNodeStatus = useMemo(() => {
    if (!selectedNodes || selectedNodes.length === 0) {
      return {
        isModule: false,
        isIdle: false,
      };
    }
    const node = selectedNodes[0];

    return {
      isModule: node.type === TopoTreeNodeType.Module,
      isIdle: node.type === TopoTreeNodeType.Idle,
    };
  }, [selectedNodes]);

  const isEmptySet = useMemo(() => {
    if (!selectedNodes || selectedNodes.length === 0) {
      return false;
    }

    const node = selectedNodes[0];
    // The key is formatted as "<type>-<id>" (e.g., "set-1")
    const keyParts = node.key.split('-');
    if (keyParts.length !== 2) {
      return false;
    }

    const isSetType = keyParts[0] === TopoTreeNodeType.Set;
    const hasNoChildren = !node.children || node.children.length === 0;
    return isSetType && hasNoChildren;
  }, [selectedNodes]);

  const { node: targetNode, parents: parentNodes } = useMemo(() => {
    if (!selectedNodes || selectedNodes.length === 0) {
      return { node: null, parents: [] };
    }
    return findNodeAndParents(treeData, selectedNodes[0].key);
  }, [selectedNodes, treeData]);

  return (
    <>
      {
        isEmptySet ? <Empty
          className='empty-wrapper'
          description={<Typography.Text>该集群尚未创建模块</Typography.Text>}
        >
          <Button type="primary" onClick={() => setCreateModalVisible(true)}>立即创建</Button>
        </Empty> : <div className='list-wrapper'>
          {/* The operation botton bar */}
          <div className='operation-bar'>
            {selectedNodeStatus.isModule ? (
              <Button type="primary" onClick={handleAddHosts}>新增</Button>
            ) : (
              <Tooltip title="仅能在业务模块下新增">
                <Button type="primary" disabled>新增</Button>
              </Tooltip>
            )}

            <Button disabled={selectedRowKeys.length === 0}>编辑</Button>

            <Dropdown
              menu={{
                ...getDropdownMenu(DropdownMenuType.Transfer),
                onClick: ({ key }) => handleMenuClick(key)
              }}
              trigger={['click']}
            >
              <Button disabled={selectedRowKeys.length === 0}>
                转移至 <DownOutlined />
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
                  追加至 <DownOutlined />
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
                  移出 <DownOutlined />
                </Button>
              </Dropdown>
            }

            <Dropdown
              menu={{
                ...getDropdownMenu(DropdownMenuType.Copy),
                onClick: ({ key }) => handleMenuClick(key)
              }}
              trigger={['click']}
            >
              <Button disabled={selectedRowKeys.length === 0}>
                复制 <DownOutlined />
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
                更多 <DownOutlined />
              </Button>
            </Dropdown>

            <div className='search-bar'>
              <Input.Search
                placeholder="请输入IP或资源编号"
                style={{ width: 220 }}
                onSearch={(value) => message.info(`搜索: ${value}`)}
              />
              <Button icon={<FilterOutlined />} />
              <Button icon={<ReloadOutlined />} />
            </div>
          </div>

          <Table
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys
            }}
            columns={columns}
            dataSource={allHosts2}
            rowKey={(record) => record.host.bk_host_id}
            pagination={false}
          />

          <div className='pagination-wrapper'>
            <span>已选择 <span className='selected-count'>{selectedRowKeys.length}</span> 条</span>
            <Pagination
              total={allHosts2.length}
              pageSize={pageSize}
              current={current}
              onChange={(page, size) => {
                setCurrent(page);
                setPageSize(size);
              }}
              onSizeChange={(_, size) => {
                setPageSize(size);
                setCurrent(1);
              }}
            />
          </div>
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
      {targetNode && (
        <CreateNodeModal
          visible={createModalVisible}
          type={TopoTreeNodeType.Module}
          selectedNode={targetNode}
          parentNodes={parentNodes}
          onClose={() => setCreateModalVisible(false)}
        />
      )}
    </>
  );
};

export default HostList;