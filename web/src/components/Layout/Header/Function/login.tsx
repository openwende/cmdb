import React from 'react';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/AuthStore';
import { LOGIN_PATH } from '@/constants/auth';
import './style.css';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  if (!user) {
    return (
      <button type="button" className="header-auth-button" onClick={() => navigate(LOGIN_PATH)}>
        {t('common.layout.login')}
      </button>
    );
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'logout',
      label: t('common.layout.logout'),
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'logout') {
      logout(true);
    }
  };

  return (
    <Dropdown
      menu={{ items: menuItems, onClick: handleMenuClick }}
      placement="bottom"
      trigger={['hover']}
    >
      <Button type="text" className="header-auth-button header-auth-trigger">
        {user.display_name || user.username}
      </Button>
    </Dropdown>
  );
};

export default Login;
