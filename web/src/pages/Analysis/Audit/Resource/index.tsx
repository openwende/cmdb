import React, { useState, useEffect } from 'react';
import {
  AuditFilters,
  AuditTable,
  OperationTarget,
  Action,
  TimeFilter,
  AccountFilter,
  InstanceFilter,
} from '../components';
import type { OperationDetail } from '@/pages/Analysis/Types';
import { AUDIT_TAB_KEYS } from '@/pages/Analysis/constants';
import { mockOperationDetails } from '@/mock/Analysis';
import { processDetailList } from '@/pages/Analysis/utils';

const ResourceAudit: React.FC = () => {
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
        <OperationTarget tab={AUDIT_TAB_KEYS.RESOURCE} />
        <Action tab={AUDIT_TAB_KEYS.RESOURCE} />
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

export default ResourceAudit;
