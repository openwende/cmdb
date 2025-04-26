import React from "react";
import { Layout } from 'antd';
import './style.css';

const { Sider } = Layout;

const Sidebar: React.FC = () => {
    return <Sider className="app-sidebar">
        Siderbar
    </Sider>
}

export default Sidebar;