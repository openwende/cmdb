import { AUDIT_TAB_KEYS } from '@/pages/Analysis/constants';

export type AuditTabKey = typeof AUDIT_TAB_KEYS[keyof typeof AUDIT_TAB_KEYS];
