import React from 'react';
import AuditPanel from '../components/AuditPanel';
import { AUDIT_TAB_KEYS } from '@/pages/Analysis/constants';

const BusinessAudit: React.FC = () => <AuditPanel tab={AUDIT_TAB_KEYS.BUSINESS} />;

export default BusinessAudit;
