import React from 'react';
import { Empty } from 'antd';
import { useTranslation } from 'react-i18next';

interface TableEmptyProps {
  description?: React.ReactNode;
}

const TableEmpty: React.FC<TableEmptyProps> = ({ description }) => {
  const { t } = useTranslation();

  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={description ?? t('common.noData')}
    />
  );
};

export default TableEmpty;
