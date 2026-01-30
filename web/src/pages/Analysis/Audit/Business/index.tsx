import React, { useState, useEffect } from 'react';
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';
import BusinessSelector from '@/components/common/BusinessSelector';
import {
  AuditFilters,
  AuditTable,
  OperationTarget,
  Action,
  TimeFilter,
  AccountFilter,
  InstanceFilter,
} from '../components';
import { AUDIT_TAB_KEYS } from '@/pages/Analysis/constants';
import type { OperationDetail } from '@/pages/Analysis/Types';
import { mockOperationDetails } from '@/mock/Analysis';
import { processDetailList } from '@/pages/Analysis/utils';

const BusinessAudit: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [auditList, setAuditList] = useState<OperationDetail[]>([]);

  useEffect(() => {
    // TODO: Unknown parameters
    fetchAuditList();
  }, [page, pageSize]);

  const fetchAuditList = () => {
    // Process mockOperationDetails data using unified processing function
    const processedData = processDetailList(mockOperationDetails);
    setAuditList(processedData);
  };

  const handleSearch = (_filters: any) => {
    setLoading(true);
    // TODO: Unknown parameters
    fetchAuditList();
    setTimeout(() => {
      setLoading(false);
    }, 1000);
  };

  return (
    <div>
      <AuditFilters onSearch={handleSearch} loading={loading}>
        <Form.Item name="business" label={t('analysis.audit.filters.business')}>
          <BusinessSelector allowClear />
        </Form.Item>
        <OperationTarget tab={AUDIT_TAB_KEYS.BUSINESS} />
        <Action tab={AUDIT_TAB_KEYS.BUSINESS} />
        <TimeFilter />
        <AccountFilter />
        <InstanceFilter />
      </AuditFilters>
      <AuditTable
        data={auditList}
        loading={loading}
        pagination={{
          page,
          pageSize: pageSize,
          total: auditList.length,
          onChange: (page) => setPage(page),
          onSizeChange: (_, size) => {
            setPage(1);
            setPageSize(size);
          },
        }}
      />
    </div>
  );
};

export default BusinessAudit;
