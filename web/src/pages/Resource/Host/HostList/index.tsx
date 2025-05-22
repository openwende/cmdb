import React, { useEffect, useState } from "react";
import { Table, Button, Input, Dropdown, Space } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { idleHostMock, dbaHostMock, devHostMock } from "@/mock/resource";
import Pagination from "@/components/common/Pagination";
import { AssignType, TabsKey } from "../../Types";
import "./style.css";
import AssignModal from "../components/AssignModal";

interface HostListProps {
    selectedId?: number;
    tabKey: TabsKey;
}

const PAGE_SIZE = 20;

const HostList: React.FC<HostListProps> = ({ selectedId }) => {
    // The dropdown menu state
    const [assignOpen, setAssignOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [copyOpen, setCopyOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [assignType, setAssignType] = useState<AssignType>(AssignType.None);
    // The table state
    const [hostList, setHostList] = useState<any>([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);

    useEffect(() => {
        let hostMock = [];
        switch (selectedId) {
            case 0:
                hostMock = idleHostMock.concat(dbaHostMock).concat(devHostMock);
                break;
            case 1:
                hostMock = idleHostMock;
                break;
            case 16:
                hostMock = dbaHostMock;
                break;
            case 11:
                hostMock = devHostMock;
                break;
            default:
                hostMock = idleHostMock;
        }
        setHostList(hostMock);
    }, [selectedId])

    const handleSelectedRows = (rowKeys: any, rows: any) => {
        setSelectedRowKeys(rowKeys);
        console.log(rowKeys, rows);
    }

    // The dropdown menu data
    const assignMenu = [
        {
            key: AssignType.Biz,
            label: "业务空闲机池",
            disabled: selectedRowKeys.length === 0
        },
        {
            key: AssignType.HostPool,
            label: "主机池其他目录",
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
            key: "delete",
            label: "删除"
        },
        {
            key: "exportSeleted",
            label: "导出选中"
        },
        {
            key: "exportAll",
            label: "导出全部"
        }
    ];

    const columns = [
        {
            title: "ID",
            sorter: true,
            width: 80,
            render: (_: any, record: any) => {
                return record.host.bk_host_id;
            }
        },
        {
            title: "内网IPv4",
            sorter: true,
            render: (_: any, record: any) => {
                return record.host.bk_host_innerip;
            }
        },
        {
            title: "内网IPv6",
            sorter: true,
            render: (_: any, record: any) => {
                return record.host.bk_host_innerip_v6 || "--";
            }
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
            title: "业务拓扑",
            render: (_: any, record: any) => {
                const topo = record.module.length > 0 ? record.module[0].topo_module_name : "";
                return topo.replace(/##/g, "/");
            }
        },
        {
            title: "云主机状态",
            sorter: true,
            render: (_: any, record: any) => {
                return record.host.bk_cloud_host_status || "--";
            }
        }
    ];

    return (
        <div className="host-list-wrapper">
            <div className="host-list-header">
                <div className="header-left">
                    <Button type="primary">导入主机</Button>
                    <Dropdown
                        menu={{
                            items: assignMenu, onClick: (e) => {
                                setAssignType(e.key as AssignType);
                                // setAssignOpen(true);
                            }
                        }}
                        trigger={['click']}
                    // open={assignOpen}
                    // onOpenChange={setAssignOpen}
                    >
                        <Button disabled={selectedRowKeys.length === 0}>
                            分配到
                            <Space>
                                <DownOutlined rotate={assignOpen ? 180 : 0} />
                            </Space>
                        </Button>
                    </Dropdown>
                    <Dropdown
                        menu={{ items: editMenu }}
                        trigger={['click']}
                        open={editOpen}
                        onOpenChange={setEditOpen}
                    >
                        <Button>
                            编辑
                            <Space>
                                <DownOutlined rotate={editOpen ? 180 : 0} />
                            </Space>
                        </Button>
                    </Dropdown>
                    <Dropdown
                        menu={{ items: copyMenu }}
                        trigger={['click']}
                        open={copyOpen}
                        onOpenChange={setCopyOpen}
                    >
                        <Button disabled={selectedRowKeys.length === 0}>
                            复制
                            <Space>
                                <DownOutlined rotate={copyOpen ? 180 : 0} />
                            </Space>
                        </Button>
                    </Dropdown>
                    <Dropdown
                        menu={{ items: moreMenu }}
                        trigger={['click']}
                        open={moreOpen}
                        onOpenChange={setMoreOpen}
                    >
                        <Button>
                            更多
                            <Space>
                                <DownOutlined rotate={moreOpen ? 180 : 0} />
                            </Space>
                        </Button>
                    </Dropdown>
                </div>
                <div className="header-right">
                    <Input.Search
                        placeholder="请输入IP或资源编号"
                        style={{ width: 220, marginLeft: "auto", marginRight: 8 }}
                    />
                    <Button icon={<span className="iconfont icon-filter" />}>过滤</Button>
                    <Button icon={<span className="iconfont icon-refresh" />}>已删除</Button>
                </div>
            </div>
            <Table
                columns={columns}
                dataSource={hostList}
                rowKey={(record) => record.host.bk_host_id}
                showSorterTooltip={false}
                pagination={false}
                rowSelection={{
                    selectedRowKeys,
                    onChange: (rowKeys, rows) => handleSelectedRows(rowKeys, rows)
                }}
            />
            <Pagination
                total={hostList.length}
                pageSize={pageSize}
                current={page}
                onChange={setPage}
                onSizeChange={(_, size) => {
                    setPage(1);
                    setPageSize(size);
                }}
            />
            <AssignModal
                assignType={assignType}
                selectedRowKeys={selectedRowKeys}
                onClose={() => setAssignType(AssignType.None)}
            />
        </div>
    );
};

export default HostList;
