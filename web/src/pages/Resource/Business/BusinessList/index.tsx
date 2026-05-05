import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Table,
  Button,
  Input,
  Select,
  Tooltip,
  Space,
  DatePicker,
  Spin,
  Empty,
} from 'antd';
import { useAppMessage } from '@/utils/message';
import { HistoryOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import Pagination from '@/components/common/Pagination';
import ConfirmModal from '@/components/common/ConfirmModal';
import ModifyDrawer from '../components/ModifyDrawer';
import { getBusinessList, updateBusiness } from '@/api';
import './style.css';
import { archivedBusinessPath, businessDetailPath } from '../index';
import dayjs from 'dayjs';
import { searchFieldOptions, LIFECYCLE } from '../../constants';
import { CREATE_TYPES } from '@/constants/business';
import { BusinessDetail } from '@/api/types/resource';
import { useAuthStore } from '@/store/AuthStore';

const { Option } = Select;

const PAGE_SIZE = 20;

const BusinessList: React.FC = () => {
  const { t } = useTranslation();
  const message = useAppMessage();
  const navigate = useNavigate();
  const location = useLocation();
  const canWrite = useAuthStore((state) => state.canWrite());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [businessCount, setBusinessCount] = useState(0);
  const [businessList, setBusinessList] = useState<BusinessDetail[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerType, setDrawerType] = useState<'create' | 'edit'>('create');
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);
  const [archivingBusiness, setArchivingBusiness] = useState<BusinessDetail | null>(null);
  const [searchField, setSearchField] = useState<string>(searchFieldOptions[1].value);
  const [searchText, setSearchText] = useState<string>('');
  const [searchDateRange, setSearchDateRange] = useState<
    [dayjs.Dayjs | null, dayjs.Dayjs | null] | null
  >(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Find current field option
  const currentFieldOption = searchFieldOptions.find((option) => option.value === searchField);
  // Determine if the current search field is a date field
  const isDateField = currentFieldOption?.isDate === true;

  const columns = [
    {
      title: t('resource.business.columns.id'),
      dataIndex: 'id',
      sorter: true,
      width: 300,
      render: (val: number) => <a onClick={() => handleDetail(val)}>{val}</a>,
    },
    {
      title: t('resource.business.columns.name'),
      dataIndex: 'name',
      sorter: true,
      width: 300,
    },
    {
      title: t('resource.business.columns.maintainer'),
      dataIndex: 'sres',
      sorter: true,
      width: 300,
      render: (val: string[]) => (val && val.length > 0 ? val.join(', ') : '--'),
    },
    {
      title: t('resource.business.columns.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('resource.business.columns.createdBy'),
      dataIndex: 'created_by',
      key: 'created_by',
      width: 180,
      render: (text: string) => (text ? text : '--'),
    },
    {
      title: t('resource.business.columns.updatedAt'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 180,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: t('resource.business.columns.actions'),
      dataIndex: 'action',
      width: 160,
      render: (_: string, record: BusinessDetail) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => handleDetail(record.id)}>
            {t('resource.business.actions.viewDetail')}
          </Button>
          {canWrite && (
            <Button type="link" size="small" danger onClick={() => handleArchive(record)}>
              {t('resource.business.actions.archive')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const fetchBusinessList = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const { data } = await getBusinessList({
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      const activeBusinesses = data.items.filter(
        (item: BusinessDetail) => item.lifecycle !== LIFECYCLE.OFFLINE,
      );
      setBusinessList(activeBusinesses);
      setBusinessCount(data.total);
    } catch (error) {
      console.error(error);
      setFetchError(error instanceof Error ? error.message : t('common.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessList();
  }, [page, pageSize]);

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
    if (!canWrite) return;
    setDrawerType('create');
    setDrawerVisible(true);
  };

  const handleEdit = () => {
    if (!canWrite) return;
    setDrawerType('edit');
    setDrawerVisible(true);
  };

  const handleDetail = (id: number) => {
    navigate(`${businessDetailPath}/${id}`);
  };

  const handleArchive = (business: BusinessDetail) => {
    if (!canWrite) return;
    setArchivingBusiness(business);
    setArchiveModalVisible(true);
  };

  const confirmArchive = async () => {
    if (!canWrite || !archivingBusiness) return;
    try {
      const data = await updateBusiness(archivingBusiness.id, {
        ...archivingBusiness,
        lifecycle: LIFECYCLE.OFFLINE,
      });
      if (data.success) {
        message.success(t('resource.business.messages.archiveSuccess'));

        // Remove the archived business from the table
        const updatedList = businessList.filter(
          (item: BusinessDetail) => item.id !== archivingBusiness.id,
        );
        setBusinessList(updatedList);
        setBusinessCount(businessCount - 1);

        setArchiveModalVisible(false);
        setArchivingBusiness(null);
      } else {
        message.error(t('resource.business.messages.archiveFailed'));
      }
    } catch {
      message.error(t('resource.business.messages.archiveFailed'));
    }
  };

  const handleArchivedBusiness = () => {
    navigate(archivedBusinessPath);
  };

  const handleTextSearch = (value: string) => {
    setSearchText(value);
    setSearchDateRange(null);
    setPage(1);
    fetchBusinessList();
  };

  const handleDateRangeSearch = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (dates && dates[0] && dates[1]) {
      // Set start time to 00:00:00 and end time to 23:59:59
      const startDate = dates[0].startOf('day');
      const endDate = dates[1].hour(23).minute(59).second(59);
      setSearchDateRange([startDate, endDate]);
    } else {
      setSearchDateRange(dates);
    }
    setSearchText('');
    setPage(1);
    fetchBusinessList();
  };

  const handleFieldChange = (value: string) => {
    setSearchField(value);
    setSearchText('');
    setSearchDateRange(null);
  };

  const handleSuccess = () => {
    fetchBusinessList();
  };

  return (
    <div className="business-list">
        <div className="list-header">
        <div className="list-operation">
          <Button type="primary" onClick={handleCreate} disabled={!canWrite}>
            {t('resource.business.actions.create')}
          </Button>
          <Button disabled={!canWrite || selectedRowKeys.length === 0} onClick={handleEdit}>
            {t('resource.business.actions.batchEdit')}
          </Button>
        </div>
        <div className="list-search">
          <Space.Compact>
            <Select
              defaultValue="bk_biz_name"
              className="search-select"
              onChange={handleFieldChange}
              value={searchField}
              style={{ width: 132 }}
            >
              {searchFieldOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {t(option.label)}
                </Option>
              ))}
            </Select>
            {isDateField ? (
              <DatePicker.RangePicker
                className="search-date-picker"
                placeholder={[
                  t('resource.business.search.dateRange.startPlaceholder'),
                  t('resource.business.search.dateRange.endPlaceholder'),
                ]}
                format="YYYY-MM-DD HH:mm:ss"
                allowClear
                value={searchDateRange}
                onChange={handleDateRangeSearch}
              />
            ) : (
              <Input.Search
                className="search-input"
                placeholder={t('resource.business.search.placeholder', {
                  field: currentFieldOption ? t(currentFieldOption.label) : '',
                })}
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onSearch={handleTextSearch}
              />
            )}
          </Space.Compact>
          <Tooltip title={t('resource.business.tooltips.viewArchived')}>
            <Button icon={<HistoryOutlined />} onClick={handleArchivedBusiness} />
          </Tooltip>
        </div>
      </div>

      <Table
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        columns={columns}
        dataSource={businessList}
        showSorterTooltip={false}
        rowKey="id"
        bordered={true}
        pagination={false}
        locale={{
          emptyText: loading ? (
            <Spin className="table-spin" />
          ) : fetchError ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={fetchError}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('common.noData')}
            >
              {canWrite && (
                <Button
                  type="primary"
                  onClick={() => {
                    setDrawerType('create');
                    setDrawerVisible(true);
                  }}
                >
                  {t('resource.business.actions.create')}
                </Button>
              )}
            </Empty>
          ),
        }}
      />

      {!loading && businessList.length > 0 && (
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
      )}

      {/* Modify business drawer */}
      <ModifyDrawer
        visible={drawerVisible}
        type={drawerType}
        onClose={() => setDrawerVisible(false)}
        onSuccess={handleSuccess}
      />

      {/* Archive confirmation modal */}
      <ConfirmModal
        visible={archiveModalVisible}
        title={t('resource.business.messages.confirmArchiveTitle', {
          name: archivingBusiness?.name || '',
        })}
        description={t('resource.business.messages.confirmArchiveDescription')}
        onOk={confirmArchive}
        onCancel={() => setArchiveModalVisible(false)}
        okText={t('common.components.confirmModal.confirm')}
        cancelText={t('common.components.confirmModal.cancel')}
      />
    </div>
  );
};

export default BusinessList;
