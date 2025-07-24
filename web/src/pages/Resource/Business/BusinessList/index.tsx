import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Table, Button, Input, Select, Tooltip, Space, message } from "antd";
import Pagination from "@/components/common/Pagination";
import ConfirmModal from "@/components/common/ConfirmModal";
import { businessListMock } from "@/mock/resource";
import ModifyDrawer from "../components/ModifyDrawer";
import "./style.css";
import { HistoryOutlined } from "@ant-design/icons";
import {archivedBusinessPath} from "../index";
import dayjs from 'dayjs';

const { Option } = Select;

const PAGE_SIZE = 10;

const BusinessList: React.FC = () => {
     const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [businessCount, setBusinessCount] = useState(0);
    const [businessList, setBusinessList] = useState<any>([]);
    const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
    const [drawerVisible, setDrawerVisible] = useState(false);
    const [drawerType, setDrawerType] = useState<"create" | "edit">("create");
    const [archiveModalVisible, setArchiveModalVisible] = useState(false);
    const [archivingBusiness, setArchivingBusiness] = useState<any>(null);
    const [archivedBusinessIds, setArchivedBusinessIds] = useState<number[]>([]);

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
            render: (_: string, record: any) => (
                <a onClick={() => handleArchive(record)}>归档</a>
            ),
        },
    ];

    useEffect(() => {
        const filteredData = businessListMock.info.filter(
            (business: any) => !archivedBusinessIds.includes(business.bk_biz_id)
        );
        const data = filteredData.slice((page - 1) * pageSize, page * pageSize);
        setBusinessList(data);
        setBusinessCount(filteredData.length);
    }, [businessListMock, page, pageSize, archivedBusinessIds])

    const handleCreate = () => {
        setDrawerType("create");
        setDrawerVisible(true);
    }

    const handleEdit = () => {
        setDrawerType("edit");
        setDrawerVisible(true);
    }

    const handleArchive = (business: any) => {
        console.log(business);
        setArchivingBusiness(business);
        setArchiveModalVisible(true);
    }

    const confirmArchive = () => {
        console.log('Archiving business:', archivingBusiness);
        // API call to archive the business would go here
        message.success('归档成功');

        // Add the business ID to the archived list
        setArchivedBusinessIds(prev => [...prev, archivingBusiness.bk_biz_id]);

        // Remove the archived business from the table
        const updatedList = businessList.filter(
            (item: any) => item.bk_biz_id !== archivingBusiness.bk_biz_id
        );
        setBusinessList(updatedList);

        setArchiveModalVisible(false);
        setArchivingBusiness(null);
    }

    const handleArchivedBusiness = () => {
        navigate(archivedBusinessPath);
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
                        <Button icon={<HistoryOutlined />} onClick={handleArchivedBusiness} />
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

            {/* Archive confirmation modal */}
            <ConfirmModal
                visible={archiveModalVisible}
                title={`确认要归档${archivingBusiness?.bk_biz_name || ''}`}
                description="归档后SaaS将不可访问其下资源，包括作业任务、监控配置等，是否确认不再使用此业务？"
                okText="确定"
                cancelText="取消"
                onOk={confirmArchive}
                onCancel={() => setArchiveModalVisible(false)}
            />
        </div>
    );
};

export default BusinessList;