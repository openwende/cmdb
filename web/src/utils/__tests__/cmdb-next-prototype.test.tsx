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
});
