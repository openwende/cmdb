import { AUDIT_TAB_KEYS } from '@/pages/Analysis/constants';

export type AuditTabKey = typeof AUDIT_TAB_KEYS[keyof typeof AUDIT_TAB_KEYS];

export interface OperationDetail {
    id: number;
    business: string;
    object: string;
    action: string;
    modelType: string;
    instance: string;
    description: string;
    time: string;
    account: string;
    details: {
        preData: Record<string, any> | null;
        curData: Record<string, any> | null;
        updateFields: string[] | null;
    };
}