import React, { useCallback, useEffect, useState } from "react";
import { Table, Button, Input, Dropdown, Space, message, Modal } from "antd";
import { DownOutlined, ExclamationCircleFilled } from "@ant-design/icons";
import { idleHostMock, dbaHostMock, devHostMock } from "@/mock/resource";
import { resourceAssignMenuItems, resourceCopyMenuItems, resourceMoreMenuItems } from '../../constants';
import { ResourceCopyKey, ResourceMoreKey } from '../../Types';
import Pagination from "@/components/common/Pagination";
import { AssignType, TabsKey } from "../../Types";
import "./style.css";
import AssignModal from "../components/AssignModal";
import { getHostCopyValue } from "../../utils";
import { useTranslation } from "react-i18next";

interface HostListProps {
    selectedId?: number;
    tabKey: TabsKey;
}

const PAGE_SIZE = 20;

const HostList: React.FC<HostListProps> = ({ selectedId }) => {
    const { t } = useTranslation();
    const { confirm } = Modal;
    const [assignType, setAssignType] = useState<AssignType>(AssignType.None);
    const [hostsList, setHostsList] = useState<any>([]);
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
        setHostsList(hostMock);
    }, [selectedId])

    const handleSelectedRows = (rowKeys: any, rows: any) => {
        setSelectedRowKeys(rowKeys);
        console.log(rowKeys, rows);
    }

    const handleCopyHostData = useCallback((copyKey: ResourceCopyKey) => {
        if (!selectedRowKeys.length) return;
        const selectedHosts = hostsList.filter((h: any) => selectedRowKeys.includes(h.host.bk_host_id));

        const text = selectedHosts.map((rec: any) => getHostCopyValue(rec, copyKey)).join('\n');
        if (!text) {
            message.warning('无可复制内容');
            return;
        }
        navigator.clipboard?.writeText(text).then(() => {
            message.success('复制成功');
        }).catch(() => {
            message.error('复制失败');
        });
    }, [hostsList, selectedRowKeys]);

    const handleMoreMenuClick = (key: ResourceMoreKey) => {
        if (key === ResourceMoreKey.Delete) {
            confirm({
                title: '确定删除选中的主机？',
                icon: <ExclamationCircleFilled />,
                okText: t("common.confirm"),
                cancelText: t("common.cancel"),
                onOk() {
                    // TODO: api
                    message.success('删除成功');
                },
                onCancel() { },
            });
        }
    }

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
                            items: resourceAssignMenuItems.map(it => ({
                                ...it,
                                disabled: selectedRowKeys.length === 0
                            })),
                            onClick: (e) => {
                                setAssignType(e.key as AssignType);
                            }
                        }}
                        trigger={['click']}
                    >
                        <Button disabled={selectedRowKeys.length === 0}>
                            <Space>
                                分配到
                                <DownOutlined />
                            </Space>
                        </Button>
                    </Dropdown>

                    <Dropdown
                        menu={{
                            items: resourceCopyMenuItems.map(it => ({
                                ...it,
                                disabled: selectedRowKeys.length === 0
                            })),
                            onClick: ({ key }) => handleCopyHostData(key as ResourceCopyKey)
                        }}
                        trigger={['click']}
                        overlayStyle={{ width: 190 }}
                    >
                        <Button disabled={selectedRowKeys.length === 0}>
                            复制
                            <Space>
                                <DownOutlined />
                            </Space>
                        </Button>
                    </Dropdown>

                    <Dropdown
                        menu={{
                            items: resourceMoreMenuItems.map(it => ({
                                ...it,
                                disabled: selectedRowKeys.length === 0
                            })),
                            onClick: ({ key }) => handleMoreMenuClick(key as ResourceMoreKey)
                        }}
                        trigger={['click']}
                    >
                        <Button>
                            更多
                            <Space>
                                <DownOutlined />
                            </Space>
                        </Button>
                    </Dropdown>
                </div>

                <div className="header-right">
                    <Input.Search
                        placeholder="请输入IP或资源编号"
                        style={{ width: 220, marginRight: 8 }}
                    />
                    <Button icon={<span className="iconfont icon-refresh" />}>已删除</Button>
                </div>
            </div>

            <Table
                columns={columns}
                dataSource={hostsList}
                rowKey={(record) => record.host.bk_host_id}
                showSorterTooltip={false}
                pagination={false}
                rowSelection={{
                    selectedRowKeys,
                    onChange: (rowKeys, rows) => handleSelectedRows(rowKeys, rows)
                }}
            />

            <Pagination
                total={hostsList.length}
                pageSize={pageSize}
                current={page}
                onChange={setPage}
                onSizeChange={(_, size) => {
                    setPage(1);
                    setPageSize(size);
                }}
            />

            {/* Assign host modal */}
            <AssignModal
                assignType={assignType}
                selectedRowKeys={selectedRowKeys}
                onClose={() => setAssignType(AssignType.None)}
            />
        </div>
    );
};

export default HostList;
