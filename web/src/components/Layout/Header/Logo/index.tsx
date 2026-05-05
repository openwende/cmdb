import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import logoImage from '@/assets/images/logo.png';
import '../style.css';

const Logo: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <button type="button" className="header-logo" onClick={() => navigate('/')}>
      <img src={logoImage} alt={t('common.layout.platformName')} className="header-logo-image" />
      <span>{t('common.layout.platformName')}</span>
    </button>
  );
};

export default Logo;
