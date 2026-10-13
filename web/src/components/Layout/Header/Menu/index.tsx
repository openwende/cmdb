import React, { useEffect, useMemo } from 'react';
import { Menu as AntMenu, Modal } from 'antd';
import { useAppMessage } from '@/utils/message';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { routes } from '../../../../routes';
import { PrimaryNavKey } from '../../../../routes/Types';
import { useBusinessStore } from '../../../../store/BusinessStore';
import { useAuthStore } from '@/store/AuthStore';
import { getBusinessTopologyPath, isBusinessRelatedPage } from '@/utils/routes';
import '../style.css';

const Menu: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const message = useAppMessage();
  const { businessList, loadBusinessData, loading, error } = useBusinessStore();
  // 选出"是否 admin"而不是只取 hasRole：hasRole 是稳定引用，用户信息异步加载完
  // 不会让 menuItems 重算，刷新页面后"用户管理"就一直不出现
  const isAdmin = useAuthStore((state) => state.hasRole('admin'));

  useEffect(() => {
    if (businessList.length === 0 && !loading) {
      loadBusinessData();
    }
  }, [businessList.length, loadBusinessData, loading]);

  const menuItems = useMemo(() => {
    return routes
      .filter((item) => !item.hideInMenu)
      .filter((item) => item.key !== PrimaryNavKey.AdminUsers || isAdmin)
      .map((item) => ({
        key: item.key,
        label: item.name ? t(item.name) : '',
      }));
  }, [isAdmin, t]);

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
        } else if (error || loading) {
          // API error or still loading: show error toast, don't show misleading "create" modal
          if (error) {
            message.error(t('business.messages.loadBusinessFailed'));
          }
        } else {
          // Truly no business data after successful load: prompt to create
          Modal.confirm({
            title: t('business.messages.noBusinessData'),
            content: t('business.messages.noBusinessRedirect'),
            onOk: () => navigate('/resource/business'),
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
