import React, { useState } from 'react';
import { Layout } from 'antd';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Header from '../Header';
import Sidebar from '../Sidebar';
import Content from '../Content';
import HomePage from '../../../pages/Home';
import BusinessPage from '../../../pages/Business';
import ResourcePage from '../../../pages/Resource';
import NotFoundPage from '../../../pages/NotFound';
import './style.css';
import BusinessTopology from '../../../pages/Business/BusinessTopology';
import ServiceTemplate from '../../../pages/Business/ServiceTemplate';
import { Navigation, PrimaryNavKey, BusinessNavKey } from '../Types';

const navigation: Navigation[] = [
    {
        name: '首页',
        key: PrimaryNavKey.Home,
        path: '/',
        element: <HomePage />
    },
    {
        name: '业务',
        key: PrimaryNavKey.Business,
        path: '/business',
        element: <BusinessPage />,
        children: [
            {
                name: '业务拓扑',
                key: BusinessNavKey.Topology,
                path: '/business/topology',
                element: <BusinessTopology />
            },
            {
                name: '服务模板',
                key: BusinessNavKey.Template,
                path: '/business/template',
                element: <ServiceTemplate />
            }
        ]
    },
    {
        name: '资源',
        key: PrimaryNavKey.Resource,
        path: '/resource',
        element: <ResourcePage />
    }
]

const MainLayout: React.FC = () => {
    const [activeTopMenu, setActiveTopMenu] = useState()
    const location = useLocation();
    return (
        <Layout className="app-layout">
            <Header />
            <Layout>
                <Sidebar />
                <Content >
                    <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/business" element={<BusinessPage />} />
                    <Route path="/resource" element={<ResourcePage />} />
                    <Route path='*' element={<NotFoundPage />}></Route>
                    </Routes>
                </Content>
            </Layout>
        </Layout>
    )
}


export default MainLayout;
