import React, { useEffect, useState } from "react";
import { Table, Button, Input, Select } from "antd";
import Pagination  from "@/components/common/Pagination";
import { businessListMock } from "@/mock/resource";
import ModifyDrawer from "../ModifyDrawer";
import "./style.css";

const { Option } = Select;

const columns = [
    {
        title: "ID",
        dataIndex: "id",
        sorter: true,
        width: 80,
    },
    {
        title: "业务名",
        dataIndex: "name",
        sorter: true,
    },
    {
        title: "运维人员",
        dataIndex: "operator",
        sorter: true,
    },
    {
        title: "创建时间",
        dataIndex: "createTime",
        sorter: true,
    },
    {
        title: "创建人",
        dataIndex: "creator",
        sorter: true,
    },
    {
        title: "操作",
        dataIndex: "action",
        render: () => (
            <a>归档</a>
        ),
    },
];

const PAGE_SIZE = 10;

const BusinessList: React.FC = () => {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [tableData, setTableData] = useState<any>([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [drawerType, setDrawerType] = useState<"create" | "edit">("create");

    useEffect(() => {
        const data = businessListMock.slice((page - 1) * pageSize, page * pageSize);
        setTableData(data);
    }, [businessListMock, page, pageSize])

    return (
        <div className="business-list">
            <div className="list-header">
                <div className="list-operation">
                    <Button
                        type="primary"
                        style={{ marginRight: 8 }}
                        onClick={() => { setDrawerType("create"); setDrawerVisible(true); }}
                    >新建</Button>
                    <Button
                        style={{ marginRight: 16 }}
                        disabled={selectedRowKeys.length === 0}
                        onClick={() => { setDrawerType("edit"); setDrawerVisible(true); }}
                    >批量编辑</Button>
                </div>
                <div className="list-search">
                    <Input.Group compact>
                        <Select defaultValue="业务名" style={{ width: 120 }}>
                            <Option value="name">业务名</Option>
                        </Select>
                        <Input style={{ width: 200 }} placeholder="请输入业务名" />
                    </Input.Group>
                    <Button style={{ marginLeft: 8 }}>搜索</Button>
                    <Button style={{ marginLeft: 8 }} icon={<span className="iconfont icon-setting" />}></Button>
                </div>
            </div>
            <Table
                rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
                columns={columns}
                dataSource={tableData}
                showSorterTooltip={false}
                rowKey="id"
                bordered={true}
                pagination={false}
            />
            <div className="pagination-container">
                <Pagination
                    total={businessListMock.length}
                    pageSize={pageSize}
                    current={page}
                    onChange={setPage}
                    onSizeChange={(current, size) => {
                        setPage(1);
                        setPageSize(size);
                    }}
                />
            </div>
            <ModifyDrawer
                visible={drawerVisible}
                type={drawerType}
                onClose={() => setDrawerVisible(false)}
            />
        </div>
    );
};

export default BusinessList;