import React, { useState } from "react";
import { Table, Button, Input, Dropdown } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { hostListMock } from "@/mock/resource";
import Pagination from "@/components/common/Pagination";
import "./style.css";

const PAGE_SIZE = 20;

const HostList: React.FC = () => {
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);

    // The dropdown menu expanded state
    const [assignOpen, setAssignOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [copyOpen, setCopyOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);

    // The pagination data
    const data = hostListMock.slice((page - 1) * pageSize, page * pageSize);

    // The dropdown menu data
    const assignMenu = [
        {
            key: "assign1",
            label: "分配到目录1",
            disabled: selectedRowKeys.length === 0
        },
        {
            key: "assign2",
            label: "分配到目录2",
            disabled: selectedRowKeys.length === 0
        }
    ];
    const editMenu = [
        {
            key: "batchEdit",
            label: "批量编辑",
            disabled: selectedRowKeys.length === 0
        },
        {
            key: "importEdit",
            label: "导入编辑"
        }
    ];
    const copyMenu = [
        {
            key: "copy1",
            label: "复制1",
            disabled: selectedRowKeys.length === 0
        },
        {
            key: "copy2",
            label: "复制2",
            disabled: selectedRowKeys.length === 0
        }
    ];
    const moreMenu = [
        {
            key: "more1",
            label: "更多操作1"
        },
        {
            key: "more2",
            label: "更多操作2"
        }
    ];

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
        <div className="host-list-wrapper">
            <div className="host-list-header">
                <div className="header-left">
                    <Button type="primary" style={{ marginRight: 8 }}>导入主机</Button>
                    <Dropdown
                        menu={{ items: assignMenu }}
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
                        menu={{ items: editMenu }}
                        trigger={['click']}
                        open={editOpen}
                        onOpenChange={setEditOpen}
                    >
                        <Button style={{ marginRight: 8 }}>
                            编辑 <DownOutlined rotate={editOpen ? 180 : 0} />
                        </Button>
                    </Dropdown>
                    <Dropdown
                        menu={{ items: copyMenu }}
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
                        menu={{ items: moreMenu }}
                        trigger={['click']}
                        open={moreOpen}
                        onOpenChange={setMoreOpen}
                    >
                        <Button style={{ marginRight: 8 }}>
                            更多 <DownOutlined rotate={moreOpen ? 180 : 0} />
                        </Button>
                    </Dropdown>
                </div>
                <div className="header-right">
                    <Input.Search
                        placeholder="请输入IP或资源编号"
                        style={{ width: 220, marginLeft: "auto", marginRight: 8 }}
                    />
                    <Button icon={<span className="iconfont icon-filter" />} style={{ marginRight: 8 }}>过滤</Button>
                    <Button icon={<span className="iconfont icon-refresh" />}>已删除</Button>
                </div>
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
            <div className="pagination-wrapper">
                <Pagination
                    total={hostListMock.length}
                    pageSize={pageSize}
                    current={page}
                    onChange={setPage}
                    onSizeChange={(current, size) => {
                        setPage(1);
                        setPageSize(size);
                    }}
                />
            </div>
        </div>
    );
};

export default HostList;
