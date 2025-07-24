import React, { useEffect, useState } from "react";
import { Table, Input, Space, message, Popconfirm, Modal, Form } from "antd";
import Pagination from "@/components/common/Pagination";
import { archivedBusinessListMock } from "@/mock/resource";
import dayjs from 'dayjs';
import "./style.css";

const PAGE_SIZE = 20;

const ArchivedBusiness: React.FC = () => {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [businessCount, setBusinessCount] = useState(0);
    const [businessList, setBusinessList] = useState<any>([]);
    const [restoreModalVisible, setRestoreModalVisible] = useState(false);
    const [currentBusiness, setCurrentBusiness] = useState<any>(null);
    const [searchText, setSearchText] = useState("");
    const [form] = Form.useForm();

    const columns = [
        {
            title: "ID",
            dataIndex: "bk_biz_id",
            sorter: true,
            width: 100,
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
            width: 240,
        },
        {
            title: "创建时间",
            dataIndex: "bk_created_at",
            sorter: true,
            width: 240,
            render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: "创建人",
            dataIndex: "bk_created_by",
            sorter: true,
            width: 240,
        },
        {
            title: "更新时间",
            dataIndex: "bk_updated_at",
            sorter: true,
            width: 240,
            render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: "更新人",
            dataIndex: "bk_updated_by",
            sorter: true,
            width: 240,
        },
        {
            title: "归档时间",
            dataIndex: "archived_at",
            sorter: true,
            width: 240,
            render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: "操作",
            dataIndex: "action",
            render: (_: string, record: any) => (
                <Space>
                    <a onClick={() => handleRestore(record)}>恢复业务</a>
                    <Popconfirm
                        title="确认彻底删除该业务？"
                        description="清除后将无法再恢复，请谨慎操作！"
                        onConfirm={() => confirmDelete(record)}
                        okText="确定"
                        cancelText="取消"
                    >
                        <a className="delete-link">彻底删除</a>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    useEffect(() => {
        let filteredData = [...archivedBusinessListMock.info];

        if (searchText) {
            // TODO: api
            filteredData = filteredData.filter((item: any) => {
                const fieldValue = String(item.bk_biz_name || '');
                return fieldValue.toLowerCase().includes(searchText.toLowerCase());
            });
        }

        setBusinessCount(filteredData.length);
        const data = filteredData.slice((page - 1) * pageSize, page * pageSize);
        setBusinessList(data);
    }, [page, pageSize, searchText]);

    const handleRestore = (business: any) => {
        setCurrentBusiness(business);
        form.setFieldsValue({
            businessName: business.bk_biz_name
        });
        setRestoreModalVisible(true);
    };

    const confirmRestore = () => {
        form.validateFields().then(values => {
            // API call to restore the business would go here
            message.success('业务恢复成功');

            // Remove the business from the list
            const updatedList = businessList.filter(
                (item: any) => item.bk_biz_id !== currentBusiness.bk_biz_id
            );
            setBusinessList(updatedList);

            setRestoreModalVisible(false);
            setCurrentBusiness(null);
        }).catch(error => {
            console.error('Validation failed:', error);
        });
    };

    const confirmDelete = (business: any) => {
        // API call to permanently delete the business would go here
        message.success('业务已彻底删除');

        // Remove the business from the list
        const updatedList = businessList.filter(
            (item: any) => item.bk_biz_id !== business.bk_biz_id
        );
        setBusinessList(updatedList);
    };

    const handleSearch = (value: string) => {
        setSearchText(value);
        setPage(1);
    };

    return (
        <div className="archived-business">
            <div className="list-header">
                <div className="list-search">
                    <Input.Search
                        style={{ width: 240 }}
                        placeholder="请输入业务名"
                        allowClear
                        onChange={(e) => handleSearch(e.target.value)}
                    />
                </div>
            </div>

            <Table
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

            {/* Restore business modal */}
            <Modal
                title="恢复业务"
                open={restoreModalVisible}
                onOk={confirmRestore}
                onCancel={() => { setRestoreModalVisible(false) }}
                okText="确定"
                cancelText="取消"
                maskClosable={false}
                width={400}
            >
                <Form
                    form={form}
                    layout="vertical"
                >
                    <Form.Item
                        name="businessName"
                        label="业务名"
                        rules={[{ required: true, message: '该字段为必填项' }]}
                    >
                        <Input placeholder="请输入业务名" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ArchivedBusiness;