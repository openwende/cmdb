import React, { useEffect, useMemo, useState } from 'react';
import { Table, DatePicker, Input } from 'antd';
import Pagination from '@/components/common/Pagination';
import { deleteHistoryMock } from '@/mock/resource';
import './style.css';

const { RangePicker } = DatePicker;

interface DeleteHistoryItem {
  id: number;
  resource_id: number;
  resource_name: string;
  operation_time: string; // ISO string
  user: string;
}

const PAGE_SIZE = 20;

const DeleteHistory: React.FC = () => {
  const [data, setData] = useState<DeleteHistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [keyword, setKeyword] = useState<string>('');
  const [timeRange, setTimeRange] = useState<[Date, Date] | null>(null);

  // init mock
  useEffect(() => {
    setData(deleteHistoryMock.info as DeleteHistoryItem[]);
  }, []);

  // filtered data
  const filtered = useMemo(() => {
    return data.filter(item => {
      let ok = true;
      if (keyword) {
        ok = item.resource_name.includes(keyword.trim());
      }
      if (ok && timeRange) {
        const opTime = new Date(item.operation_time).getTime();
        const start = new Date(timeRange[0]).setHours(0, 0, 0, 0);
        const end = new Date(timeRange[1]).setHours(23, 59, 59, 999);
        ok = opTime >= start && opTime <= end;
      }
      return ok;
    });
  }, [data, keyword, timeRange]);

  const pageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const columns = [
    {
      title: 'ID',
      dataIndex: 'resource_id',
      width: 120,
    },
    {
      title: 'IP',
      dataIndex: 'resource_name',
    },
    {
      title: '更新时间',
      dataIndex: 'operation_time',
    },
    {
      title: '操作账号',
      dataIndex: 'user',
    },
  ];

  return (
    <div className="delete-history-wrapper">
      {/* 操作栏 */}
      <div className="toolbar">
        <RangePicker
          style={{ marginRight: 16, width: 240 }}
          value={timeRange as any}
          onChange={(vals) => {
            if (!vals || vals.length < 2) {
              setTimeRange(null);
            } else if (vals && vals.length === 2) {
              setTimeRange([vals[0]!.toDate(), vals[1]!.toDate()]);
            }
            setPage(1);
          }}
        />
        <Input.Search
          placeholder="请输入IP"
          allowClear
          style={{ width: 200 }}
          onSearch={(val) => {
            setKeyword(val);
            setPage(1);
          }}
        />
      </div>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={pageData}
        rowKey={(rec) => rec.id}
        pagination={false}
        style={{ marginTop: 12 }}
      />

      {/* 分页器 */}
      <Pagination
        total={filtered.length}
        current={page}
        pageSize={pageSize}
        onChange={setPage}
        onSizeChange={(_, size) => {
          setPageSize(size);
          setPage(1);
        }}
      />
    </div>
  );
};

export default DeleteHistory; 