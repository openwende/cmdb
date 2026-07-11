import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Divider, Form, Input, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DEMO_ADMIN_PASSWORD,
  DEMO_ADMIN_USERNAME,
  isDemoLoginEnabled,
} from '@/constants/auth';
import { useAuthStore } from '@/store/AuthStore';
import './style.css';

type LoginLocationState = {
  from?: string;
};

type LoginFormValues = {
  username: string;
  password: string;
};

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm<LoginFormValues>();
  const { login, initialize, initialized, loading, token, user } = useAuthStore();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const demoLoginEnabled = useMemo(() => isDemoLoginEnabled(), []);

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

  const authenticate = async (username: string, password: string) => {
    setErrorMessage(null);
    try {
      await login(username, password);
      navigate(redirectTarget, { replace: true });
    } catch (error: any) {
      // Always use i18n for auth errors; backend error strings are not localized
      const status = error?.response?.status;
      const errorKey =
        status === 401 ? 'auth.login.messages.invalidCredentials' : 'common.errors.requestFailed';
      setErrorMessage(t(errorKey));
    }
  };

  const handleFinish = async (values: LoginFormValues) => {
    await authenticate(values.username, values.password);
  };

  const handleDemoLogin = async () => {
    form.setFieldsValue({
      username: DEMO_ADMIN_USERNAME,
      password: DEMO_ADMIN_PASSWORD,
    });
    await authenticate(DEMO_ADMIN_USERNAME, DEMO_ADMIN_PASSWORD);
  };

  return (
    <div className="login-page">
      <div className="login-page__shell">
        <div className="login-page__intro">
          <span className="login-page__eyebrow">{t('common.layout.platformName')}</span>
          <Typography.Title level={1}>{t('auth.login.title')}</Typography.Title>
          <Typography.Paragraph>{t('auth.login.subtitle')}</Typography.Paragraph>
          {demoLoginEnabled ? (
            <Typography.Paragraph className="login-page__hint">
              {t('auth.login.defaultAccount')}
            </Typography.Paragraph>
          ) : null}
        </div>

        <Card className="login-page__card" variant="borderless">
          <Form
            form={form}
            layout="vertical"
            onFinish={handleFinish}
            autoComplete="off"
            initialValues={
              demoLoginEnabled
                ? {
                    username: DEMO_ADMIN_USERNAME,
                    password: DEMO_ADMIN_PASSWORD,
                  }
                : undefined
            }
          >
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

            {demoLoginEnabled ? (
              <>
                <Divider plain className="login-page__divider">
                  {t('auth.login.or')}
                </Divider>
                <Button block loading={loading} onClick={() => void handleDemoLogin()}>
                  {t('auth.login.demoLogin')}
                </Button>
                <Typography.Paragraph type="secondary" className="login-page__demo-tip">
                  {t('auth.login.demoLoginTip')}
                </Typography.Paragraph>
              </>
            ) : null}
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
