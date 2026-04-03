import React from 'react';
import { useTranslation } from 'react-i18next';

const Login: React.FC = () => {
  const { t } = useTranslation();
  return <div>{t('common.layout.login')}</div>;
};

export default Login;
