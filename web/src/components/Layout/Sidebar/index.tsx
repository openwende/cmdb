import React, { Fragment } from "react";
import { Layout, Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '../../../routes';
import './style.css';

const { Sider } = Layout;

const Sidebar: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Determine which top-level section we're in
    const getCurrentTopLevel = () => {
        const path = location.pathname;
        return routes.find(nav => 
            path === nav.path || path.startsWith(`${nav.path}/`)
        );
    };
    
    const currentSection = getCurrentTopLevel();
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
            {sidebarItems.length > 0 ? <Sider className="app-sidebar" width={200}>
                <Menu
                    mode="inline"
                    selectedKeys={[getSelectedKey()]}
                    style={{ height: '100%', borderRight: 0 }}
                    onClick={({ key }) => {
                        const item = sidebarItems.find(item => item.key === key);
                        if (item) {
                            navigate(item.path);
                        }
                    }}
                    items={sidebarItems.map(item => ({
                        key: item.key,
                        label: item.name
                    }))}
                />
            </Sider> : null}
        </Fragment>
    );
};

export default Sidebar;