import React, { Fragment, useState } from "react";
import { Button, Layout, Menu } from 'antd';
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
            const selectedItem = sidebarItems.find(item => item.path === path);
            return selectedItem ? selectedItem.key : '';
        }
        return '';
    };

    return (
        <Fragment>
            {sidebarItems.length > 0 ? <Sider className="app-sidebar" width={collapsed ? 60 : 260}>
                <Menu
                    mode="inline"
                    selectedKeys={[getSelectedKey()]}
                    onClick={({ key }) => {
                        const item = sidebarItems.find(item => item.key === key);
                        if (item) {
                            navigate(item.path);
                        }
                    }}
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