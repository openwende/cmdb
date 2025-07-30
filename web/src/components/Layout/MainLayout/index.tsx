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

const MainLayout: React.FC = () => {
    const location = useLocation();

    // Determine which top-level section we're in
    const getCurrentTopLevel = () => {
        const path = location.pathname;
        // Special case: when path starts with /business, match to business route
        if (path.startsWith('/business')) {
            return routes.find(nav => nav.key === PrimaryNavKey.Business);
        }
        // Special case: when path starts with /business-set, match to business set route
        if (path.startsWith('/business-set')) {
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
