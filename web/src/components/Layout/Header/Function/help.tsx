import React from 'react';
import { useTranslation } from 'react-i18next';

const Help: React.FC = () => {
  const { t } = useTranslation();
  return <div>{t('common.layout.help')}</div>;
};

export default Help;
