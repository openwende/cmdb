import React, { useEffect, useState } from 'react';
import { Button, Drawer, Form, Input, InputNumber, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { createModelGroup, listModelGroups } from '@/api';
import { CreateModelGroupPayload, ModelGroup } from '@/api/types/model';
import '../../shared.css';

const CreateGroupDrawer: React.FC<{
  visible: boolean;
  loading: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateModelGroupPayload) => Promise<void>;
}> = ({ visible, loading, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (!visible) {
      form.resetFields();
      return;
    }

    form.setFieldsValue({
      sort_order: 100,
    });
  }, [form, visible]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    await onSubmit({
      name: values.name.trim(),
      display_name: values.display_name.trim(),
      description: values.description?.trim() || '',
      sort_order: values.sort_order || 0,
    });
    form.resetFields();
  };

  return (
    <Drawer
      title={t('resource.model.actions.createGroup')}
      width={520}
      open={visible}
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
          label={t('resource.model.fields.groupName')}
          name="name"
          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
        >
          <Input placeholder={t('resource.model.placeholders.groupName')} />
        </Form.Item>
        <Form.Item
          label={t('resource.model.fields.groupDisplayName')}
          name="display_name"
          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
        >
          <Input placeholder={t('resource.model.placeholders.groupDisplayName')} />
        </Form.Item>
        <Form.Item label={t('resource.model.fields.description')} name="description">
          <Input.TextArea rows={3} placeholder={t('resource.model.placeholders.description')} />
        </Form.Item>
        <Form.Item label={t('resource.model.fields.sortOrder')} name="sort_order">
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

const GroupsPage: React.FC = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<ModelGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await listModelGroups();
      setGroups(data);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadGroupsFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreate = async (payload: CreateModelGroupPayload) => {
    try {
      setSubmitting(true);
      await createModelGroup(payload);
      message.success(t('common.message.createSuccess'));
      setDrawerVisible(false);
      await fetchGroups();
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.createGroupFailed'));
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<ModelGroup> = [
    {
      title: t('resource.model.columns.groupDisplayName'),
      dataIndex: 'display_name',
      width: 180,
    },
    {
      title: t('resource.model.columns.groupName'),
      dataIndex: 'name',
      width: 180,
    },
    {
      title: t('resource.model.columns.groupModelCount'),
      dataIndex: 'model_count',
      width: 120,
      render: (value?: number) => value ?? 0,
    },
    {
      title: t('resource.model.columns.attributeSortOrder'),
      dataIndex: 'sort_order',
      width: 120,
    },
    {
      title: t('resource.model.columns.builtIn'),
      dataIndex: 'is_builtin',
      width: 120,
      render: (value: boolean) =>
        value ? <Tag color="gold">{t('resource.model.options.boolean.yes')}</Tag> : '--',
    },
    {
      title: t('resource.model.columns.updatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
  ];

  return (
    <div className="model-page-container">
      <div className="model-page-toolbar">
        <div>
          <div className="model-page-title">{t('resource.model.tabs.groups')}</div>
          <div className="model-page-subtitle">{t('resource.model.helper.groupsPage')}</div>
        </div>
        <div className="model-page-actions">
          <Button type="primary" onClick={() => setDrawerVisible(true)}>
            {t('resource.model.actions.createGroup')}
          </Button>
          <Button onClick={fetchGroups}>{t('resource.model.actions.refresh')}</Button>
        </div>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={groups}
        columns={columns}
        pagination={false}
      />

      <CreateGroupDrawer
        visible={drawerVisible}
        loading={submitting}
        onClose={() => setDrawerVisible(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
};

export default GroupsPage;
