import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getAuditLog, type AuditType } from '@/api/services/audit';
import { processDetailList } from '@/pages/Analysis/utils';
import type { OperationDetail } from '@/pages/Analysis/Types';
import { useAppMessage } from '@/utils/message';
import { AUDIT_RECORD_QUERY_KEY } from '@/utils/routes';

/**
 * 审计页深链：`?record_id=895` 时按 ID 取这条记录并打开详情抽屉。
 * 关闭抽屉时去掉参数；记录不存在（404 / 非法 ID）时提示并去掉参数。
 * 没有参数时什么都不做，审计页行为不变。
 */
export const useAuditRecordDeepLink = (onAuditType?: (type: AuditType) => void) => {
  const { t } = useTranslation();
  const message = useAppMessage();
  const [searchParams, setSearchParams] = useSearchParams();
  const recordId = searchParams.get(AUDIT_RECORD_QUERY_KEY);
  const [record, setRecord] = useState<OperationDetail | null>(null);

  // effect 只跟 recordId 走，其余依赖放 ref：切换语言、其他参数变化时不重新请求
  const latest = useRef({ t, message, onAuditType, setSearchParams });
  latest.current = { t, message, onAuditType, setSearchParams };

  const clearParam = useCallback(() => {
    latest.current.setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(AUDIT_RECORD_QUERY_KEY);
        return next;
      },
      { replace: true },
    );
  }, []);

  useEffect(() => {
    if (!recordId) {
      setRecord(null);
      return;
    }
    const notFound = () => {
      const { t: translate, message: api } = latest.current;
      api.error(translate('analysis.audit.messages.recordNotFound'));
      clearParam();
    };
    if (!/^\d+$/.test(recordId)) {
      notFound();
      return;
    }

    let cancelled = false;
    getAuditLog(recordId)
      .then((response) => {
        if (cancelled) return;
        const raw = response?.data;
        if (!raw) {
          notFound();
          return;
        }
        setRecord(processDetailList([raw])[0]);
        latest.current.onAuditType?.(raw.audit_type);
      })
      .catch((error: { response?: { status?: number } }) => {
        if (cancelled) return;
        const status = error?.response?.status;
        if (status === 404 || status === 400) {
          notFound();
          return;
        }
        const { t: translate, message: api } = latest.current;
        api.error(translate('analysis.audit.messages.recordLoadFailed'));
        clearParam();
      });
    return () => {
      cancelled = true;
    };
  }, [recordId, clearParam]);

  const close = useCallback(() => {
    setRecord(null);
    clearParam();
  }, [clearParam]);

  return { record, close };
};
