import React from 'react';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/AuthStore';
import { LOGIN_PATH } from '@/constants/auth';
import './style.css';

const Login: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, token, initialized, logout } = useAuthStore();

  if (!user) {
    // 刷新时鉴权还没回来（token 仍在、用户信息未到），先什么都不渲染，
    // 避免头部闪一下“登录”按钮再变回用户名。
    if (token && !initialized) {
      return null;
    }

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
      <Button
        type="text"
        className="header-auth-button header-auth-trigger"
        icon={<DownOutlined />}
        iconPosition="end"
      >
        {user.display_name || user.username}
      </Button>
    </Dropdown>
  );
};

export default Login;
