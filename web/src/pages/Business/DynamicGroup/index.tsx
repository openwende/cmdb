import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Select, Alert, Space, message } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import Pagination from '@/components/common/Pagination';
import EmptySearchResult from '@/components/common/EmptySearchResult';
import ConfirmModal from '@/components/common/ConfirmModal';
import DynamicGroupForm, { FormMode } from './components';
import { dynamicGroupList } from '@/mock/business';
import './style.css';

const { Option } = Select;

const PAGE_SIZE = 20;

const DynamicGroup: React.FC = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [groupCount, setGroupCount] = useState(0);
  const [groupList, setGroupList] = useState<any>([]);
  const [searchField, setSearchField] = useState<string>('id');
  const [searchText, setSearchText] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [alertVisible, setAlertVisible] = useState(true);
  const [editingGroup, setEditingGroup] = useState<any>(null);
  const [drawerVisible, setDrawerVisible] = useState<boolean>(false);
  const [formMode, setFormMode] = useState<FormMode>(FormMode.CREATE);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [deletingGroup, setDeletingGroup] = useState<{ id: string; name: string } | null>(null);

  // Search field options for dynamic groups
  const searchFieldOptions = [
    { value: 'id', label: t('business.dynamicGroup.searchFields.id') },
    { value: 'name', label: t('business.dynamicGroup.searchFields.name') },
    { value: 'bk_obj_id', label: t('business.dynamicGroup.searchFields.bkObjId') },
    { value: 'modify_user', label: t('business.dynamicGroup.searchFields.modifyUser') },
  ];

  // Find current field option
  const currentFieldOption = searchFieldOptions.find((option) => option.value === searchField);

  const columns = [
    {
      title: t('business.dynamicGroup.columns.name'),
      dataIndex: 'name',
      sorter: true,
      width: 200,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      width: 300,
    },
    {
      title: t('business.dynamicGroup.columns.bkObjId'),
      dataIndex: 'bk_obj_id',
      sorter: true,
      width: 150,
      render: (val: string) => (val === 'host' ? t('business.dynamicGroup.objectTypes.host') : val),
    },
    {
      title: t('business.dynamicGroup.columns.createUser'),
      dataIndex: 'create_user',
      sorter: true,
      width: 150,
    },
    {
      title: t('business.dynamicGroup.columns.createTime'),
      dataIndex: 'create_time',
      sorter: true,
      width: 180,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('business.dynamicGroup.columns.modifyUser'),
      dataIndex: 'modify_user',
      sorter: true,
      width: 150,
    },
    {
      title: t('business.dynamicGroup.columns.lastTime'),
      dataIndex: 'last_time',
      sorter: true,
      width: 180,
      render: (val: string) => dayjs(val).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('business.dynamicGroup.columns.action'),
      dataIndex: 'action',
      width: 150,
      render: (_: string, record: any) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handlePreview(record)}>
            {t('business.dynamicGroup.actions.preview')}
          </Button>
          <Button type="link" size="small" onClick={() => handleEdit(record)}>
            {t('common.edit')}
          </Button>
          <Button type="link" size="small" danger onClick={() => handleDeleteClick(record)}>
            {t('common.delete')}
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
        pageSize,
      },
    });
    setIsSearching(false);

    setGroupCount(filteredData.length);
    const data = filteredData.slice((page - 1) * pageSize, page * pageSize);
    setGroupList(data);
  };

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
      name: record.name,
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
      setGroupCount((prev) => prev - 1);
    }

    setShowConfirmModal(false);
    setDeletingGroup(null);
    message.success(t('business.dynamicGroup.messages.deleteSuccess'));
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
    setSearchText('');
  };

  const clearSearch = () => {
    setSearchText('');
    setPage(1);
  };

  const getFormTitle = () => {
    switch (formMode) {
      case FormMode.PREVIEW:
        return t('business.dynamicGroup.titles.preview');
      case FormMode.EDIT:
        return t('business.dynamicGroup.titles.edit');
      case FormMode.CREATE:
      default:
        return t('business.dynamicGroup.titles.create');
    }
  };

  return (
    <div className="dynamic-group">
      {/* Alert notification */}
      {alertVisible && (
        <Alert
          message={
            <span>
              {t('business.dynamicGroup.alert.message')}
              <a href="#" style={{ marginLeft: 8 }}>
                {t('business.dynamicGroup.alert.linkText')} &gt;
              </a>
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
          <Button type="primary" onClick={handleCreate}>
            {t('business.dynamicGroup.actions.create')}
          </Button>
        </div>
        <div className="header-search">
          <Space.Compact>
            <Select className="search-select" onChange={handleFieldChange} value={searchField}>
              {searchFieldOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
            <Input.Search
              className="search-input"
              placeholder={t('business.dynamicGroup.searchPlaceholder', {
                field: currentFieldOption?.label,
              })}
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
          emptyText:
            isSearching && groupList.length === 0 ? (
              <EmptySearchResult onClearFilter={clearSearch} />
            ) : undefined,
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
        title={t('business.dynamicGroup.confirm.deleteTitle')}
        description={t('business.dynamicGroup.confirm.deleteDescription', {
          name: deletingGroup?.name,
        })}
        okText={t('common.components.confirmModal.confirm')}
        cancelText={t('common.components.confirmModal.cancel')}
      />
    </div>
  );
};

export default DynamicGroup;
