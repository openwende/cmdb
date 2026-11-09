import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildPoolHostListParams } from '@/api/services/host';
import HostList from '@/pages/Resource/Host/HostList';
import { usePoolHostStore } from '@/store/PoolHostStore';

/**
 * 主机资源页搜索（AC1–AC3）：参数拼装、store 的搜索 / 翻页 / 旧响应，以及列表上的交互。
 */
const { listPoolHosts } = vi.hoisted(() => ({ listPoolHosts: vi.fn() }));

vi.mock('@/api/services/host', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/services/host')>();
  return { ...actual, listPoolHosts };
});

vi.mock('react-i18next', () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock('@/store/AuthStore', () => ({
  useAuthStore: (selector: any) => selector({ canWrite: () => false }),
}));

vi.mock('@/store/DirectoryStore', () => {
  const state = { directories: [], fetchDirectories: vi.fn() };
  return { useDirectoryStore: (selector: any) => selector(state) };
});

vi.mock('@/pages/Resource/Host/components/AssignModal', () => ({ default: () => null }));
vi.mock('@/pages/Resource/Host/components/ImportHost', () => ({ default: () => null }));
vi.mock('@/pages/Resource/Host/components/HostDetailDrawer', () => ({ default: () => null }));

const host = (displayId: number, ip: string) => ({
  id: `uuid-${displayId}`,
  display_id: displayId,
  host_name: `host-${displayId}`,
  primary_ip: ip,
  ip_addresses: [ip],
  status: 'running',
});

const listResponse = (items: ReturnType<typeof host>[], total = items.length) => ({
  code: 0,
  data: { items, pagination: { page: 1, page_size: 20, total } },
});

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
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
  usePoolHostStore.getState().reset();
});

describe('buildPoolHostListParams', () => {
  it('passes the keyword through, trimmed', () => {
    expect(buildPoolHostListParams({ page: 1, pageSize: 20, keyword: '  10.20.1 ' })).toEqual({
      page: 1,
      page_size: 20,
      keyword: '10.20.1',
    });
  });

  it('drops an empty or blank keyword', () => {
    expect(buildPoolHostListParams({ page: 2, pageSize: 50, keyword: '' })).toEqual({
      page: 2,
      page_size: 50,
    });
    expect(buildPoolHostListParams({ page: 1, pageSize: 20, keyword: '   ' })).toEqual({
      page: 1,
      page_size: 20,
    });
    expect(buildPoolHostListParams({ page: 1, pageSize: 20 })).not.toHaveProperty('keyword');
  });

  it('combines keyword with the directory filter', () => {
    expect(
      buildPoolHostListParams({ page: 1, pageSize: 20, directoryId: 3, keyword: 'POOL' }),
    ).toEqual({ page: 1, page_size: 20, directory_id: 3, keyword: 'POOL' });
    expect(buildPoolHostListParams({ page: 1, pageSize: 20, directoryId: 0 })).not.toHaveProperty(
      'directory_id',
    );
  });
});

describe('PoolHostStore search', () => {
  it('search() resets the page to 1 and keeps directory and page size', () => {
    const store = usePoolHostStore.getState();
    store.setQuery({ directoryId: 2, page: 3, pageSize: 50 });
    usePoolHostStore.getState().search('  pay ');
    expect(usePoolHostStore.getState().query).toEqual({
      directoryId: 2,
      page: 1,
      pageSize: 50,
      keyword: 'pay',
    });
  });

  it('keeps the keyword when switching directory or page size', () => {
    usePoolHostStore.getState().search('pay');
    usePoolHostStore.getState().setQuery({ directoryId: 5, page: 1 });
    expect(usePoolHostStore.getState().query.keyword).toBe('pay');
    usePoolHostStore.getState().setQuery({ page: 1, pageSize: 100 });
    expect(usePoolHostStore.getState().query.keyword).toBe('pay');
  });

  it('sends the keyword with the request', async () => {
    listPoolHosts.mockResolvedValue(listResponse([host(43, '10.20.1.11')], 1));
    usePoolHostStore.getState().setQuery({ directoryId: 1 });
    usePoolHostStore.getState().search('10.20.1');
    await usePoolHostStore.getState().fetchHosts();
    expect(listPoolHosts).toHaveBeenCalledWith({
      page: 1,
      page_size: 20,
      directory_id: 1,
      keyword: '10.20.1',
    });
    expect(usePoolHostStore.getState().total).toBe(1);
  });

  it('ignores an older response that arrives after a newer one', async () => {
    const first = deferred<ReturnType<typeof listResponse>>();
    const second = deferred<ReturnType<typeof listResponse>>();
    listPoolHosts.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    usePoolHostStore.getState().search('10.20');
    const firstFetch = usePoolHostStore.getState().fetchHosts();
    usePoolHostStore.getState().search('10.30');
    const secondFetch = usePoolHostStore.getState().fetchHosts();

    second.resolve(listResponse([host(2, '10.30.0.1')], 1));
    await secondFetch;
    first.resolve(listResponse([host(1, '10.20.0.1'), host(3, '10.20.0.3')], 2));
    await firstFetch;

    const state = usePoolHostStore.getState();
    expect(state.hosts.map((row) => row.host.bk_host_innerip)).toEqual(['10.30.0.1']);
    expect(state.total).toBe(1);
    expect(state.loading).toBe(false);
  });
});

describe('HostList search box', () => {
  const renderList = () =>
    render(
      <MemoryRouter initialEntries={['/resource/host']}>
        <HostList selectedId={1} />
      </MemoryRouter>,
    );

  const searchBox = () =>
    screen.getByRole('searchbox', { name: 'resource.host.search.placeholder' });

  it('searches on Enter only, back on page 1, and shows a clearable empty state', async () => {
    listPoolHosts.mockResolvedValue(listResponse([host(43, '10.20.1.11')], 30));
    renderList();
    await waitFor(() =>
      expect(listPoolHosts).toHaveBeenLastCalledWith({ page: 1, page_size: 20, directory_id: 1 }),
    );

    act(() => usePoolHostStore.getState().setQuery({ page: 2 }));
    await waitFor(() =>
      expect(listPoolHosts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    );
    const callsBeforeTyping = listPoolHosts.mock.calls.length;

    // 按键过程中不请求
    fireEvent.change(searchBox(), { target: { value: 'nope' } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(listPoolHosts).toHaveBeenCalledTimes(callsBeforeTyping);

    listPoolHosts.mockResolvedValue(listResponse([], 0));
    fireEvent.keyDown(searchBox(), { key: 'Enter', code: 'Enter', keyCode: 13 });
    await waitFor(() => expect(listPoolHosts).toHaveBeenCalledTimes(callsBeforeTyping + 1));
    expect(listPoolHosts).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 20,
      directory_id: 1,
      keyword: 'nope',
    });

    // 空结果：显示空状态和"清除搜索"，点击后恢复全部
    const clear = (await screen.findAllByText('resource.host.search.clearSearch'))[0];
    listPoolHosts.mockResolvedValue(listResponse([host(43, '10.20.1.11')], 30));
    fireEvent.click(clear);
    await waitFor(() =>
      expect(listPoolHosts).toHaveBeenLastCalledWith({ page: 1, page_size: 20, directory_id: 1 }),
    );
    expect(searchBox()).toHaveValue('');
    expect(usePoolHostStore.getState().query.keyword).toBe('');
  });

  it('applies an emptied box right away so the box and the filter agree', async () => {
    listPoolHosts.mockResolvedValue(listResponse([host(43, '10.20.1.11')], 30));
    renderList();
    await waitFor(() =>
      expect(listPoolHosts).toHaveBeenLastCalledWith({ page: 1, page_size: 20, directory_id: 1 }),
    );

    fireEvent.change(searchBox(), { target: { value: '10.90.1' } });
    fireEvent.keyDown(searchBox(), { key: 'Enter', code: 'Enter', keyCode: 13 });
    await waitFor(() =>
      expect(listPoolHosts).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: '10.90.1' }),
      ),
    );
    act(() => usePoolHostStore.getState().setQuery({ page: 2 }));
    await waitFor(() =>
      expect(listPoolHosts).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    );

    // 删空不回车：立即按无关键字生效，回第 1 页
    fireEvent.change(searchBox(), { target: { value: '' } });
    await waitFor(() =>
      expect(listPoolHosts).toHaveBeenLastCalledWith({ page: 1, page_size: 20, directory_id: 1 }),
    );
    expect(usePoolHostStore.getState().query.keyword).toBe('');

    // 之后切目录不再带旧关键字
    act(() => usePoolHostStore.getState().setQuery({ directoryId: 2, page: 1 }));
    await waitFor(() =>
      expect(listPoolHosts).toHaveBeenLastCalledWith({ page: 1, page_size: 20, directory_id: 2 }),
    );

    // 非空的未提交输入仍然要回车才生效
    const calls = listPoolHosts.mock.calls.length;
    fireEvent.change(searchBox(), { target: { value: 'pay' } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(listPoolHosts).toHaveBeenCalledTimes(calls);
  });

  it('shows a host name column after the ID', async () => {
    listPoolHosts.mockResolvedValue(listResponse([host(43, '10.20.1.11')], 1));
    renderList();
    const headers = await screen.findAllByRole('columnheader');
    const titles = headers.map((cell) => cell.textContent);
    const idIndex = titles.indexOf('resource.host.columns.id');
    expect(titles[idIndex + 1]).toBe('resource.host.columns.hostName');
    expect(await screen.findByRole('cell', { name: 'host-43' })).toBeInTheDocument();
  });

  it('uses the IP or host name placeholder (both locales)', async () => {
    const zh = (await import('@/locales/zh-CN.json')).default as any;
    const en = (await import('@/locales/en-US.json')).default as any;
    expect(zh.resource.host.search.placeholder).toBe('请输入IP或主机名');
    expect(en.resource.host.search.placeholder).toBe('Enter IP or host name');
  });
});
