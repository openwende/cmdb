import React, { useMemo, useState } from 'react';
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';
import BusinessSelector from '@/components/common/BusinessSelector';
import AuditFilters from './AuditFilters';
import AuditTable from '../AuditList';
import OperationTarget from './OperationTarget';
import Action from './Action';
import TimeFilter from './Time';
import AccountFilter from './Account';
import HostFilter from './Host';
import InstanceFilter from './Instance';
import { AUDIT_TAB_KEYS } from '@/pages/Analysis/constants';
import { AuditTabKey } from '@/pages/Analysis/Types';
import {
  AuditQueryFilters,
  filterOperationDetails,
  getDefaultAuditFilters,
  processDetailList,
} from '@/pages/Analysis/utils';
import { mockOperationDetails } from '@/mock/Analysis';

interface AuditPanelProps {
  tab: AuditTabKey;
}

const DEFAULT_PAGE_SIZE = 20;

const AuditPanel: React.FC<AuditPanelProps> = ({ tab }) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<AuditQueryFilters>(() => getDefaultAuditFilters());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const auditList = useMemo(() => {
    const filteredDetails = filterOperationDetails(mockOperationDetails, tab, filters);
    return processDetailList(filteredDetails);
  }, [filters, tab]);

  const pagedAuditList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return auditList.slice(start, start + pageSize);
  }, [auditList, page, pageSize]);

  const handleSearch = (nextFilters: AuditQueryFilters) => {
    setFilters(nextFilters || {});
    setPage(1);
  };

  const filterItems: React.ReactNode[] = [];
  if (tab !== AUDIT_TAB_KEYS.RESOURCE) {
    filterItems.push(
      <Form.Item key="business" name="business" label={t('analysis.audit.filters.business')}>
        <BusinessSelector allowClear />
      </Form.Item>,
    );
  }
  if (tab !== AUDIT_TAB_KEYS.HOST) {
    filterItems.push(<OperationTarget key="operationTarget" tab={tab} />);
  }
  filterItems.push(
    <Action key="action" tab={tab} />,
    <TimeFilter key="time" />,
    <AccountFilter key="account" />,
    tab === AUDIT_TAB_KEYS.HOST ? <HostFilter key="host" /> : <InstanceFilter key="instance" />,
  );

  return (
    <div>
      <AuditFilters onSearch={handleSearch} loading={false}>
        {filterItems}
      </AuditFilters>
      <AuditTable
        data={pagedAuditList}
        loading={false}
        showFilters={false}
        pagination={{
          page,
          pageSize,
          total: auditList.length,
          onChange: (nextPage) => setPage(nextPage),
          onSizeChange: (_current, size) => {
            setPage(1);
            setPageSize(size);
          },
        }}
      />
    </div>
  );
};

export default AuditPanel;
