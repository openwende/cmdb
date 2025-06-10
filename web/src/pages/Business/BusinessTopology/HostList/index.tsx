import React, { useState } from 'react';
import { Table, Button, Dropdown, Input, message, Tooltip } from 'antd';
import { DownOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import { allHosts2 } from '@/mock/business';
import Pagination from '@/components/common/Pagination';
import {
  AddHostItem,
  AppendMenuItemKey,
  DropdownMenuType,
  MoreMenuItemKey,
  RemoveMenuItemKey,
  TopoTreeNodeType,
  TransferMenuItemKey,
  TreeData
} from '../../Types';
import AddHostModal from '../components/AddHostModal';
import { useTransferHostStore } from '@/store/TransferHostStore';
import { transferHostPath } from '../index';
import './style.css';
import { useNavigate } from 'react-router-dom';

interface Props {
  selectedNode: TreeData | null;
}

const HostList: React.FC<Props> = ({ selectedNode }) => {
  const navigate = useNavigate();
  const { setTransferData } = useTransferHostStore();

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [current, setCurrent] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const handleMenuClick = (key: string) => {
    message.info(`${key}`);
  };

  const handleAddHost = () => {
    setAddModalVisible(true);
  };

  const handleTransferHost = (hosts: AddHostItem[]) => {
    setTransferData(hosts, selectedNode);
    navigate(transferHostPath);
  }

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
        { key: TransferMenuItemKey.IdlePool, label: '空闲机池' },
        { key: TransferMenuItemKey.Business, label: '业务模块' },
        { key: TransferMenuItemKey.HostPool, label: '主机池', disabled: selectedNode?.type === TopoTreeNodeType.Idle },
        { key: TransferMenuItemKey.Other, label: '其他业务', disabled: selectedNode?.type === TopoTreeNodeType.Idle }
      );
    } else if (type === DropdownMenuType.Append) {
      items.push(
        { key: AppendMenuItemKey.Business, label: '业务模块' },
      );
    } else if (type === DropdownMenuType.Remove) {
      items.push(
        { key: RemoveMenuItemKey.Current, label: '当前模块' },
      );
    } else if (type === DropdownMenuType.Copy) {
      items.push(
        { key: 'id', label: 'ID' },
      );
    } else if (type === DropdownMenuType.More) {
      items.push(
        { key: MoreMenuItemKey.ExportSelected, label: '导出选中', disabled: selectedRowKeys.length === 0 },
        { key: MoreMenuItemKey.ExportAll, label: '导出全部' },
        { key: MoreMenuItemKey.ImportExcel, label: '导入excel更新' }
      )
    }

    return { items };
  };

  return (
    <div className='list-wrapper'>
      {/* The operation botton bar */}
      <div className='operation-bar'>
        {selectedNode?.type === TopoTreeNodeType.Module ? (
          <Button type="primary" onClick={handleAddHost}>新增</Button>
        ) : (
          <Tooltip title="仅能在业务模块下新增">
            <Button type="primary" disabled>新增</Button>
          </Tooltip>
        )}

        <Button
          disabled={selectedRowKeys.length === 0}
        >
          编辑
        </Button>

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

        <Dropdown
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

        <Dropdown
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

      {/* Add host modal */}
      <AddHostModal
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        onConfirm={handleTransferHost}
      />
    </div>
  );
};

export default HostList;