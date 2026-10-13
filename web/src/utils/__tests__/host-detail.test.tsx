import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import dayjs from 'dayjs';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { adaptHostAuditLogs, adaptHostDetail } from '@/api/adapters/hostAdapter';
import type { HostDetailRaw } from '@/api/types/host';
import HostDetailDrawer from '@/pages/Resource/Host/components/HostDetailDrawer';
import { useHostDetailDeepLink } from '@/pages/Resource/Host/hooks/useHostDetailDeepLink';
import { getHostDetailPath, parseHostIdParam } from '@/utils/routes';

/**
 * 主机详情（AC4–AC7）：数据适配、深链参数解析、抽屉内容和深链行为。
 */
const { api, message } = vi.hoisted(() => ({
  api: { getHostByDisplayId: vi.fn(), listHostAuditLogs: vi.fn() },
  message: { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));

vi.mock('@/api/services/host', () => api);
vi.mock('@/utils/message', () => ({ useAppMessage: () => message }));

vi.mock('react-i18next', () => {
  const t = (key: string, options?: { id?: string | number }) =>
    options?.id !== undefined ? `${key}:${options.id}` : key;
  return { useTranslation: () => ({ t }) };
});

const HOST_43: HostDetailRaw = {
  id: '87ac8d17-cf0b-4fd5-a3b1-71f34c49212d',
  display_id: 43,
  created_at: '2026-07-26T02:00:00Z',
  updated_at: '2026-09-17T01:12:00Z',
  host_name: 'pay-gw-01',
  primary_ip: '10.20.1.11',
  ip_addresses: ['10.20.1.11', 'fe80::1'],
  cloud_vendor: 'tencent_cloud',
  cloud_instance_id: 'ins-pay-gw-01',
  cloud_region: 'ap-guangzhou',
  vpc_id: 'vpc-tencent-guangzhou-pay',
  subnet_id: 'subnet-ap-guangzhou',
  cpu: 8,
  memory: 32768,
  disk_size: 200,
  os_type: 'linux',
  os_version: 'TencentOS Server 3.1',
  status: 'running',
  is_destroyed: false,
  custom_fields: {
    SLA: '99.95%',
    固资编号: 'WD-2024-00038',
    备份: false,
    标签: ['gw', '扩容'],
    监控: true,
    负载: { cpu: 0.4 },
    备注: '',
    空值: null,
  },
  cloud_area_name: '腾讯云广州支付 VPC',
  placements: [
    {
      kind: 'business',
      business_id: 1027,
      business_name: '支付清结算',
      set_id: 35,
      set_name: '生产集群',
      module_id: 97,
      module_name: '支付网关',
    },
    {
      kind: 'business',
      business_id: 1027,
      business_name: '支付清结算',
      set_id: 35,
      set_name: '生产集群',
      module_id: 99,
      module_name: '风控服务',
    },
  ],
};

const POOL_HOST: HostDetailRaw = {
  id: 'be000cb5-4625-400b-beff-86272fd26415',
  display_id: 2,
  host_name: 'web-server-02',
  primary_ip: '10.0.0.2',
  os_type: 'linux',
  os_version: 'CentOS 7.9',
  status: 'running',
  cloud_area_name: '直连区域',
  placements: [{ kind: 'pool', directory_id: 1, directory_name: '默认目录' }],
};

const AUDITS = {
  code: 0,
  data: {
    count: 8,
    info: [
      { id: 613, user: 'zhangwei', action: 'update', operation_time: '2026-09-17 01:12:00' },
      {
        id: 612,
        user: 'liuyang',
        action: 'transfer_module',
        operation_time: '2026-09-16 14:41:00',
      },
    ],
  },
};

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('parseHostIdParam / getHostDetailPath', () => {
  it('treats a missing or empty param as missing', () => {
    expect(parseHostIdParam(null)).toEqual({ status: 'missing' });
    expect(parseHostIdParam(undefined)).toEqual({ status: 'missing' });
    expect(parseHostIdParam('')).toEqual({ status: 'missing' });
  });

  it('accepts a positive integer display_id', () => {
    expect(parseHostIdParam('43')).toEqual({ status: 'valid', displayId: 43 });
    expect(parseHostIdParam(' 7 ')).toEqual({ status: 'valid', displayId: 7 });
  });

  it('rejects anything else', () => {
    ['0', '-1', 'abc', '4.5', '43abc', '1e3', '99999999999999999999', ' '].forEach((value) => {
      expect(parseHostIdParam(value)).toEqual({ status: 'invalid' });
    });
  });

  it('builds the host deep link', () => {
    expect(getHostDetailPath(43)).toBe('/resource/host?host_id=43');
    expect(getHostDetailPath('7')).toBe('/resource/host?host_id=7');
  });
});

describe('adaptHostDetail', () => {
  it('lists every business placement as business / set / module', () => {
    const view = adaptHostDetail(HOST_43);
    expect(view.placements).toEqual([
      { key: 'business-97-0', kind: 'business', label: '支付清结算 / 生产集群 / 支付网关' },
      { key: 'business-99-1', kind: 'business', label: '支付清结算 / 生产集群 / 风控服务' },
    ]);
  });

  it('shows the directory for a host in the resource pool', () => {
    expect(adaptHostDetail(POOL_HOST).placements).toEqual([
      { key: 'pool-1-0', kind: 'pool', label: '默认目录' },
    ]);
  });

  it('formats basic, cloud and time fields with units', () => {
    const view = adaptHostDetail(HOST_43);
    expect(view).toMatchObject({
      displayId: 43,
      hostName: 'pay-gw-01',
      primaryIp: '10.20.1.11',
      ipAddresses: '10.20.1.11, fe80::1',
      status: 'running',
      os: 'linux TencentOS Server 3.1',
      cpu: '8',
      memory: '32768 MB',
      disk: '200 GB',
      cloudVendor: 'tencent_cloud',
      cloudArea: '腾讯云广州支付 VPC',
      cloudInstanceId: 'ins-pay-gw-01',
      cloudRegion: 'ap-guangzhou',
      vpcId: 'vpc-tencent-guangzhou-pay',
      subnetId: 'subnet-ap-guangzhou',
    });
    // 按浏览器本地时区显示
    expect(view.createdAt).toBe(dayjs('2026-07-26T02:00:00Z').format('YYYY-MM-DD HH:mm:ss'));
    expect(view.updatedAt).toBe(dayjs('2026-09-17T01:12:00Z').format('YYYY-MM-DD HH:mm:ss'));
  });

  it('shows -- for missing values and no placement', () => {
    const view = adaptHostDetail({ id: 'x', display_id: 9, host_name: '  ', placements: [] });
    expect(view).toMatchObject({
      hostName: '--',
      primaryIp: '--',
      ipAddresses: '--',
      status: '--',
      os: '--',
      cpu: '--',
      memory: '--',
      disk: '--',
      cloudVendor: '--',
      cloudArea: '--',
      vpcId: '--',
      createdAt: '--',
      updatedAt: '--',
      placements: [],
      customFields: [],
    });
    expect(adaptHostDetail({ id: 'y', display_id: 10 }).placements).toEqual([]);
  });

  it('keeps custom field keys and order, nested values as JSON text', () => {
    expect(adaptHostDetail(HOST_43).customFields).toEqual([
      { key: 'SLA', value: '99.95%' },
      { key: '固资编号', value: 'WD-2024-00038' },
      { key: '备份', value: 'false' },
      { key: '标签', value: '["gw","扩容"]' },
      { key: '监控', value: 'true' },
      { key: '负载', value: '{"cpu":0.4}' },
      { key: '备注', value: '--' },
      { key: '空值', value: '--' },
    ]);
  });

  it('falls back to ids when placement names are missing', () => {
    const view = adaptHostDetail({
      id: 'z',
      display_id: 11,
      placements: [
        { kind: 'business', business_id: 5, set_id: 6, module_id: 7 },
        { kind: 'pool', directory_id: 3 },
      ],
    });
    expect(view.placements.map((item) => item.label)).toEqual(['#5 / #6 / #7', '#3']);
  });

  it('adapts host audit records', () => {
    expect(adaptHostAuditLogs(AUDITS.data.info as any)).toEqual([
      { id: 613, operationTime: '2026-09-17 01:12:00', action: 'update', user: 'zhangwei' },
      {
        id: 612,
        operationTime: '2026-09-16 14:41:00',
        action: 'transfer_module',
        user: 'liuyang',
      },
    ]);
    expect(adaptHostAuditLogs(undefined)).toEqual([]);
  });
});

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
};

/** 和主机资源页一样的接法：深链 hook + 抽屉 */
const DeepLinkHarness = () => {
  const hostDetail = useHostDetailDeepLink();
  return (
    <>
      <button type="button" onClick={() => hostDetail.open(43)}>
        open-43
      </button>
      <HostDetailDrawer
        displayId={hostDetail.displayId}
        onClose={hostDetail.close}
        onNotFound={hostDetail.notFound}
      />
    </>
  );
};

const renderAt = (url: string) =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/resource/host" element={<DeepLinkHarness />} />
        <Route path="*" element={null} />
      </Routes>
      <LocationProbe />
    </MemoryRouter>,
  );

const location = () => screen.getByTestId('location').textContent;

describe('host detail deep link and drawer', () => {
  it('opens from ?host_id= and shows every group read-only', async () => {
    api.getHostByDisplayId.mockResolvedValue({ code: 0, data: HOST_43 });
    api.listHostAuditLogs.mockResolvedValue(AUDITS);
    renderAt('/resource/host?host_id=43');

    expect(await screen.findByText('pay-gw-01')).toBeInTheDocument();
    expect(api.getHostByDisplayId).toHaveBeenCalledWith(43);
    expect(api.listHostAuditLogs).toHaveBeenCalledWith(43, 5);

    const drawer = document.querySelector('.host-detail-drawer') as HTMLElement;
    const view = within(drawer);
    [
      'resource.host.detail.sections.basic',
      'resource.host.detail.sections.placement',
      'resource.host.detail.sections.cloud',
      'resource.host.detail.sections.customFields',
      'resource.host.detail.sections.time',
      'resource.host.detail.sections.audit',
    ].forEach((title) => expect(view.getByRole('heading', { name: title })).toBeInTheDocument());

    expect(view.getByText('32768 MB')).toBeInTheDocument();
    expect(view.getByText('200 GB')).toBeInTheDocument();
    expect(view.getByText('支付清结算 / 生产集群 / 支付网关')).toBeInTheDocument();
    expect(view.getByText('支付清结算 / 生产集群 / 风控服务')).toBeInTheDocument();
    expect(view.getByText('固资编号')).toBeInTheDocument();
    expect(view.getByText('WD-2024-00038')).toBeInTheDocument();
    expect(view.getByText('["gw","扩容"]')).toBeInTheDocument();

    // 最近变更：审计页同一个时间格式（北京时间）、操作翻译、点击跳审计详情
    const auditLink = await view.findByRole('link', {
      name: 'resource.host.detail.audit.open:613',
    });
    expect(auditLink).toHaveAttribute('href', '/analysis/audit?record_id=613');
    expect(auditLink).toHaveTextContent('2026-09-17 09:12:00');
    expect(auditLink).toHaveTextContent('analysis.audit.actions.update');
    expect(auditLink).toHaveTextContent('zhangwei');
    expect(
      view.getByRole('link', { name: 'resource.host.detail.audit.open:612' }),
    ).toHaveTextContent('analysis.audit.actions.transferModule');

    // 只读：除了关闭按钮没有别的按钮
    expect(view.getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual([
      'Close',
    ]);

    fireEvent.click(auditLink);
    expect(location()).toBe('/analysis/audit?record_id=613');
  });

  it('removes the param when the drawer is closed', async () => {
    api.getHostByDisplayId.mockResolvedValue({ code: 0, data: POOL_HOST });
    api.listHostAuditLogs.mockResolvedValue({ code: 0, data: { count: 0, info: [] } });
    renderAt('/resource/host?host_id=2&tab=x');

    expect(await screen.findByText('默认目录')).toBeInTheDocument();
    expect(await screen.findByText('resource.host.detail.audit.empty')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(location()).toBe('/resource/host?tab=x');
  });

  it('opens through the param when the list asks for a host', async () => {
    api.getHostByDisplayId.mockResolvedValue({ code: 0, data: HOST_43 });
    api.listHostAuditLogs.mockResolvedValue(AUDITS);
    renderAt('/resource/host');

    expect(api.getHostByDisplayId).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('open-43'));
    expect(location()).toBe('/resource/host?host_id=43');
    expect(await screen.findByText('pay-gw-01')).toBeInTheDocument();
  });

  it('reports a missing host and removes the param', async () => {
    api.getHostByDisplayId.mockRejectedValue({ response: { status: 404 } });
    api.listHostAuditLogs.mockResolvedValue({ code: 0, data: { count: 0, info: [] } });
    renderAt('/resource/host?host_id=999999');

    await waitFor(() => expect(location()).toBe('/resource/host'));
    expect(message.error).toHaveBeenCalledTimes(1);
    expect(message.error).toHaveBeenCalledWith('resource.host.detail.messages.notFound');
  });

  it('rejects an invalid id without calling the API', async () => {
    renderAt('/resource/host?host_id=abc');

    await waitFor(() => expect(location()).toBe('/resource/host'));
    expect(message.error).toHaveBeenCalledTimes(1);
    expect(message.error).toHaveBeenCalledWith('resource.host.detail.messages.notFound');
    expect(api.getHostByDisplayId).not.toHaveBeenCalled();
  });

  it('reports an invalid id only once under StrictMode', async () => {
    render(
      <StrictMode>
        <MemoryRouter initialEntries={['/resource/host?host_id=0']}>
          <Routes>
            <Route path="/resource/host" element={<DeepLinkHarness />} />
          </Routes>
          <LocationProbe />
        </MemoryRouter>
      </StrictMode>,
    );

    await waitFor(() => expect(location()).toBe('/resource/host'));
    expect(message.error).toHaveBeenCalledTimes(1);
  });

  it('does nothing without the param', () => {
    renderAt('/resource/host');
    expect(api.getHostByDisplayId).not.toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(document.querySelector('.host-detail-drawer')).toBeNull();
  });

  it('closes with a load-failed message on other errors', async () => {
    api.getHostByDisplayId.mockRejectedValue({ response: { status: 500 } });
    api.listHostAuditLogs.mockResolvedValue({ code: 0, data: { count: 0, info: [] } });
    renderAt('/resource/host?host_id=43');

    await waitFor(() => expect(location()).toBe('/resource/host'));
    expect(message.error).toHaveBeenCalledWith('resource.host.detail.messages.loadFailed');
  });
});
