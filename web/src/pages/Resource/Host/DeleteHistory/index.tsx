import React, { useEffect, useMemo, useState } from 'react';
import { Table, DatePicker, Input } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import type { RangePickerProps } from 'antd/es/date-picker';
import { useTranslation } from 'react-i18next';
import Pagination from '@/components/common/Pagination';
import { deleteHistoryMock } from '@/mock/resource';
import OperationDetails from '../components/OperationDetails';
import './style.css';

const { RangePicker } = DatePicker;

export interface DeleteHistoryItem {
  id: number;
  resource_id: number;
  resource_name: string;
  operation_time: string;
  user: string;
}

const PAGE_SIZE = 20;

const DeleteHistory: React.FC = () => {
  const { t } = useTranslation();
  const [deleteList, setDeleteList] = useState<DeleteHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [keyword, setKeyword] = useState<string>('');
  const [timeRange, setTimeRange] = useState<Dayjs[] | null>(null);
  // drawer state
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRow, setSelectedRow] = useState<DeleteHistoryItem | null>(null);

  // init mock
  useEffect(() => {
    setDeleteList(deleteHistoryMock.info as DeleteHistoryItem[]);
  }, []);

  useEffect(() => {
    const params = {
      operation_time: {},
      keyword,
      page,
      pageSize,
    };

    if (timeRange && timeRange.length === 2) {
      params.operation_time = {
        start: dayjs(timeRange[0]).startOf('day').format('YYYY-MM-DD HH:mm:ss'),
        end: dayjs(timeRange[1]).endOf('day').format('YYYY-MM-DD HH:mm:ss'),
      };
    }

    // TODO: api
    console.log('request params', params);
  }, [timeRange, keyword, page, pageSize]);

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return deleteList.slice(start, start + pageSize);
  }, [deleteList, page, pageSize]);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'resource_id',
      width: 500,
    },
    {
      title: 'IP',
      dataIndex: 'resource_name',
      width: 500,
    },
    {
      title: t('resource.host.deleteHistory.columns.updateTime'),
      dataIndex: 'operation_time',
    },
    {
      title: t('resource.host.deleteHistory.columns.operationAccount'),
      dataIndex: 'user',
    },
  ];

  const handleDateChange: RangePickerProps['onChange'] = (vals) => {
    if (!vals || vals.length < 2) {
      setTimeRange(null);
    } else {
      setTimeRange([vals[0] as Dayjs, vals[1] as Dayjs]);
    }
    setPage(1);
  };

  return (
    <div className="delete-history-wrapper">
      {/* Operation bar */}
      <div className="operation-bar">
        <RangePicker value={timeRange as any} onChange={handleDateChange} />
        <Input.Search
          placeholder={t('resource.host.deleteHistory.search.placeholder')}
          allowClear
          onSearch={(val) => {
            setKeyword(val);
            setPage(1);
          }}
        />
      </div>

      <Table
        columns={columns}
        dataSource={pageData}
        rowKey={(rec) => rec.id}
        pagination={false}
        className="delete-list"
        onRow={(record) => ({
          onClick: () => {
            setSelectedRow(record);
            setDetailVisible(true);
          },
        })}
      />

      <Pagination
        total={deleteList.length}
        current={page}
        pageSize={pageSize}
        onChange={setPage}
        onSizeChange={(_, size) => {
          setPageSize(size);
          setPage(1);
        }}
      />

      {/* Operation details drawer */}
      {selectedRow && (
        <OperationDetails
          visible={detailVisible}
          data={selectedRow}
          onClose={() => setDetailVisible(false)}
        />
      )}
    </div>
  );
};

export default DeleteHistory;
