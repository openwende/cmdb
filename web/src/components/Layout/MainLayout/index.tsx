import React from 'react';
import { Layout } from 'antd';
import Header from '../Header';
import Sidebar from '../Sidebar';
import Content from '../Content';
import './style.css';

const MainLayout: React.FC = () => {
    return (
        <Layout className="app-layout">
            <Header />
            <Layout>
                <Sidebar />
                <Content />
            </Layout>
        </Layout>
    )
}


export default MainLayout;
