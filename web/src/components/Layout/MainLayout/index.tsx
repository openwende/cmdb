import React from 'react';
import { Layout } from 'antd';
import { Navigate, useLocation, useRoutes } from 'react-router-dom';
import Header from '../Header';
import Sidebar from '../Sidebar';
import Breadcrumb from '../Breadcrumb';
import Content from '../Content';
import Footer from '../Footer';
import { routes } from '../../../routes';
import './style.css';
import { NavigationItem, PrimaryNavKey } from '../../../routes/Types';

const MainLayout: React.FC = () => {
    const location = useLocation();

    // Determine which top-level section we're in
    const getCurrentTopLevel = () => {
        const path = location.pathname;
        return routes.find(nav =>
            path === nav.path || path.startsWith(nav.path + '/')
        );
    };

    const currentSection = getCurrentTopLevel();

    // Function to transform our route configuration into React Router's format
    const generateRouteObjects = () => {
        const transformRoutes = (routeItems: NavigationItem[]) => {
            return routeItems.map(route => {
                const routeObject: any = {
                    path: route.path,
                    element: route.element,
                };
                if (route.children && route.children.length > 0) {
                    routeObject.children = [
                        { index: true, element: <Navigate to={route.children[0].path} replace /> },
                        ...transformRoutes(route.children)
                    ];
                }
                return routeObject;
            });
        };

        return transformRoutes(routes);
    };

    // Use the useRoutes hook to render routes
    const routeElements = useRoutes(generateRouteObjects());

    return (
        <Layout className="app-layout">
            <Header />
            <Layout>
                <Sidebar currentSection={currentSection} />
                <Layout className="right-layout">
                    <Breadcrumb currentSection={currentSection} />
                    <Content>
                        {routeElements}
                    </Content>
                </Layout>
            </Layout>
            {currentSection?.key === PrimaryNavKey.Home && <Footer />}
        </Layout>
    );
};

export default MainLayout;
