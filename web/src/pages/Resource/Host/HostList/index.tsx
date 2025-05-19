import React, { useState } from "react";
import { Table, Button, Input, Dropdown, Menu } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { hostListMock } from "@/mock/resource";
import Pagination from "@/components/common/Pagination";

const PAGE_SIZE = 20;

const HostList: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [page, setPage] = useState(1);

  // 下拉菜单展开状态
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // 分页数据
  const data = hostListMock.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // 下拉菜单
  const assignMenu = (
    <Menu>
      <Menu.Item key="assign1" disabled={selectedRowKeys.length === 0}>分配到目录1</Menu.Item>
      <Menu.Item key="assign2" disabled={selectedRowKeys.length === 0}>分配到目录2</Menu.Item>
    </Menu>
  );
  const editMenu = (
    <Menu>
      <Menu.Item key="batchEdit" disabled={selectedRowKeys.length === 0}>批量编辑</Menu.Item>
      <Menu.Item key="importEdit">导入编辑</Menu.Item>
    </Menu>
  );
  const copyMenu = (
    <Menu>
      <Menu.Item key="copy1" disabled={selectedRowKeys.length === 0}>复制1</Menu.Item>
      <Menu.Item key="copy2" disabled={selectedRowKeys.length === 0}>复制2</Menu.Item>
    </Menu>
  );
  const moreMenu = (
    <Menu>
      <Menu.Item key="more1">更多操作1</Menu.Item>
      <Menu.Item key="more2">更多操作2</Menu.Item>
    </Menu>
  );

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      sorter: true,
      width: 80,
      render: (id: number) => <a>{id}</a>
    },
    {
      title: "内网IPv4",
      dataIndex: "ipv4"
    },
    {
      title: "内网IPv6",
      dataIndex: "ipv6"
    },
    {
      title: "管控区域",
      dataIndex: "region"
    },
    {
      title: "业务拓扑",
      dataIndex: "topo"
    },
    {
      title: "云主机状态",
      dataIndex: "cloudStatus"
    }
  ];

  return (
    <div style={{ background: "#fff", borderRadius: 4, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
        <Button type="primary" style={{ marginRight: 8 }}>导入主机</Button>
        <Dropdown
          overlay={assignMenu}
          trigger={['click']}
          open={assignOpen}
          onOpenChange={setAssignOpen}
        >
          <Button
            style={{ marginRight: 8 }}
            disabled={selectedRowKeys.length === 0}
          >
            分配到 <DownOutlined rotate={assignOpen ? 180 : 0} />
          </Button>
        </Dropdown>
        <Dropdown
          overlay={editMenu}
          trigger={['click']}
          open={editOpen}
          onOpenChange={setEditOpen}
        >
          <Button style={{ marginRight: 8 }}>
            编辑 <DownOutlined rotate={editOpen ? 180 : 0} />
          </Button>
        </Dropdown>
        <Dropdown
          overlay={copyMenu}
          trigger={['click']}
          open={copyOpen}
          onOpenChange={setCopyOpen}
        >
          <Button
            style={{ marginRight: 8 }}
            disabled={selectedRowKeys.length === 0}
          >
            复制 <DownOutlined rotate={copyOpen ? 180 : 0} />
          </Button>
        </Dropdown>
        <Dropdown
          overlay={moreMenu}
          trigger={['click']}
          open={moreOpen}
          onOpenChange={setMoreOpen}
        >
          <Button style={{ marginRight: 8 }}>
            更多 <DownOutlined rotate={moreOpen ? 180 : 0} />
          </Button>
        </Dropdown>
        <Input.Search
          placeholder="请输入IP或资源编号"
          style={{ width: 220, marginLeft: "auto", marginRight: 8 }}
        />
        <Button icon={<span className="iconfont icon-filter" />} style={{ marginRight: 8 }} />
        <Button icon={<span className="iconfont icon-refresh" />} />
      </div>
      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys
        }}
        columns={columns}
        dataSource={data}
        rowKey="id"
        bordered
        pagination={false}
      />
      <div style={{ marginTop: 8, display: "flex", alignItems: "center" }}>
        <span>共计 {hostListMock.length} 条，每页 </span>
        <span style={{ margin: "0 8px" }}>
          <Pagination
            total={hostListMock.length}
            pageSize={PAGE_SIZE}
            current={page}
            onChange={setPage}
            onSizeChange={(current, size) => { /* 可扩展 */ }}
          />
        </span>
        <span>已选择 {selectedRowKeys.length} 条</span>
      </div>
    </div>
  );
};

export default HostList;
