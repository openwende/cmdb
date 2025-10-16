import React, { useEffect, useState } from "react";
import { Table, Input, Space, message, Popconfirm, Modal, Form } from "antd";
import { useTranslation } from "react-i18next";
import Pagination from "@/components/common/Pagination";
import { archivedBusinessListMock } from "@/mock/resource";
import dayjs from 'dayjs';
import "./style.css";

const PAGE_SIZE = 20;

const ArchivedBusiness: React.FC = () => {
    const { t } = useTranslation();
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
            title: t('resource.business.archived.columns.id'),
            dataIndex: "bk_biz_id",
            sorter: true,
            width: 100,
        },
        {
            title: t('resource.business.archived.columns.name'),
            dataIndex: "bk_biz_name",
            sorter: true,
            width: 300,
        },
        {
            title: t('resource.business.archived.columns.maintainer'),
            dataIndex: "bk_biz_maintainer",
            sorter: true,
            width: 240,
        },
        {
            title: t('resource.business.archived.columns.createdAt'),
            dataIndex: "bk_created_at",
            sorter: true,
            width: 240,
            render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: t('resource.business.archived.columns.createdBy'),
            dataIndex: "bk_created_by",
            sorter: true,
            width: 240,
        },
        {
            title: t('resource.business.archived.columns.updatedAt'),
            dataIndex: "bk_updated_at",
            sorter: true,
            width: 240,
            render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: t('resource.business.archived.columns.updatedBy'),
            dataIndex: "bk_updated_by",
            sorter: true,
            width: 240,
        },
        {
            title: t('resource.business.archived.columns.archivedAt'),
            dataIndex: "archived_at",
            sorter: true,
            width: 240,
            render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: t('resource.business.archived.columns.actions'),
            dataIndex: "action",
            render: (_: string, record: any) => (
                <Space>
                    <a onClick={() => handleRestore(record)}>{t('resource.business.archived.actions.restore')}</a>
                    <Popconfirm
                        title={t('resource.business.archived.deleteConfirm.title')}
                        description={t('resource.business.archived.deleteConfirm.description')}
                        onConfirm={() => confirmDelete(record)}
                        okText={t("common.confirm")}
                        cancelText={t("common.cancel")}
                    >
                        <a className="delete-link">{t('resource.business.archived.actions.delete')}</a>
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
        form.validateFields().then(() => {
            // API call to restore the business would go here
            message.success(t('resource.business.archived.messages.restoreSuccess'));

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
        message.success(t('resource.business.archived.messages.deleteSuccess'));

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
                        style={{ width: 248 }}
                        placeholder={t('resource.business.archived.search.placeholder')}
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
                title={t('resource.business.archived.restoreModal.title')}
                open={restoreModalVisible}
                onOk={confirmRestore}
                onCancel={() => { setRestoreModalVisible(false) }}
                okText={t("common.confirm")}
                cancelText={t("common.cancel")}
                maskClosable={false}
                width={400}
            >
                <Form
                    form={form}
                    layout="vertical"
                >
                    <Form.Item
                        name="businessName"
                        label={t('resource.business.archived.restoreModal.nameLabel')}
                        rules={[{ required: true, message: t('common.form.rulesMessage') }]}
                    >
                        <Input placeholder={t('resource.business.archived.restoreModal.namePlaceholder')} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default ArchivedBusiness;