import { render, waitFor } from '@testing-library/react';
import { message } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import HostList from '@/pages/Business/BusinessTopology/HostList';
import { TopoTreeNodeType } from '@/pages/Business/Types';
import enUS from '@/locales/en-US.json';
import zhCN from '@/locales/zh-CN.json';

/**
 * AC10：业务拓扑主机列表请求失败时，提示的是翻译后的文字，不是裸 key。
 * t 按当前语言从真实的语言文件里取值，取不到时原样返回 key（和 i18next 一样）。
 */
const { t, locale, getTopologyNodeHosts } = vi.hoisted(() => {
  const locale: { dict: Record<string, unknown> } = { dict: {} };
  const t = (key: string) => {
    const value = key
      .split('.')
      .reduce<unknown>(
        (node, part) =>
          node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
        locale.dict,
      );
    return typeof value === 'string' ? value : key;
  };
  return { t, locale, getTopologyNodeHosts: vi.fn() };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
}));

vi.mock('@/utils/routes', () => ({
  getBusinessIdFromUrl: () => 1027,
  getTransferHostPath: (id: number) => `/business/${id}/topology/transferHost`,
}));

vi.mock('@/api/services/business', () => ({
  getTopologyNodeHosts,
  reclaimTopologyHostsToPool: vi.fn(),
  transferTopologyHosts: vi.fn(),
}));

vi.mock('@/store/TransferHostStore', () => ({
  useTransferHostStore: () => ({ idleSetID: null, setTransferHostData: vi.fn() }),
}));

vi.mock('@/store/AuthStore', () => ({
  useAuthStore: (selector: any) => selector({ canWrite: () => true }),
}));

vi.mock('antd', () => ({
  Table: ({ dataSource = [], columns = [] }: any) => (
    <div>
      {dataSource.map((record: any) => (
        <div key={record.host.bk_host_id}>
          <span>{columns[0].render(record.host.display_id, record)}</span>
          <span>{record.host.bk_host_innerip}</span>
        </div>
      ))}
    </div>
  ),
  Button: ({ children, onClick, disabled, 'aria-label': ariaLabel }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      {children}
    </button>
  ),
  Dropdown: ({ children }: any) => <div>{children}</div>,
  Input: {
    Search: ({ value, onChange, onSearch, placeholder }: any) => (
      <input
        aria-label={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            onSearch?.((event.target as HTMLInputElement).value);
          }
        }}
      />
    ),
  },
  Tooltip: ({ children }: any) => <div>{children}</div>,
  Empty: ({ description }: any) => <div>{description}</div>,
  Checkbox: () => null,
  Spin: () => null,
  Typography: { Text: ({ children }: any) => <span>{children}</span> },
  message: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock('@ant-design/icons', () => ({ DownOutlined: () => null }));

vi.mock('@/pages/Business/BusinessTopology/components/AddHostModal', () => ({
  default: () => null,
}));
vi.mock('@/pages/Business/BusinessTopology/components/TransferHostModal', () => ({
  default: () => null,
}));
vi.mock('@/pages/Business/BusinessTopology/components/ReleaseHostModal', () => ({
  default: () => null,
}));
vi.mock('@/pages/Business/BusinessTopology/components/CreateNodeModal', () => ({
  default: () => null,
}));

vi.mock('@/components/common/Pagination', () => ({
  default: ({ onChange, pageSize }: any) => (
    <button type="button" onClick={() => onChange(2, pageSize)}>
      go-page-2
    </button>
  ),
}));

vi.mock('@/components/common/EmptySearchResult', () => ({
  default: () => <div>empty-search</div>,
}));

vi.mock('@/pages/Resource/Host/components/HostDetailDrawer', () => ({ default: () => null }));

const moduleNode = {
  title: '支付网关',
  key: 'module-97',
  nodeId: '97',
  type: TopoTreeNodeType.Module,
  backendType: 'module',
};

describe('business topology host list load error', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getTopologyNodeHosts.mockRejectedValue(new Error('network'));
  });

  it.each([
    ['zh-CN', zhCN],
    ['en-US', enUS],
  ])('shows a translated message when loading fails (%s)', async (_lang, dict) => {
    locale.dict = dict as Record<string, unknown>;
    render(<HostList selectedNode={moduleNode} parentNodes={[]} onTopologyChanged={() => {}} />);

    await waitFor(() => expect(message.error).toHaveBeenCalledTimes(1));
    const shown = vi.mocked(message.error).mock.calls[0][0];
    expect(shown).not.toBe('resource.host.messages.loadFailed');
    expect(shown).toBe(t('resource.host.messages.loadFailed'));
    expect(typeof shown === 'string' && shown.length > 0).toBe(true);
  });
});
