import React from 'react';
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

  return (
    <div className="header-auth">
      <span className="header-auth__user">{user.display_name || user.username}</span>
      <button type="button" className="header-auth-button" onClick={() => logout(true)}>
        {t('common.layout.logout')}
      </button>
    </div>
  );
};

export default Login;
