import React, { Fragment, useState } from "react";
import { Layout, Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import './style.css';
import { NavigationItem, PrimaryNavKey } from "../../../routes/Types";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import BusinessSelector from "../../Business/BusinessSelector";
import { routes } from "../../../routes";

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

    // Get sidebar menu items
    // if current path is a business set, get menu items from business set configuration
    const getSidebarItems = (): NavigationItem[] => {
        // If there's no current section, return empty array
        if (!currentSection) return [];

        // Check if the path is for a business set
        if (location.pathname.startsWith('/business-set')) {
            // Find business set configuration from routes
            const businessSetRoute = routes.find((route: NavigationItem) => route.key === PrimaryNavKey.BusinessSet);
            return businessSetRoute?.children || [];
        }

        // Default: return the current section's children
        return currentSection.children || [];
    };

    const sidebarItems = getSidebarItems();

    // Get the currently selected sidebar item
    const getSelectedKey = () => {
        const path = location.pathname;
        if (sidebarItems.length > 0) {
            // Special handling for business set paths
            if (path.startsWith('/business-set/')) {
                // Extract current page type from path
                const pathSegments = path.split('/');
                if (pathSegments.length >= 4) {
                    // Get the last segment as the current page type
                    const pageType = pathSegments[3]; // e.g., topology
                    // Find the matching item in sidebar items
                    const selectedItem = sidebarItems.find((item: NavigationItem) => item.path === pageType);
                    return selectedItem ? selectedItem.key : '';
                }
            } else {
                // Regular path handling
                const selectedItem = sidebarItems.find((item: NavigationItem) => path.endsWith(item.path));
                return selectedItem ? selectedItem.key : '';
            }
        }
        return '';
    };

    const onMenuClick = (key: string) => {
        const item = sidebarItems.find((item: NavigationItem) => item.key === key);
        if (item) {
            // Get business or business set ID from current URL
            const pathSegments = location.pathname.split('/');
            let fullPath = '';

            // Check if current path is business related
            if (location.pathname.startsWith('/business/')) {
                if (pathSegments.length >= 3) {
                    // Business path: replace :businessId parameter
                    const businessId = pathSegments[2];
                    if (businessId && businessId !== ':businessId') {
                        fullPath = `/business/${businessId}/${item.path}`;
                    } else {
                        // If no valid business ID, return to business home page
                        navigate('/business');
                        return;
                    }
                }
            }
            // Check if current path is business set related
            else if (location.pathname.startsWith('/business-set/')) {
                if (pathSegments.length >= 3) {
                    // Business set path: replace :businessSetId parameter
                    const businessSetId = pathSegments[2];
                    if (businessSetId && businessSetId !== ':businessSetId') {
                        fullPath = `/business-set/${businessSetId}/${item.path}`;
                    } else {
                        // If no valid business set ID, return to business set home page
                        navigate('/business-set');
                        return;
                    }
                }
            }
            // Other paths
            else if (currentSection) {
                // Use original logic directly
                fullPath = item.path.startsWith('/')
                    ? item.path
                    : `${currentSection.path}/${item.path}`;
            }

            navigate(fullPath);
        }
    }

    // Check if we're in business or business set related section
    const isBusinessRelated = location.pathname.startsWith('/business');

    return (
        <Fragment>
            {sidebarItems.length > 0 ? <Sider className="app-sidebar" width={collapsed ? 60 : 260}>
                {/* Display business selector in business and business set sections */}
                {isBusinessRelated && <BusinessSelector collapsed={collapsed} />}
                <Menu
                    mode="inline"
                    selectedKeys={[getSelectedKey()]}
                    onClick={({ key }) => onMenuClick(key as string)}
                    items={sidebarItems.map((item: NavigationItem) => ({
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