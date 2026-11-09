import React, { useCallback, useEffect, useState } from 'react';
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
import { AuditTabKey, OperationDetail } from '@/pages/Analysis/Types';
import {
  AuditQueryFilters,
  getDefaultAuditFilters,
  processDetailList,
} from '@/pages/Analysis/utils';
import { listAuditLogs } from '@/api/services/audit';

interface AuditPanelProps {
  tab: AuditTabKey;
}

const DEFAULT_PAGE_SIZE = 20;

const AuditPanel: React.FC<AuditPanelProps> = ({ tab }) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<AuditQueryFilters>(() => getDefaultAuditFilters());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [auditList, setAuditList] = useState<OperationDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const actions = filters.action
        ? (Array.isArray(filters.action) ? filters.action : [filters.action]).join(',')
        : undefined;

      const params = {
        audit_type: tab,
        bk_biz_id: filters.business || undefined,
        resource_type: filters.operationTarget || undefined,
        action: actions || undefined,
        start_time: filters.timeRange?.[0] || undefined,
        end_time: filters.timeRange?.[1] || undefined,
        account: filters.account?.value || undefined,
        account_match: (filters.account?.type as 'include' | 'exclude') || 'include',
        host: tab === AUDIT_TAB_KEYS.HOST ? filters.host?.value || undefined : undefined,
        host_type:
          tab === AUDIT_TAB_KEYS.HOST
            ? (filters.host?.type as 'ip' | 'hostname') || 'ip'
            : undefined,
        instance: tab !== AUDIT_TAB_KEYS.HOST ? filters.instance?.value || undefined : undefined,
        instance_type:
          tab !== AUDIT_TAB_KEYS.HOST
            ? (filters.instance?.type as 'name' | 'id') || 'name'
            : undefined,
        page,
        page_size: pageSize,
      };

      const res = await listAuditLogs(params);
      if (res?.data) {
        setTotal(res.data.count);
        setAuditList(processDetailList(res.data.info));
      }
    } catch {
      setAuditList([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tab, filters, page, pageSize]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

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
      <AuditFilters onSearch={handleSearch} loading={loading}>
        {filterItems}
      </AuditFilters>
      <AuditTable
        data={auditList}
        loading={loading}
        showFilters={false}
        pagination={{
          page,
          pageSize,
          total,
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
