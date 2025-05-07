import React, { Fragment, useState } from "react";
import { Layout, Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import './style.css';
import { NavigationItem } from "../../../routes/Types";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";

const { Sider } = Layout;

interface SidebarProps {
    currentSection: NavigationItem | undefined;
}

const Sidebar: React.FC<SidebarProps> = ({ currentSection }) => {
    const [collapsed, setCollapsed] = useState(false);

    const toggleCollapsed = () => {
        setCollapsed(!collapsed);
    };

    const location = useLocation();
    const navigate = useNavigate();
    const sidebarItems = currentSection?.children || [];

    // Get the currently selected sidebar item
    const getSelectedKey = () => {
        const path = location.pathname;
        if (sidebarItems.length > 0) {
            const selectedItem = sidebarItems.find(item => path.endsWith(item.path));
            return selectedItem ? selectedItem.key : '';
        }
        return '';
    };

    const onMenuClick = (key: any) => {
        const item = sidebarItems.find(item => item.key === key);
        if (item && currentSection) {
            const fullPath = item.path.startsWith('/')
                ? item.path
                : `${currentSection.path}/${item.path}`;
            navigate(fullPath);
        }
    }

    return (
        <Fragment>
            {sidebarItems.length > 0 ? <Sider className="app-sidebar" width={collapsed ? 60 : 260}>
                <Menu
                    mode="inline"
                    selectedKeys={[getSelectedKey()]}
                    onClick={({key}) => onMenuClick(key)}
                    items={sidebarItems.map(item => ({
                        key: item.key,
                        label: item.name,
                        icon: item.icon
                    }))}
                    inlineCollapsed={collapsed}
                />
                <div onClick={toggleCollapsed} className="menu-toggler">
                    {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                </div>
            </Sider> : null}
        </Fragment>
    );
};

export default Sidebar;