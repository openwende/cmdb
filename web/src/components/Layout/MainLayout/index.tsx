import React from 'react';
import { Layout } from 'antd';
import { Navigate, useRoutes } from 'react-router-dom';
import Header from '../Header';
import Sidebar from '../Sidebar';
import Content from '../Content';
import { routes } from '../../../routes';
import './style.css';

const MainLayout: React.FC = () => {
    // Function to transform our route configuration into React Router's format
    const generateRouteObjects = () => {
        const transformRoutes = (routeItems: typeof routes) => {
            return routeItems.map(route => {
                const routeObject: any = {
                    path: route.path === '/' ? '/' : route.path.replace(/^\//, ''),
                    element: route.element
                };

                // Handle nested routes
                if (route.children && route.children.length > 0) {
                    // For routes with children, we'll create the children array
                    routeObject.children = transformRoutes(route.children);
                    
                    // Add an index route that redirects to first child
                    routeObject.children.unshift({
                        index: true,
                        element: <Navigate to={route.children[0].path.replace(/^\//, '')} replace />
                    });
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
                <Sidebar />
                <Content>
                    {routeElements}
                </Content>
            </Layout>
        </Layout>
    );
};

export default MainLayout;
