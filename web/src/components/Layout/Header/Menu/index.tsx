import React from 'react';
import { Menu as AntMenu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '../../../../routes';
import './style.css';

const Menu: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    
    // Determine which menu item is active based on the current path
    const getSelectedKey = () => {
        const path = location.pathname;
        const selectedItem = routes.find(item => 
            path === item.path || path.startsWith(`${item.path}/`)
        );
        return selectedItem ? selectedItem.key : routes[0].key;
    };

    return (
        <AntMenu
            mode="horizontal"
            selectedKeys={[getSelectedKey()]}
            className="header-menu"
            theme="dark"
            onClick={({ key }) => {
                const item = routes.find(nav => nav.key === key);
                if (item) {
                    if (item.children?.length) {
                        // Navigate to the first child if there are children
                        navigate(item.children[0].path);
                    } else {
                        navigate(item.path);
                    }
                }
            }}
            items={routes
                .filter(item => !item.hideInMenu)
                .map(item => ({
                    key: item.key,
                    label: item.name
                }))}
        />
    );
};

export default Menu;