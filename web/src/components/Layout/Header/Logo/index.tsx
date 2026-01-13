import React from 'react';
import { useTranslation } from 'react-i18next';
import logoImage from '@/assets/images/logo.png';
import '../style.css';

const Logo: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="header-logo">
      <img src={logoImage} alt="logo" className="header-logo-image" />
      <span>{t('common.layout.platformName')}</span>
    </div>
  );
};

export default Logo;
