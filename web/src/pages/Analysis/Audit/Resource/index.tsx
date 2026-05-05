import React from 'react';
import AuditPanel from '../components/AuditPanel';
import { AUDIT_TAB_KEYS } from '@/pages/Analysis/constants';

const ResourceAudit: React.FC = () => <AuditPanel tab={AUDIT_TAB_KEYS.RESOURCE} />;

export default ResourceAudit;
