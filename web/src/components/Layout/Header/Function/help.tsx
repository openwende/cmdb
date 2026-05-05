import React from 'react';
import { useTranslation } from 'react-i18next';
import './style.css';

const Help: React.FC = () => {
  const { t } = useTranslation();
  return <span className="header-help">{t('common.layout.help')}</span>;
};

export default Help;
