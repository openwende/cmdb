import React, { useEffect, useState } from "react";
import { Table, Button, Input, Select, Alert, Space, message } from "antd";
import dayjs from 'dayjs';
import Pagination from "@/components/common/Pagination";
import EmptySearchResult from "@/components/common/EmptySearchResult";
import ConfirmModal from "@/components/common/ConfirmModal";
import DynamicGroupForm, { FormMode } from "../components/DynamicGroupForm";
import { dynamicGroupList } from "@/mock/business";
import "./style.css";

const { Option } = Select;

const PAGE_SIZE = 20;

// Search field options for dynamic groups
const searchFieldOptions = [
    { value: "id", label: "ID" },
    { value: "name", label: "分组名称" },
    { value: "bk_obj_id", label: "查询对象" },
    { value: "modify_user", label: "修改人" }
];

const DynamicGroup: React.FC = () => {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [groupCount, setGroupCount] = useState(0);
    const [groupList, setGroupList] = useState<any>([]);
    const [searchField, setSearchField] = useState<string>(searchFieldOptions[0].value);
    const [searchText, setSearchText] = useState<string>("");
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [alertVisible, setAlertVisible] = useState(true);
    const [editingGroup, setEditingGroup] = useState<any>(null);
    const [drawerVisible, setDrawerVisible] = useState<boolean>(false);
    const [formMode, setFormMode] = useState<FormMode>(FormMode.CREATE);
    const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
    const [deletingGroup, setDeletingGroup] = useState<{ id: string; name: string } | null>(null);

    // Find current field option
    const currentFieldOption = searchFieldOptions.find(option => option.value === searchField);

    const columns = [
        {
            title: "分组名称",
            dataIndex: "name",
            sorter: true,
            width: 200,
        },
        {
            title: "ID",
            dataIndex: "id",
            width: 300,
        },
        {
            title: "查询对象",
            dataIndex: "bk_obj_id",
            sorter: true,
            width: 150,
            render: (val: string) => val === 'host' ? '主机' : val
        },
        {
            title: "创建用户",
            dataIndex: "create_user",
            sorter: true,
            width: 150,
        },
        {
            title: "创建时间",
            dataIndex: "create_time",
            sorter: true,
            width: 180,
            render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: "修改人",
            dataIndex: "modify_user",
            sorter: true,
            width: 150,
        },
        {
            title: "修改时间",
            dataIndex: "last_time",
            sorter: true,
            width: 180,
            render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss')
        },
        {
            title: "操作",
            dataIndex: "action",
            width: 150,
            render: (_: string, record: any) => (
                <Space size="small">
                    <Button
                        type="link"
                        size="small"
                        onClick={() => handlePreview(record)}
                    >
                        预览
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        onClick={() => handleEdit(record)}
                    >
                        编辑
                    </Button>
                    <Button
                        type="link"
                        size="small"
                        danger
                        onClick={() => handleDeleteClick(record)}
                    >
                        删除
                    </Button>
                </Space>
            ),
        },
    ];

    useEffect(() => {
        handleGroupData();
    }, []);

    const handleGroupData = () => {
        // Filter and search data
        let filteredData = dynamicGroupList.info;

        setIsSearching(true);
        // TODO: Replace with API call
        console.log('Search Parameters for API:', {
            field: searchField,
            textValue: searchText,
            pagination: {
                page,
                pageSize
            }
        });
        setIsSearching(false);

        setGroupCount(filteredData.length);
        const data = filteredData.slice((page - 1) * pageSize, page * pageSize);
        setGroupList(data);
    }

    const handleCreate = () => {
        setEditingGroup(null);
        setFormMode(FormMode.CREATE);
        setDrawerVisible(true);
    };

    const handlePreview = (record: any) => {
        setEditingGroup(record);
        setFormMode(FormMode.PREVIEW);
        setDrawerVisible(true);
    };

    const handleEdit = (record: any) => {
        setEditingGroup(record);
        setFormMode(FormMode.EDIT);
        setDrawerVisible(true);
    };

    const handleDeleteClick = (record: any) => {
        setDeletingGroup({
            id: record.id,
            name: record.name
        });
        setShowConfirmModal(true);
    };

    const handleDelete = () => {
        if (deletingGroup) {
            // TODO: Call API to delete the group in background
            // Remove the item from local data directly
            const updatedList = groupList.filter((item: any) => {
                return item.id !== deletingGroup.id;
            });
            setGroupList(updatedList);
            setGroupCount(prev => prev - 1);
        }

        setShowConfirmModal(false);
        setDeletingGroup(null);
        message.success('删除成功');
    };

    const handleDeleteCancel = () => {
        setShowConfirmModal(false);
        setDeletingGroup(null);
    };

    const handleDrawerClose = () => {
        setEditingGroup(null);
        setFormMode(FormMode.CREATE);
        setDrawerVisible(false);
    };

    const handleTextSearch = (value: string) => {
        setSearchText(value);
        setPage(1);
    };

    const handleFieldChange = (value: string) => {
        setSearchField(value);
        setSearchText("");
    };

    const clearSearch = () => {
        setSearchText("");
        setPage(1);
    };

    const getFormTitle = () => {
        switch (formMode) {
            case FormMode.PREVIEW:
                return '动态分组详情';
            case FormMode.EDIT:
                return '编辑动态分组';
            case FormMode.CREATE:
            default:
                return '创建动态分组';
        }
    };

    return (
        <div className="dynamic-group">
            {/* Alert notification */}
            {alertVisible && (
                <Alert
                    message={
                        <span>
                            动态分组目前仅提供主机文档的操作条件，在编辑SaaS中可以访问其下资源，包括作业任务、监控配置等。
                            <a href="#" style={{ marginLeft: 8 }}>查看详情 &gt;</a>
                        </span>
                    }
                    type="info"
                    showIcon
                    closable
                    onClose={() => setAlertVisible(false)}
                    style={{ marginBottom: 16 }}
                />
            )}

            {/* Header with create button and search */}
            <div className="dynamic-group-header">
                <div className="header-operation">
                    <Button
                        type="primary"
                        onClick={handleCreate}
                    >
                        新建
                    </Button>
                </div>
                <div className="header-search">
                    <Space.Compact>
                        <Select
                            className="search-select"
                            onChange={handleFieldChange}
                            value={searchField}
                        >
                            {searchFieldOptions.map(option => (
                                <Option key={option.value} value={option.value}>{option.label}</Option>
                            ))}
                        </Select>
                        <Input.Search
                            className="search-input"
                            placeholder={`请输入${currentFieldOption?.label}`}
                            allowClear
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            onSearch={handleTextSearch}
                        />
                    </Space.Compact>
                </div>
            </div>

            {/* Table */}
            <Table
                columns={columns}
                dataSource={groupList}
                showSorterTooltip={false}
                rowKey="id"
                bordered={true}
                pagination={false}
                locale={{
                    emptyText: isSearching && groupList.length === 0 ?
                        <EmptySearchResult onClearFilter={clearSearch} /> :
                        undefined
                }}
            />

            {/* Pagination */}
            <Pagination
                total={groupCount}
                pageSize={pageSize}
                current={page}
                onChange={setPage}
                onSizeChange={(_, size) => {
                    setPage(1);
                    setPageSize(size);
                }}
            />

            {/* Dynamic Group Form */}
            <DynamicGroupForm
                visible={drawerVisible}
                mode={formMode}
                title={getFormTitle()}
                initialData={editingGroup}
                onClose={handleDrawerClose}
                onDataChange={handleGroupData}
                onModeChange={setFormMode}
            />

            {/* Delete Confirm Modal */}
            <ConfirmModal
                visible={showConfirmModal}
                onOk={handleDelete}
                onCancel={handleDeleteCancel}
                title="确定删除"
                description={`确认要删除"${deletingGroup?.name}"分组?`}
            />
        </div>
    );
};

export default DynamicGroup;