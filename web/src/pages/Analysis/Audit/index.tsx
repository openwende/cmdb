import React, { useMemo, useState } from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import Business from './Business';
import Host from './Host';
import Resource from './Resource';
import DetailDrawer from './components/OperationDetail';
import { useAuditDirectoryNames } from './hooks/useAuditDirectoryNames';
import { useAuditRecordDeepLink } from './hooks/useAuditRecordDeepLink';
import { AUDIT_TAB_KEYS } from '@/pages/Analysis/constants';
import { AuditTabKey, OperationDetail } from '@/pages/Analysis/Types';
import './style.css';

const AUDIT_TABS = Object.values(AUDIT_TAB_KEYS) as string[];
const NO_RECORDS: OperationDetail[] = [];

const Audit: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<AuditTabKey>(AUDIT_TAB_KEYS.HOST);

  // ?record_id= 深链：打开这条记录的详情，并切到它所属的标签页
  const { record: linkedRecord, close: closeLinkedRecord } = useAuditRecordDeepLink((type) => {
    if (AUDIT_TABS.includes(type)) setActiveTab(type as AuditTabKey);
  });
  const linkedRecords = useMemo(() => (linkedRecord ? [linkedRecord] : NO_RECORDS), [linkedRecord]);
  const linkedDirectoryNames = useAuditDirectoryNames(linkedRecords);

  const onTabChange = (key: string) => {
    setActiveTab(key as AuditTabKey);
  };

  const tabItems = [
    {
      key: AUDIT_TAB_KEYS.HOST,
      label: t('analysis.audit.tabs.host'),
      children: <Host />,
    },
    {
      key: AUDIT_TAB_KEYS.BUSINESS,
      label: t('analysis.audit.tabs.business'),
      children: <Business />,
    },
    {
      key: AUDIT_TAB_KEYS.RESOURCE,
      label: t('analysis.audit.tabs.resource'),
      children: <Resource />,
    },
  ];

  return (
    <div className="audit-page">
      <Tabs activeKey={activeTab} onChange={onTabChange} items={tabItems} />
      <DetailDrawer
        visible={Boolean(linkedRecord)}
        record={linkedRecord}
        directoryNames={linkedDirectoryNames}
        onClose={closeLinkedRecord}
      />
    </div>
  );
};

export default Audit;
