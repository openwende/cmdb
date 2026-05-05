import React, { useState, useCallback } from 'react';
import { Table, DatePicker, Input, Select, Empty, Button, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import DetailDrawer from '../components/OperationDetail';
import Pagination from '@/components/common/Pagination';
import { getCommonActions } from '@/pages/Analysis/constants';
import type { OperationDetail } from '@/pages/Analysis/Types';
import './style.css';

const { Option } = Select;

export interface AuditTableFilters {
  timeRange?: [string, string] | null;
  keyword?: string;
  actionType?: string;
}

export interface AuditTableProps {
  data: OperationDetail[];
  loading: boolean;
  pagination: {
    total: number;
    pageSize: number;
    page: number;
    onChange: (page: number, pageSize: number) => void;
    onSizeChange: (page: number, size: number) => void;
  };
  showFilters?: boolean;
  onFilter?: (filters: AuditTableFilters) => void;
}

const AuditTable: React.FC<AuditTableProps> = ({
  data = [],
  loading = false,
  pagination: { total, pageSize, page, onChange, onSizeChange },
  showFilters = true,
  onFilter,
}) => {
  const { t } = useTranslation();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<OperationDetail | null>(null);

  const [searchKeyword, setSearchKeyword] = useState('');
  const [timeRange, setTimeRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);
  const [actionType, setActionType] = useState<string | undefined>(undefined);

  const actionOptions = getCommonActions(t);

  const handleSearch = useCallback(() => {
    if (onFilter) {
      onFilter({
        keyword: searchKeyword || undefined,
        timeRange:
          timeRange && timeRange[0] && timeRange[1]
            ? [timeRange[0].format('YYYY-MM-DD'), timeRange[1].format('YYYY-MM-DD')]
            : undefined,
        actionType,
      });
    }
  }, [searchKeyword, timeRange, actionType, onFilter]);

  const handleRowClick = (record: OperationDetail) => {
    setSelectedRecord(record);
    setDrawerVisible(true);
  };

  const handleDrawerClose = () => {
    setDrawerVisible(false);
    setSelectedRecord(null);
  };

  const columns = [
    {
      title: t('analysis.audit.columns.object'),
      dataIndex: 'object',
      key: 'object',
      width: 120,
    },
    {
      title: t('analysis.audit.columns.action'),
      dataIndex: 'action',
      key: 'action',
      width: 100,
    },
    {
      title: t('analysis.audit.columns.business'),
      dataIndex: 'business',
      key: 'business',
      width: 150,
    },
    {
      title: t('analysis.audit.columns.instance'),
      dataIndex: 'instance',
      key: 'instance',
      width: 200,
    },
    {
      title: t('analysis.audit.columns.description'),
      dataIndex: 'description',
      key: 'description',
      width: 200,
    },
    {
      title: t('analysis.audit.columns.time'),
      dataIndex: 'time',
      key: 'time',
      width: 180,
    },
    {
      title: t('analysis.audit.columns.account'),
      dataIndex: 'account',
      key: 'account',
      width: 120,
    },
  ];

  return (
    <div className="audit-list">
      {showFilters && (
        <div className="list-header">
          <div className="list-search">
            <DatePicker.RangePicker
              allowClear
              className="search-date-picker"
              placeholder={[
                t('analysis.audit.placeholders.selectStartDate'),
                t('analysis.audit.placeholders.selectEndDate'),
              ]}
              format="YYYY-MM-DD"
              value={timeRange}
              onChange={(dates) => setTimeRange(dates)}
            />
            <Input.Search
              allowClear
              className="search-input"
              placeholder={t('analysis.audit.filters.keyword')}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onSearch={handleSearch}
            />
            <Select
              allowClear
              className="search-select"
              placeholder={t('analysis.audit.filters.actionType')}
              value={actionType}
              onChange={(value) => setActionType(value)}
            >
              {actionOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </div>
        </div>
      )}
      <div className="audit-list-table-shell">
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={false}
          rowKey="id"
          scroll={{ x: 1070 }}
          onRow={(record) => ({
            onClick: () => handleRowClick(record),
            style: { cursor: 'pointer' },
          })}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('analysis.audit.empty.noRecords', '暂无审计记录')}
              >
                {(searchKeyword || actionType || timeRange) && (
                  <Button
                    size="small"
                    onClick={() => {
                      setSearchKeyword('');
                      setActionType(undefined);
                      setTimeRange(null);
                      if (onFilter) onFilter({});
                    }}
                  >
                    {t('analysis.audit.empty.clearFilters', '清空筛选条件')}
                  </Button>
                )}
              </Empty>
            ),
          }}
        />
      </div>

      <div className="audit-mobile-list">
        {loading ? (
          <div className="audit-mobile-loading">
            <Spin />
          </div>
        ) : data.length > 0 ? (
          data.map((record) => (
            <button
              key={record.id}
              type="button"
              className="audit-mobile-card"
              onClick={() => handleRowClick(record)}
            >
              <span className="audit-mobile-card__head">
                <span className="audit-mobile-card__title">{record.object}</span>
                <span className="audit-mobile-card__action">{record.action}</span>
              </span>
              <span className="audit-mobile-card__desc">{record.description}</span>
              <span className="audit-mobile-card__grid">
                <span>
                  <span>{t('analysis.audit.columns.business')}</span>
                  <span>{record.business || '--'}</span>
                </span>
                <span>
                  <span>{t('analysis.audit.columns.instance')}</span>
                  <span>{record.instance || '--'}</span>
                </span>
                <span>
                  <span>{t('analysis.audit.columns.time')}</span>
                  <span>{record.time || '--'}</span>
                </span>
                <span>
                  <span>{t('analysis.audit.columns.account')}</span>
                  <span>{record.account || '--'}</span>
                </span>
              </span>
            </button>
          ))
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('analysis.audit.empty.noRecords', '暂无审计记录')}
          />
        )}
      </div>
      <Pagination
        total={total}
        pageSize={pageSize}
        current={page}
        onChange={onChange}
        onSizeChange={onSizeChange}
      />

      <DetailDrawer visible={drawerVisible} record={selectedRecord} onClose={handleDrawerClose} />
    </div>
  );
};

export default AuditTable;
