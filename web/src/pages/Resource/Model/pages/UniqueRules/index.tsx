import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useAppMessage } from '@/utils/message';
import {
  createModelUniqueRule,
  deleteModelUniqueRule,
  listModelUniqueRules,
  updateModelUniqueRule,
} from '@/api';
import {
  CreateModelUniqueRulePayload,
  ModelUniqueRule,
  UpdateModelUniqueRulePayload,
} from '@/api/types/modelUniqueRule';
import { useModelPageContext } from '../../context';

const UniqueRulesPage: React.FC = () => {
  const { t } = useTranslation();
  const message = useAppMessage();
  const { detailModel, attributes, isDynamicModel } = useModelPageContext();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<ModelUniqueRule | null>(null);
  const [rules, setRules] = useState<ModelUniqueRule[]>([]);

  const attributeOptions = useMemo(
    () =>
      attributes.map((attribute) => ({
        value: attribute.name,
        label: `${attribute.display_name} (${attribute.name})`,
      })),
    [attributes],
  );

  const loadRules = async () => {
    if (!isDynamicModel) {
      setRules([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await listModelUniqueRules(detailModel.name);
      setRules(response.data.items || []);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadUniqueRulesFailed'));
      setRules([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [detailModel.name, isDynamicModel]);

  const openCreateDrawer = () => {
    setEditingRule(null);
    form.resetFields();
    form.setFieldsValue({
      is_default: rules.length === 0,
      is_auxiliary: false,
      enabled: true,
      ignore_if_all_empty: true,
      fields: [],
      description: '',
    });
    setDrawerVisible(true);
  };

  const openEditDrawer = (record: ModelUniqueRule) => {
    setEditingRule(record);
    form.setFieldsValue({
      name: record.name,
      is_default: record.is_default,
      is_auxiliary: record.is_auxiliary,
      enabled: record.enabled,
      ignore_if_all_empty: record.ignore_if_all_empty,
      description: record.description || '',
      fields: record.fields,
    });
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    form.resetFields();
    setEditingRule(null);
    setDrawerVisible(false);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();

    try {
      setSubmitting(true);
      if (editingRule) {
        const payload: UpdateModelUniqueRulePayload = {
          name: values.name.trim(),
          is_auxiliary: values.is_auxiliary,
          enabled: values.enabled,
          ignore_if_all_empty: values.ignore_if_all_empty,
          description: values.description?.trim() || '',
          fields: values.fields,
        };
        await updateModelUniqueRule(detailModel.name, editingRule.id, payload);
        message.success(t('common.message.updateSuccess'));
      } else {
        const payload: CreateModelUniqueRulePayload = {
          name: values.name.trim(),
          is_default: values.is_default,
          is_auxiliary: values.is_auxiliary,
          enabled: values.enabled,
          ignore_if_all_empty: values.ignore_if_all_empty,
          description: values.description?.trim() || '',
          fields: values.fields,
        };
        await createModelUniqueRule(detailModel.name, payload);
        message.success(t('common.message.createSuccess'));
      }

      handleCloseDrawer();
      await loadRules();
    } catch (error) {
      console.error(error);
      message.error(
        editingRule
          ? t('resource.model.messages.updateUniqueRuleFailed')
          : t('resource.model.messages.createUniqueRuleFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: ModelUniqueRule) => {
    try {
      await deleteModelUniqueRule(detailModel.name, record.id);
      message.success(t('resource.model.messages.deleteUniqueRuleSuccess'));
      await loadRules();
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.deleteUniqueRuleFailed'));
    }
  };

  const columns: ColumnsType<ModelUniqueRule> = [
    {
      title: t('resource.model.uniques.columns.name'),
      dataIndex: 'name',
      width: 220,
      render: (value: string, record) => (
        <Space wrap>
          <span>{value}</span>
          {record.is_default ? <Tag color="gold">{t('resource.model.uniques.tags.default')}</Tag> : null}
          {record.is_auxiliary ? (
            <Tag color="blue">{t('resource.model.uniques.tags.auxiliary')}</Tag>
          ) : (
            <Tag>{t('resource.model.uniques.tags.standard')}</Tag>
          )}
        </Space>
      ),
    },
    {
      title: t('resource.model.uniques.columns.fields'),
      dataIndex: 'fields',
      render: (values: string[]) =>
        values.length > 0 ? (
          <Space wrap>
            {values.map((field) => (
              <Tag key={field}>{field}</Tag>
            ))}
          </Space>
        ) : (
          '--'
        ),
    },
    {
      title: t('resource.model.uniques.columns.emptyHandling'),
      dataIndex: 'ignore_if_all_empty',
      width: 160,
      render: (value: boolean) =>
        value
          ? t('resource.model.uniques.options.emptyHandling.ignore')
          : t('resource.model.uniques.options.emptyHandling.validate'),
    },
    {
      title: t('resource.model.uniques.columns.status'),
      dataIndex: 'enabled',
      width: 120,
      render: (value: boolean) =>
        value ? (
          <Tag color="green">{t('resource.model.uniques.status.enabled')}</Tag>
        ) : (
          <Tag>{t('resource.model.uniques.status.disabled')}</Tag>
        ),
    },
    {
      title: t('resource.model.columns.updatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
    {
      title: t('resource.model.uniques.columns.actions'),
      key: 'actions',
      width: 160,
      render: (_value, record) => (
        <Space size="middle">
          <Button type="link" onClick={() => openEditDrawer(record)}>
            {t('common.edit')}
          </Button>
          <Popconfirm
            title={t('resource.model.uniques.confirmDelete')}
            onConfirm={() => handleDelete(record)}
            disabled={record.is_default}
          >
            <Button type="link" danger disabled={record.is_default}>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="model-page">
      <Alert
        type="info"
        showIcon
        message={t('resource.model.helper.uniquesDesign')}
        description={t('resource.model.helper.uniquesDesignHint')}
      />

      <div className="model-page-toolbar">
        <div className="model-page-note">{t('resource.model.helper.uniquesListNote')}</div>
        <div className="model-page-actions">
          <Space>
            <Button onClick={() => loadRules()} disabled={!isDynamicModel}>
              {t('resource.model.actions.refresh')}
            </Button>
            <Button
              type="primary"
              onClick={openCreateDrawer}
              disabled={!isDynamicModel || attributeOptions.length === 0}
            >
              {t('resource.model.actions.createUniqueRule')}
            </Button>
          </Space>
        </div>
      </div>

      {!isDynamicModel ? (
        <Alert
          type="warning"
          showIcon
          message={t('resource.model.unsupported.dynamicCapabilityTitle')}
          description={t('resource.model.unsupported.uniqueRules')}
        />
      ) : attributeOptions.length === 0 ? (
        <Empty description={t('resource.model.empty.noAttributes')} />
      ) : rules.length === 0 ? (
        <Empty description={t('resource.model.empty.noUniqueRules')} />
      ) : (
        <Table<ModelUniqueRule>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rules}
          pagination={false}
        />
      )}

      <Drawer
        title={
          editingRule
            ? t('resource.model.actions.editUniqueRule')
            : t('resource.model.actions.createUniqueRule')
        }
        width={560}
        open={drawerVisible}
        onClose={handleCloseDrawer}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={handleCloseDrawer}>{t('common.cancel')}</Button>
            <Button type="primary" loading={submitting} onClick={handleSubmit}>
              {t('common.submit')}
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label={t('resource.model.uniques.fields.name')}
            name="name"
            rules={[{ required: true, message: t('common.form.rulesMessage') }]}
          >
            <Input placeholder={t('resource.model.uniques.placeholders.name')} />
          </Form.Item>

          <Form.Item
            label={t('resource.model.uniques.fields.fields')}
            name="fields"
            rules={[{ required: true, message: t('common.form.rulesMessage') }]}
          >
            <Select
              mode="multiple"
              allowClear
              options={attributeOptions}
              placeholder={t('resource.model.uniques.placeholders.fields')}
            />
          </Form.Item>

          <Form.Item
            label={t('resource.model.uniques.fields.description')}
            name="description"
          >
            <Input.TextArea rows={3} placeholder={t('resource.model.uniques.placeholders.description')} />
          </Form.Item>

          <div className="switch-row">
            <Form.Item
              label={t('resource.model.uniques.fields.isDefault')}
              name="is_default"
              valuePropName="checked"
            >
              <Switch disabled={Boolean(editingRule)} />
            </Form.Item>
            <Form.Item
              label={t('resource.model.uniques.fields.isAuxiliary')}
              name="is_auxiliary"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('resource.model.uniques.fields.enabled')}
              name="enabled"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </div>

          <Form.Item
            label={t('resource.model.uniques.fields.ignoreIfAllEmpty')}
            name="ignore_if_all_empty"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default UniqueRulesPage;
