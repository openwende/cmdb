import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Table, Button, Input, Select, Tooltip, Space, message } from "antd";
import { DatePicker } from "antd";
import { useTranslation } from "react-i18next";
import Pagination from "@/components/common/Pagination";
import ConfirmModal from "@/components/common/ConfirmModal";
import EmptySearchResult from "@/components/common/EmptySearchResult";
import { businessListMock } from "@/mock/resource";
import ModifyDrawer from "../components/ModifyDrawer";
import "./style.css";
import { HistoryOutlined } from "@ant-design/icons";
import { archivedBusinessPath } from "../index";
import dayjs from 'dayjs';
import { searchFieldOptions } from "../../constants";
import { CREATE_TYPES } from "@/constants/business";

const { Option } = Select;

const PAGE_SIZE = 10;

const BusinessList: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
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
    const [searchField, setSearchField] = useState<string>(searchFieldOptions[1].value);
    const [searchText, setSearchText] = useState<string>("");
    const [searchDateRange, setSearchDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
    const [isSearching, setIsSearching] = useState<boolean>(false);

    // Find current field option
    const currentFieldOption = searchFieldOptions.find(option => option.value === searchField);
    // Determine if the current search field is a date field
    const isDateField = currentFieldOption?.isDate === true;

    const columns = [
        {
            title: t('resource.business.columns.id'),
            dataIndex: "bk_biz_id",
            sorter: true,
            width: 300,
        },
        {
            title: t('resource.business.columns.name'),
            dataIndex: "bk_biz_name",
            sorter: true,
            width: 300,
        },
        {
            title: t('resource.business.columns.maintainer'),
            dataIndex: "bk_biz_maintainer",
            sorter: true,
            width: 300,
        },
        {
            title: t('resource.business.columns.created_at'),
            dataIndex: "bk_created_at",
            sorter: true,
            width: 300,
            render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: t('resource.business.columns.created_by'),
            dataIndex: "bk_created_by",
            sorter: true,
            width: 300,
        },
        {
            title: t('resource.business.columns.updated_at'),
            dataIndex: "bk_updated_at",
            sorter: true,
            width: 300,
            render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: t('resource.business.columns.actions'),
            dataIndex: "action",
            render: (_: string, record: any) => (
                <a onClick={() => handleArchive(record)}>{t('resource.business.actions.archive')}</a>
            ),
        },
    ];

    useEffect(() => {
        // First filter out archived businesses
        let filteredData = businessListMock.info.filter(
            (business: any) => !archivedBusinessIds.includes(business.bk_biz_id)
        );

        setIsSearching(true);
        // TODO: api
        console.log('Search Parameters for API:', {
            field: searchField,
            textValue: searchText,
            dateRange: searchDateRange ? {
                startDate: searchDateRange[0]?.format('YYYY-MM-DD HH:mm:ss'),
                endDate: searchDateRange[1]?.format('YYYY-MM-DD HH:mm:ss')
            } : null,
            pagination: {
                page,
                pageSize
            }
        });
        setIsSearching(false);

        setBusinessCount(filteredData.length);
        const data = filteredData.slice((page - 1) * pageSize, page * pageSize);
        setBusinessList(data);
    }, [businessListMock, page, pageSize, archivedBusinessIds, searchField, searchText, searchDateRange])

    // Handle URL parameters to auto-open drawer
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const createType = searchParams.get('create');

        if (Number(createType) === CREATE_TYPES.BUSINESS) {
            setDrawerType('create');
            setDrawerVisible(true);
        }
    }, [location.search, navigate]);

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
        message.success(t('resource.business.messages.archive_success'));

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

    const handleTextSearch = (value: string) => {
        setSearchText(value);
        setSearchDateRange(null);
        setPage(1);
    }

    const handleDateRangeSearch = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
        setSearchDateRange(dates);
        setSearchText("");
        setPage(1);
    }

    const handleFieldChange = (value: string) => {
        setSearchField(value);
        setSearchText("");
        setSearchDateRange(null);
    }

    const clearSearch = () => {
        setSearchText("");
        setSearchDateRange(null);
        setPage(1);
    }

    return (
        <div className="business-list">
            <div className="list-header">
                <div className="list-operation">
                    <Button
                        type="primary"
                        onClick={handleCreate}
                    >{t('resource.business.actions.create')}</Button>
                    <Button
                        disabled={selectedRowKeys.length === 0}
                        onClick={handleEdit}
                    >{t('resource.business.actions.batch_edit')}</Button>
                </div>
                <div className="list-search">
                    <Space.Compact>
                        <Select
                            defaultValue="bk_biz_name"
                            className="search-select"
                            onChange={handleFieldChange}
                            value={searchField}
                        >
                            {searchFieldOptions.map(option => (
                                <Option key={option.value} value={option.value}>{t(option.label)}</Option>
                            ))}
                        </Select>
                        {isDateField ? (
                            <DatePicker.RangePicker
                                className="search-date-picker"
                                placeholder={[
                                    t('resource.business.search.date_range.start_placeholder'),
                                    t('resource.business.search.date_range.end_placeholder')
                                ]}
                                allowClear
                                value={searchDateRange}
                                onChange={handleDateRangeSearch}
                            />
                        ) : (
                            <Input.Search
                                className="search-input"
                                placeholder={
                                    t('resource.business.search.placeholder',
                                        { field: currentFieldOption ? t(currentFieldOption.label) : '' }
                                    )}
                                allowClear
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                onSearch={handleTextSearch}
                            />
                        )}
                    </Space.Compact>
                    <Tooltip title={t('resource.business.tooltips.view_archived')}>
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
                locale={{
                    emptyText: isSearching && businessList.length === 0 ?
                        <EmptySearchResult onClearFilter={clearSearch} /> :
                        undefined
                }}
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
                title={t('resource.business.messages.confirm_archive_title', { name: archivingBusiness?.bk_biz_name || '' })}
                description={t('resource.business.messages.confirm_archive_description')}
                onOk={confirmArchive}
                onCancel={() => setArchiveModalVisible(false)}
            />
        </div>
    );
};

export default BusinessList;