import React from "react";
import { Table } from "antd";

const columns = [
  { title: "IP", dataIndex: "ip", key: "ip" },
  { title: "主机名", dataIndex: "name", key: "name" }
];

interface Props {
  hosts: any[];
}

const HostTable: React.FC<Props> = ({ hosts }) => (
  <Table
    dataSource={hosts}
    columns={columns}
    rowKey="id"
    pagination={{ pageSize: 20 }}
    bordered
  />
);

export default HostTable;