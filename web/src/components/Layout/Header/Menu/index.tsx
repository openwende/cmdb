import React, { useEffect } from 'react';
import { Menu as AntMenu, message } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { routes } from '../../../../routes';
import { PrimaryNavKey } from '../../../../routes/Types';
import { useBusinessStore } from '../../../../store/BusinessStore';
import '../style.css';

const Menu: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    // Get business data
    const { businessList, loadBusinessData, loading } = useBusinessStore();

    // Ensure business data is loaded when component mounts
    useEffect(() => {
        if (businessList.length === 0 && !loading) {
            loadBusinessData();
        }
    }, [businessList.length, loadBusinessData, loading]);

    // Determine which menu item is active based on the current path
    const getSelectedKey = () => {
        const path = location.pathname;

        // Special handling: business related paths
        if (path.startsWith('/business')) {
            return PrimaryNavKey.Business;
        }

        const selectedItem = routes.find(item =>
            path === item.path || path.startsWith(`${item.path}/`)
        );
        return selectedItem ? selectedItem.key : routes[0].key;
    };

    const onMenuClick = (key: any) => {
        const item = routes.find(nav => nav.key === key);
        if (item) {
            // Special handling for business and business set
            if (key === PrimaryNavKey.Business) {
                // Check if current path is already under business
                if (location.pathname.startsWith('/business/')) {
                    // If already in a specific business path, do nothing
                    return;
                }

                // If business data exists, navigate directly to the first business
                if (businessList.length > 0) {
                    const firstBusiness = businessList[0];
                    navigate(`/business/${firstBusiness.id}/topology`);
                } else {
                    // If no business data, load data first, then navigate
                    loadBusinessData().then(() => {
                        const { businessList: updatedList } = useBusinessStore.getState();
                        if (updatedList.length > 0) {
                            navigate(`/business/${updatedList[0].id}/topology`);
                        } else {
                            message.warning('No business data available');
                        }
                    }).catch(() => {
                        message.error('Failed to load business data');
                    });
                }
                return;
            }

            // Handling for other navigation items
            if (item.children?.length) {
                // If has child routes, navigate to the first child route
                const childPath = `${item.path}/${item.children[0].path}`;
                navigate(childPath);
            } else {
                // If no child routes, navigate directly
                navigate(item.path);
            }
        }
    }

    return (
        <AntMenu
            mode="horizontal"
            selectedKeys={[getSelectedKey()]}
            className="header-menu"
            theme="dark"
            onClick={({ key }) => onMenuClick(key)}
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