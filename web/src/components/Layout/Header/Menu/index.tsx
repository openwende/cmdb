import React, { useEffect, useMemo } from 'react';
import { Menu as AntMenu, message } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { routes } from '../../../../routes';
import { PrimaryNavKey } from '../../../../routes/Types';
import { useBusinessStore } from '../../../../store/BusinessStore';
import { getBusinessTopologyPath, isBusinessRelatedPage } from '@/utils/routes';
import '../style.css';

const Menu: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { businessList, loadBusinessData, loading } = useBusinessStore();

  useEffect(() => {
    if (businessList.length === 0 && !loading) {
      loadBusinessData();
    }
  }, [businessList.length, loadBusinessData, loading]);

  const menuItems = useMemo(() => {
    return routes
      .filter((item) => !item.hideInMenu)
      .map((item) => ({
        key: item.key,
        label: item.name ? t(item.name) : '',
      }));
  }, [t]);

  // Determine which menu item is active based on the current path
  const getSelectedKey = () => {
    const path = location.pathname;

    // Special handling: business related paths
    if (isBusinessRelatedPage(path)) {
      return PrimaryNavKey.Business;
    }

    const selectedItem = routes.find(
      (item) => path === item.path || path.startsWith(`${item.path}/`),
    );
    return selectedItem ? selectedItem.key : routes[0].key;
  };

  const onMenuClick = (key: any) => {
    const item = routes.find((nav) => nav.key === key);
    if (item) {
      // Special handling for business and business set
      if (key === PrimaryNavKey.Business) {
        // Check if current path is already under business
        if (isBusinessRelatedPage(location.pathname)) {
          // If already in a specific business path, do nothing
          return;
        }

        // If business data exists, navigate directly to the first business
        if (businessList.length > 0) {
          const firstBusiness = businessList[0];
          navigate(getBusinessTopologyPath(firstBusiness.id));
        } else {
          // If no business data, load data first, then navigate
          loadBusinessData()
            .then(() => {
              const { businessList: updatedList } = useBusinessStore.getState();
              if (updatedList.length > 0) {
                navigate(getBusinessTopologyPath(updatedList[0].id));
              } else {
                message.warning('No business data available');
              }
            })
            .catch(() => {
              message.error('Failed to load business data');
            });
        }
        return;
      }

      // Handling for other navigation items
      if (item.children?.length) {
        // Find first child that has a real path (skip index routes)
        const firstRoutableChild = item.children.find((c) => c.path && !c.index);
        if (firstRoutableChild?.path) {
          navigate(`${item.path}/${firstRoutableChild.path}`);
        } else {
          // Fall back to parent path — index route will redirect
          navigate(item.path!);
        }
      } else {
        // If no child routes, navigate directly
        navigate(item.path!);
      }
    }
  };

  return (
    <AntMenu
      mode="horizontal"
      selectedKeys={[getSelectedKey()]}
      className="header-menu"
      theme="dark"
      items={menuItems}
      onClick={({ key }) => onMenuClick(key)}
    />
  );
};

export default React.memo(Menu);
