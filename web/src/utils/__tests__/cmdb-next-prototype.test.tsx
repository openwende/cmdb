import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';

import CmdbNextPrototypeLayout from '@/pages/Prototype/CmdbNext';

describe('cmdb next prototype', () => {
  it('renders the workbench by default and navigates through the prototype sections', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/prototype/cmdb-next']}>
        <Routes>
          <Route path="/prototype/cmdb-next" element={<CmdbNextPrototypeLayout />}>
            <Route index element={<Navigate to="workbench" replace />} />
            <Route path=":section" element={<CmdbNextPrototypeLayout />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: '统一资源真相，从工作上下文开始。' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '资源目录' }));
    expect(
      await screen.findByRole('heading', { name: '跨类型搜索，不再按系统分仓找资源。' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: '平台配置' }));
    expect(
      await screen.findByRole('heading', { name: '类型中心管理资源表达，不占用一线入口。' }),
    ).toBeInTheDocument();
  });

  it('switches in-page perspectives inside the topology prototype', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/prototype/cmdb-next/topology']}>
        <Routes>
          <Route path="/prototype/cmdb-next/:section" element={<CmdbNextPrototypeLayout />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: '拓扑是工作区，不是单纯的一棵树。' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '变更视角' }));

    expect(
      await screen.findByRole('heading', {
        name: '变更窗口与依赖提示一起出现，而不是散落在工单里。',
      }),
    ).toBeInTheDocument();
  });

  it('renders the topology workspace prototype section', async () => {
    render(
      <MemoryRouter initialEntries={['/prototype/cmdb-next/topology-workspace']}>
        <Routes>
          <Route path="/prototype/cmdb-next/:section" element={<CmdbNextPrototypeLayout />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole('heading', { name: '把业务拓扑改造成真正的操作台。' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('全局原型导航')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /切换当前业务/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/当前节点路径/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '主机列表' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '主机工作台表格' })).toBeInTheDocument();
  });

  it('supports business switching, node switching and floating bulk actions inside the topology workspace prototype', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/prototype/cmdb-next/topology-workspace']}>
        <Routes>
          <Route path="/prototype/cmdb-next/:section" element={<CmdbNextPrototypeLayout />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: '把业务拓扑改造成真正的操作台。' });

    await user.click(screen.getByRole('button', { name: /切换当前业务/i }));
    await user.click(screen.getByRole('button', { name: /切换到业务 原神\/全球发布/ }));

    expect(screen.getAllByText('原神/全球发布').length).toBeGreaterThan(0);
    expect(
      screen.getByLabelText(/当前节点路径 原神\/全球发布 \/ 发布系统 \/ 发布集群/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /切换到节点 跨区缓冲池/ }));
    expect(screen.getByRole('heading', { name: '跨区缓冲池' })).toBeInTheDocument();
    expect(screen.getByText('当前节点下暂无主机')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /切换到节点 发布集群/ }));
    expect(screen.getByRole('heading', { name: '发布集群' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /选择主机 gs-release-01/ }));
    expect(screen.getByText('已选择 1 项主机')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '转移到...' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '追加到目标' })).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /选择当前结果中的所有主机/ }));
    expect(screen.getByText('已选择 3 项主机')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '取消选择' }));
    expect(screen.queryByText('已选择 3 项主机')).not.toBeInTheDocument();
  });
});
