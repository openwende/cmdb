import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/AuthStore';
import './style.css';

type LoginLocationState = {
  from?: string;
};

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { login, initialize, initialized, loading, token, user } = useAuthStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const redirectTarget = useMemo(() => {
    const state = location.state as LoginLocationState | null;
    return state?.from || '/';
  }, [location.state]);

  useEffect(() => {
    if (!initialized) {
      void initialize();
    }
  }, [initialize, initialized]);

  useEffect(() => {
    if (initialized && token && user) {
      navigate(redirectTarget, { replace: true });
    }
  }, [initialized, navigate, redirectTarget, token, user]);

  const handleFinish = async (values: { username: string; password: string }) => {
    setErrorMessage(null);
    try {
      await login(values.username, values.password);
      navigate(redirectTarget, { replace: true });
    } catch (error: any) {
      // Always use i18n for auth errors; backend error strings are not localized
      const status = error?.response?.status;
      const errorKey =
        status === 401 ? 'auth.login.messages.invalidCredentials' : 'common.errors.requestFailed';
      setErrorMessage(t(errorKey));
    }
  };

  return (
    <div className="login-page">
      <div className="login-page__shell">
        <div className="login-page__intro">
          <span className="login-page__eyebrow">{t('common.layout.platformName')}</span>
          <Typography.Title level={1}>{t('auth.login.title')}</Typography.Title>
          <Typography.Paragraph>{t('auth.login.subtitle')}</Typography.Paragraph>
        </div>

        <Card className="login-page__card" variant="borderless">
          <Form layout="vertical" onFinish={handleFinish} autoComplete="off">
            <Form.Item
              label={t('auth.login.fields.username')}
              name="username"
              rules={[{ required: true, message: t('common.form.rulesMessage') }]}
            >
              <Input placeholder={t('auth.login.placeholders.username')} />
            </Form.Item>

            <Form.Item
              label={t('auth.login.fields.password')}
              name="password"
              rules={[{ required: true, message: t('common.form.rulesMessage') }]}
            >
              <Input.Password placeholder={t('auth.login.placeholders.password')} />
            </Form.Item>

            {errorMessage ? (
              <Alert className="login-page__alert" type="error" showIcon message={errorMessage} />
            ) : null}

            <Button type="primary" htmlType="submit" block loading={loading}>
              {t('auth.login.submit')}
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
