import React from 'react';
import { Pagination as AntPagination } from 'antd';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
  total: number;
  pageSize: number;
  current: number;
  onChange: (page: number, pageSize: number) => void;
  onSizeChange: (current: number, size: number) => void;
  size?: 'default' | 'small';
}

const Pagination: React.FC<PaginationProps> = ({
  total,
  pageSize,
  current,
  onChange,
  onSizeChange,
  size,
}) => {
  const { t } = useTranslation();

  return (
    <AntPagination
      total={total}
      showSizeChanger={true}
      showTotal={(total: number) => t('common.components.pagination.total', { total })}
      showTitle={false}
      pageSize={pageSize}
      current={current}
      onChange={onChange}
      onShowSizeChange={onSizeChange}
      size={size}
      align="end"
    />
  );
};

export default Pagination;
