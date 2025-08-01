import React from 'react';
import { Layout } from 'antd';
import { Outlet, useLocation } from 'react-router-dom';
import Header from '../Header';
import Sidebar from '../Sidebar';
import Breadcrumb from '../Breadcrumb';
import Content from '../Content';
import Footer from '../Footer';
import { routes } from '../../../routes';
import { PrimaryNavKey } from '../../../routes/Types';
import './style.css';
import { isBusinessPage, isBusinessSetPage } from '@/utils/routes';

const MainLayout: React.FC = () => {
    const location = useLocation();

    // Determine which top-level section we're in
    const getCurrentTopLevel = () => {
        const path = location.pathname;
        // Special case: when it is business path, match to business route
        if (isBusinessPage(path)) {
            return routes.find(nav => nav.key === PrimaryNavKey.Business);
        }
        // Special case: when it is business set path, match to business set route
        if (isBusinessSetPage(path)) {
            return routes.find(nav => nav.key === PrimaryNavKey.BusinessSet);
        }
        // Normal case
        return routes.find(nav =>
            path === nav.path || path.startsWith(nav.path + '/')
        );
    };

    const currentSection = getCurrentTopLevel();

    return (
        <Layout className="app-layout">
            <Header />
            <Layout>
                <Sidebar currentSection={currentSection} />
                <Layout className="right-layout">
                    <Breadcrumb />
                    <Content>
                        <Outlet />
                    </Content>
                </Layout>
            </Layout>
            {currentSection?.key === PrimaryNavKey.Home && <Footer />}
        </Layout>
    );
};

export default MainLayout;
