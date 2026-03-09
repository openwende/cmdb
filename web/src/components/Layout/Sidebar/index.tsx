import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout, Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import './style.css';
import { NavigationItem, PrimaryNavKey, EntityRouteType } from '../../../routes/Types';
import { MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import BusinessSelector from '../../Business/BusinessSelector';
import { routes } from '../../../routes';
import {
  isBusinessSetPage,
  isBusinessPage,
  isBusinessRelatedPage,
  buildEntityPath,
} from '../../../utils/routes';

const { Sider } = Layout;

const SIDEBAR_COLLAPSED_WIDTH = 60;
const SIDEBAR_EXPANDED_WIDTH = 220;

interface SidebarProps {
  currentSection: NavigationItem | undefined;
  isMobile?: boolean;
  isTablet?: boolean;
  sidebarOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentSection,
  isMobile = false,
  isTablet = false,
  sidebarOpen = false,
  onClose,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  // On tablet, force collapsed; on mobile, never collapse (it's full-width overlay)
  const effectiveCollapsed = isTablet ? true : isMobile ? false : collapsed;

  // Get sidebar menu items
  // if current path is a business set, get menu items from business set configuration
  const getSidebarItems = (): NavigationItem[] => {
    // If there's no current section, return empty array
    if (!currentSection) return [];

    // Check if the path is for a business set
    if (isBusinessSetPage(location.pathname)) {
      // Find business set configuration from routes
      const businessSetRoute = routes.find((route: NavigationItem) => {
        return route.key === PrimaryNavKey.BusinessSet;
      });
      return businessSetRoute?.children || [];
    }

    // Default: return the current section's children
    return currentSection.children || [];
  };

  // Check if current path matches route pattern (supports dynamic params like :id)
  const matchesRoute = (currentPath: string, routePattern: string): boolean => {
    const currentSegments = currentPath.split('/').filter(Boolean);
    const patternSegments = routePattern.split('/').filter(Boolean);

    if (currentSegments.length !== patternSegments.length) return false;

    return patternSegments.every(
      (pattern, index) => pattern.startsWith(':') || pattern === currentSegments[index],
    );
  };

  const sidebarItems = getSidebarItems();

  // Get the currently selected sidebar item
  const getSelectedKey = () => {
    const path = location.pathname;

    if (sidebarItems.length > 0) {
      // Special handling for business set paths
      if (isBusinessSetPage(path)) {
        // Extract current page type from path
        const pathSegments = path.split('/');
        if (pathSegments.length >= 4) {
          // Get the last segment as the current page type
          const pageType = pathSegments[3]; // e.g., topology
          // Find the matching item in sidebar items
          const selectedItem = sidebarItems.find((item: NavigationItem) => {
            return item.path === pageType;
          });
          return selectedItem ? selectedItem.key : '';
        }
      } else {
        // Regular path handling
        // First try direct path matching (with dynamic route support)
        let selectedItem = sidebarItems.find((item: NavigationItem) => {
          if (!item.path) return false;
          // Build full path for matching
          const fullPattern = `${currentSection?.path}/${item.path}`;
          return matchesRoute(path, fullPattern);
        });

        // If no exact match found, check if current path matches any child route
        if (!selectedItem) {
          selectedItem = sidebarItems.find((item: NavigationItem) => {
            if (!item.children || !item.path) return false;

            return item.children.some((child: NavigationItem) => {
              if (child.path) {
                // Build full child path pattern
                const childPattern = `${currentSection?.path}/${item.path}/${child.path}`;
                return matchesRoute(path, childPattern);
              }
              // For index routes, check if path matches parent
              if (child.index) {
                const parentPattern = `${currentSection?.path}/${item.path}`;
                return matchesRoute(path, parentPattern);
              }
              return false;
            });
          });
        }

        return selectedItem ? selectedItem.key : '';
      }
    }

    // Fallback for dynamic sub-routes (e.g., /model/:name/basic → highlight 'overview')
    // If path starts with the current section's path but no sidebar item matched,
    // return the key of the first visible sidebar item as a contextual hint
    if (currentSection?.path && location.pathname.startsWith(currentSection.path + '/')) {
      const firstVisible = sidebarItems.find((item: NavigationItem) => !item.hideInMenu && item.path);
      if (firstVisible) return firstVisible.key;
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
      if (isBusinessPage(location.pathname)) {
        fullPath = item.path
          ? buildEntityPath(pathSegments, EntityRouteType.Business, item.path)
          : '';
      }
      // Check if current path is business set related
      else if (isBusinessSetPage(location.pathname)) {
        fullPath = item.path
          ? buildEntityPath(pathSegments, EntityRouteType.BusinessSet, item.path)
          : '';
      }
      // Other paths
      else if (currentSection) {
        // Use original logic directly
        fullPath =
          item.path && item.path.startsWith('/')
            ? item.path
            : `${currentSection.path}/${item.path || ''}`;
      }
      navigate(fullPath);
    }
  };

  // Check if we're in business or business set related section
  const isBusinessRelated = isBusinessRelatedPage(location.pathname);

  const selectedKey = getSelectedKey();

  const menuItems = useMemo(() => {
    return sidebarItems
      .filter((item: NavigationItem) => !item.hideInMenu)
      .map((item: NavigationItem) => ({
        key: item.key,
        label: item.name ? t(item.name) : '',
        icon: item.icon,
      }));
  }, [t, sidebarItems]);

  // Nothing to show
  if (sidebarItems.length === 0) return null;

  // --- Mobile: overlay sidebar ---
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {sidebarOpen && (
          <div
            className="sidebar-backdrop"
            onClick={onClose}
            aria-hidden="true"
          />
        )}
        <Sider
          className={`app-sidebar app-sidebar--mobile ${sidebarOpen ? 'app-sidebar--open' : ''}`}
          width={SIDEBAR_EXPANDED_WIDTH}
        >
          {isBusinessRelated && <BusinessSelector collapsed={false} />}
          <Menu
            key={location.pathname}
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            className="sidebar-menu"
            onClick={({ key }) => onMenuClick(key as string)}
          />
        </Sider>
      </>
    );
  }

  // --- Desktop / Tablet ---
  return (
    <Sider
      className="app-sidebar"
      width={effectiveCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH}
    >
      {/* Display business selector in business and business set sections */}
      {isBusinessRelated && <BusinessSelector collapsed={effectiveCollapsed} />}
      <Menu
        key={location.pathname}
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        inlineCollapsed={effectiveCollapsed}
        className="sidebar-menu"
        onClick={({ key }) => onMenuClick(key as string)}
      />
      {/* Hide the collapse toggle on tablet (always collapsed) */}
      {!isTablet && (
        <button
          type="button"
          onClick={toggleCollapsed}
          className="menu-toggler"
          aria-label={collapsed ? t('common.layout.expandSidebar') : t('common.layout.collapseSidebar')}
          aria-expanded={!collapsed}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </button>
      )}
    </Sider>
  );
};

export default Sidebar;
