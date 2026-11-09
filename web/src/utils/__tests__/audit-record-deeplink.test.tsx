import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { useAuditRecordDeepLink } from '@/pages/Analysis/Audit/hooks/useAuditRecordDeepLink';

const mocks = vi.hoisted(() => ({
  getAuditLog: vi.fn(),
  messageError: vi.fn(),
}));

vi.mock('@/api/services/audit', () => ({ getAuditLog: mocks.getAuditLog }));

vi.mock('@/utils/message', () => ({
  useAppMessage: () => ({ error: mocks.messageError }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const RAW_RECORD = {
  id: 895,
  audit_type: 'host',
  user: 'chenjing',
  resource_type: 'host',
  action: 'update',
  operate_from: 'user',
  operation_detail: {
    details: {
      pre_data: { host_name: 'pay-gw-02' },
      cur_data: { host_name: 'pay-gw-02', directory_id: 1 },
      update_fields: ['directory_id'],
    },
    bk_obj_id: 'host',
  },
  operation_time: '2026-09-22 11:30:00',
  bk_biz_id: 0,
  biz_name: '',
  resource_id: 44,
  resource_name: '10.20.1.12',
};

const setup = (entry: string) => {
  const onAuditType = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>
  );
  const hook = renderHook(
    () => ({ link: useAuditRecordDeepLink(onAuditType), location: useLocation() }),
    { wrapper },
  );
  return { ...hook, onAuditType };
};

describe('audit record deep link', () => {
  it('does nothing without record_id', () => {
    const { result } = setup('/analysis/audit');
    expect(result.current.link.record).toBeNull();
    expect(mocks.getAuditLog).not.toHaveBeenCalled();
  });

  it('loads the record, switches tab, and clears the param on close', async () => {
    mocks.getAuditLog.mockResolvedValue({ code: 0, data: RAW_RECORD });
    const { result, onAuditType } = setup('/analysis/audit?record_id=895&foo=1');

    await waitFor(() => expect(result.current.link.record?.id).toBe(895));
    expect(mocks.getAuditLog).toHaveBeenCalledWith('895');
    expect(result.current.link.record?.instance).toBe('10.20.1.12');
    expect(onAuditType).toHaveBeenCalledWith('host');

    act(() => result.current.link.close());
    expect(result.current.link.record).toBeNull();
    expect(result.current.location.search).toBe('?foo=1');
  });

  it('reports a missing record and drops the param', async () => {
    mocks.getAuditLog.mockRejectedValue({ response: { status: 404 } });
    const { result } = setup('/analysis/audit?record_id=999999');

    await waitFor(() =>
      expect(mocks.messageError).toHaveBeenCalledWith('analysis.audit.messages.recordNotFound'),
    );
    expect(result.current.link.record).toBeNull();
    expect(result.current.location.search).toBe('');
  });

  it('treats a non-numeric id as not found without calling the api', async () => {
    setup('/analysis/audit?record_id=abc');
    await waitFor(() =>
      expect(mocks.messageError).toHaveBeenCalledWith('analysis.audit.messages.recordNotFound'),
    );
    expect(mocks.getAuditLog).not.toHaveBeenCalled();
  });
});
