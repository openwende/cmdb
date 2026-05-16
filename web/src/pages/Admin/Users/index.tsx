import React, { useCallback, useEffect, useState } from 'react';
import { Button, Drawer, Form, Input, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  AuthManagedUser,
  CreateAuthUserPayload,
  UpdateAuthUserPayload,
  createAuthUser,
  listAuthUsers,
  resetAuthUserPassword,
  updateAuthUser,
} from '@/api/services/auth';
import { useTranslation } from 'react-i18next';
import {
  buildPasswordRules,
  getUserManagementErrorMessage,
  normalizePassword,
} from './passwordValidation';
import './style.css';

const ROLE_OPTIONS = ['admin', 'editor', 'viewer'];
const STATUS_OPTIONS = ['active', 'disabled'];

const UserDrawer: React.FC<{
  open: boolean;
  loading: boolean;
  mode: 'create' | 'edit';
  initialUser?: AuthManagedUser | null;
  onClose: () => void;
  onSubmit: (payload: CreateAuthUserPayload | { display_name: string; status: string; role: string }) => Promise<void>;
}> = ({ open, loading, mode, initialUser, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const passwordRules = buildPasswordRules(t);

  useEffect(() => {
    if (!open) {
      form.resetFields();
      return;
    }

    if (mode === 'edit' && initialUser) {
      form.setFieldsValue({
        username: initialUser.username,
        display_name: initialUser.display_name,
        status: initialUser.status,
        role: initialUser.role,
      });
      return;
    }

    form.setFieldsValue({
      status: 'active',
      role: 'viewer',
    });
  }, [form, initialUser, mode, open]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    if (mode === 'create') {
      await onSubmit({
        username: values.username.trim(),
        display_name: values.display_name.trim(),
        password: normalizePassword(values.password),
        role: values.role,
      });
      return;
    }

    await onSubmit({
      display_name: values.display_name.trim(),
      status: values.status,
      role: values.role,
    });
  };

  return (
    <Drawer
      title={mode === 'create' ? t('auth.userManagement.actions.create') : t('auth.userManagement.actions.edit')}
      width={480}
      open={open}
      onClose={onClose}
      destroyOnClose
      forceRender
      extra={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="primary" loading={loading} onClick={handleSubmit}>
            {t('common.submit')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label={t('auth.userManagement.fields.username')}
          name="username"
          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
        >
          <Input disabled={mode === 'edit'} placeholder={t('auth.userManagement.placeholders.username')} />
        </Form.Item>
        <Form.Item
          label={t('auth.userManagement.fields.displayName')}
          name="display_name"
          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
        >
          <Input placeholder={t('auth.userManagement.placeholders.displayName')} />
        </Form.Item>
        {mode === 'create' && (
          <Form.Item
            label={t('auth.userManagement.fields.password')}
            name="password"
            rules={passwordRules}
            validateFirst
          >
            <Input.Password placeholder={t('auth.userManagement.placeholders.password')} />
          </Form.Item>
        )}
        {mode === 'edit' && (
          <Form.Item
            label={t('auth.userManagement.fields.status')}
            name="status"
            rules={[{ required: true, message: t('common.form.rulesMessage') }]}
          >
            <Select
              options={STATUS_OPTIONS.map((status) => ({
                value: status,
                label: t(`auth.userManagement.status.${status}`),
              }))}
            />
          </Form.Item>
        )}
        <Form.Item
          label={t('auth.userManagement.fields.role')}
          name="role"
          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
        >
          <Select
            options={ROLE_OPTIONS.map((role) => ({
              value: role,
              label: t(`auth.userManagement.roles.${role}`),
            }))}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

const PasswordDrawer: React.FC<{
  open: boolean;
  loading: boolean;
  user?: AuthManagedUser | null;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}> = ({ open, loading, user, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const passwordRules = buildPasswordRules(t);

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [form, open]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    await onSubmit(normalizePassword(values.password));
  };

  return (
    <Drawer
      title={t('auth.userManagement.actions.resetPassword')}
      width={420}
      open={open}
      onClose={onClose}
      destroyOnClose
      forceRender
      extra={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="primary" loading={loading} onClick={handleSubmit}>
            {t('common.submit')}
          </Button>
        </Space>
      }
    >
      <div className="user-admin__password-hint">
        {user ? `${t('auth.userManagement.fields.username')}：${user.username}` : ''}
      </div>
      <Form form={form} layout="vertical">
        <Form.Item
          label={t('auth.userManagement.fields.password')}
          name="password"
          rules={passwordRules}
          validateFirst
        >
          <Input.Password placeholder={t('auth.userManagement.placeholders.password')} />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

const UserManagementPage: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<AuthManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [passwordDrawerVisible, setPasswordDrawerVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthManagedUser | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await listAuthUsers();
      setUsers(response.items || []);
    } catch (error) {
      console.error(error);
      message.error(t('auth.userManagement.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleCreate = () => {
    setEditingUser(null);
    setDrawerMode('create');
    setDrawerVisible(true);
  };

  const handleEdit = (user: AuthManagedUser) => {
    setEditingUser(user);
    setDrawerMode('edit');
    setDrawerVisible(true);
  };

  const handleOpenPasswordDrawer = (user: AuthManagedUser) => {
    setEditingUser(user);
    setPasswordDrawerVisible(true);
  };

  const handleSubmitUser = async (
    payload: CreateAuthUserPayload | { display_name: string; status: string; role: string },
  ) => {
    try {
      setSubmitting(true);
      if (drawerMode === 'create') {
        await createAuthUser(payload as CreateAuthUserPayload);
        message.success(t('common.message.createSuccess'));
      } else if (editingUser) {
        await updateAuthUser(editingUser.id, payload as UpdateAuthUserPayload);
        message.success(t('common.message.updateSuccess'));
      }
      setDrawerVisible(false);
      await fetchUsers();
    } catch (error: unknown) {
      console.error(error);
      message.error(
        getUserManagementErrorMessage(
          error,
          drawerMode === 'create' ? t('common.message.createFailed') : t('common.message.updateFailed'),
          t,
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (password: string) => {
    if (!editingUser) return;
    try {
      setPasswordSubmitting(true);
      await resetAuthUserPassword(editingUser.id, { password });
      message.success(t('auth.userManagement.messages.passwordResetSuccess'));
      setPasswordDrawerVisible(false);
    } catch (error: unknown) {
      console.error(error);
      message.error(getUserManagementErrorMessage(error, t('common.message.updateFailed'), t));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const columns: ColumnsType<AuthManagedUser> = [
    {
      title: t('auth.userManagement.columns.username'),
      dataIndex: 'username',
      width: 180,
    },
    {
      title: t('auth.userManagement.columns.displayName'),
      dataIndex: 'display_name',
      width: 180,
    },
    {
      title: t('auth.userManagement.columns.role'),
      dataIndex: 'role',
      width: 120,
      render: (value: string) => <Tag color="blue">{t(`auth.userManagement.roles.${value}`)}</Tag>,
    },
    {
      title: t('auth.userManagement.columns.status'),
      dataIndex: 'status',
      width: 120,
      render: (value: string) =>
        value === 'active' ? (
          <Tag color="green">{t('auth.userManagement.status.active')}</Tag>
        ) : (
          <Tag color="default">{t('auth.userManagement.status.disabled')}</Tag>
        ),
    },
    {
      title: t('auth.userManagement.columns.lastLoginAt'),
      dataIndex: 'last_login_at',
      width: 180,
      render: (value?: string | null) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
    {
      title: t('auth.userManagement.columns.updatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
    {
      title: t('auth.userManagement.columns.actions'),
      key: 'actions',
      width: 220,
      render: (_value, record) => (
        <Space size="middle">
          <Button type="link" className="table-link-button" onClick={() => handleEdit(record)}>
            {t('auth.userManagement.actions.edit')}
          </Button>
          <Button
            type="link"
            className="table-link-button"
            onClick={() => handleOpenPasswordDrawer(record)}
          >
            {t('auth.userManagement.actions.resetPassword')}
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="user-admin">
      <div className="user-admin__toolbar">
        <div>
          <div className="user-admin__title">{t('auth.userManagement.title')}</div>
          <div className="user-admin__subtitle">{t('auth.userManagement.subtitle')}</div>
        </div>
        <Space>
          <Button onClick={() => void fetchUsers()}>{t('resource.model.actions.refresh')}</Button>
          <Button type="primary" onClick={handleCreate}>
            {t('auth.userManagement.actions.create')}
          </Button>
        </Space>
      </div>

      <Table<AuthManagedUser>
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={users}
        pagination={false}
      />

      <UserDrawer
        open={drawerVisible}
        loading={submitting}
        mode={drawerMode}
        initialUser={editingUser}
        onClose={() => setDrawerVisible(false)}
        onSubmit={handleSubmitUser}
      />

      <PasswordDrawer
        open={passwordDrawerVisible}
        loading={passwordSubmitting}
        user={editingUser}
        onClose={() => setPasswordDrawerVisible(false)}
        onSubmit={handleResetPassword}
      />
    </div>
  );
};

export default UserManagementPage;
