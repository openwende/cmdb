import React, { useState, useEffect } from 'react';
import { Layout } from 'antd';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../Header';
import Sidebar from '../Sidebar';
import Content from '../Content';
import { routes } from '../../../routes';
import { PrimaryNavKey } from '../../../routes/Types';
import { useResponsive } from '@/utils/useResponsive';
import './style.css';
import { isBusinessPage, isBusinessSetPage } from '@/utils/routes';

const MainLayout: React.FC = () => {
  const location = useLocation();
  const { isMobile, isTablet } = useResponsive();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Auto-close sidebar on route change when mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  // Determine which top-level section we're in
  const getCurrentTopLevel = () => {
    const path = location.pathname;
    if (isBusinessPage(path)) {
      return routes.find((nav) => nav.key === PrimaryNavKey.Business);
    }
    if (isBusinessSetPage(path)) {
      return routes.find((nav) => nav.key === PrimaryNavKey.BusinessSet);
    }
    return routes.find((nav) => path === nav.path || path.startsWith(nav.path + '/'));
  };

  const currentSection = getCurrentTopLevel();

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <Layout className="app-layout">
      <Header isMobile={isMobile} onToggleSidebar={toggleSidebar} />
      <Layout className="app-body">
        <Sidebar
          currentSection={currentSection}
          isMobile={isMobile}
          isTablet={isTablet}
          sidebarOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <Layout className="right-layout">
          <Content>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
