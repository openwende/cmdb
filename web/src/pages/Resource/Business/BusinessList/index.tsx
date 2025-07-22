import React, { useEffect, useState } from "react";
import { Table, Button, Input, Select, Tooltip, Space } from "antd";
import Pagination from "@/components/common/Pagination";
import { businessListMock } from "@/mock/resource";
import ModifyDrawer from "../ModifyDrawer";
import "./style.css";
import { HistoryOutlined } from "@ant-design/icons";
import dayjs from 'dayjs';

const { Option } = Select;

const columns = [
    {
        title: "ID",
        dataIndex: "bk_biz_id",
        sorter: true,
        width: 300,
    },
    {
        title: "业务名",
        dataIndex: "bk_biz_name",
        sorter: true,
        width: 300,
    },
    {
        title: "运维人员",
        dataIndex: "bk_biz_maintainer",
        sorter: true,
        width: 300,
    },
    {
        title: "创建时间",
        dataIndex: "bk_created_at",
        sorter: true,
        width: 300,
        render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
    },
    {
        title: "创建人",
        dataIndex: "bk_created_by",
        sorter: true,
        width: 300,
    },
    {
        title: "更新时间",
        dataIndex: "bk_updated_at",
        sorter: true,
        width: 300,
        render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
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
    const [businessCount, setBusinessCount] = useState(0);
    const [businessList, setBusinessList] = useState<any>([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [drawerType, setDrawerType] = useState<"create" | "edit">("create");

    useEffect(() => {
        const data = businessListMock.info.slice((page - 1) * pageSize, page * pageSize);
        setBusinessList(data);
        setBusinessCount(businessListMock.count);
    }, [businessListMock, page, pageSize])

    const handleCreate = () => {
        setDrawerType("create");
        setDrawerVisible(true);
    }

    const handleEdit = () => {
        setDrawerType("edit");
        setDrawerVisible(true);
    }

    return (
        <div className="business-list">
            <div className="list-header">
                <div className="list-operation">
                    <Button
                        type="primary"
                        onClick={handleCreate}
                    >新建</Button>
                    <Button
                        disabled={selectedRowKeys.length === 0}
                        onClick={handleEdit}
                    >批量编辑</Button>
                </div>
                <div className="list-search">
                    <Space.Compact>
                        <Select defaultValue="业务名" style={{ width: 120 }}>
                            <Option value="name">业务名</Option>
                        </Select>
                        <Input style={{ width: 200 }} placeholder="请输入业务名" />
                    </Space.Compact>
                    <Tooltip title="查看已归档业务">
                        <Button icon={<HistoryOutlined />} />
                    </Tooltip>
                </div>
            </div>

            <Table
                rowSelection={{
                    selectedRowKeys,
                    onChange: setSelectedRowKeys
                }}
                columns={columns}
                dataSource={businessList}
                showSorterTooltip={false}
                rowKey="bk_biz_id"
                bordered={true}
                pagination={false}
            />

            <Pagination
                total={businessCount}
                pageSize={pageSize}
                current={page}
                onChange={setPage}
                onSizeChange={(_, size) => {
                    setPage(1);
                    setPageSize(size);
                }}
            />

            {/* Modify business drawer */}
            <ModifyDrawer
                visible={drawerVisible}
                type={drawerType}
                onClose={() => setDrawerVisible(false)}
            />
        </div>
    );
};

export default BusinessList;