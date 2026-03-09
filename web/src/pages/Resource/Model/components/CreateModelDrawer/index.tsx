import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Collapse, Drawer, Form, Input, InputNumber, Select, Space, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { CreateModelPayload, ModelDefinition, ModelGroup } from '@/api/types/model';

interface Props {
  visible: boolean;
  parentModels: ModelDefinition[];
  groups: ModelGroup[];
  onClose: () => void;
  onSubmit: (payload: CreateModelPayload) => Promise<void>;
}

const CreateModelDrawer: React.FC<Props> = ({ visible, parentModels, groups, onClose, onSubmit }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const isMainline = Form.useWatch('is_mainline', form);

  const availableParentModels = useMemo(() => {
    return parentModels
      .filter((model) => model.is_mainline && model.name !== 'module')
      .sort((left, right) => (left.mainline_level || 0) - (right.mainline_level || 0));
  }, [parentModels]);

  useEffect(() => {
    if (!visible) {
      form.resetFields();
      return;
    }

    form.setFieldsValue({
      classification: 'business',
      group_id: groups.find((group) => group.name === 'custom_models')?.id,
      is_mainline: false,
      mainline_scope: 'business',
    });
  }, [visible, form, groups]);

  const handleFinish = async () => {
    const values = await form.validateFields();
    const payload: CreateModelPayload = {
      name: values.name,
      display_name: values.display_name,
      classification: values.classification,
      group_id: values.group_id || undefined,
      icon: values.icon || '',
      description: values.description || '',
      is_mainline: Boolean(values.is_mainline),
    };

    if (payload.is_mainline) {
      payload.mainline_scope = values.mainline_scope;
      payload.mainline_level = values.mainline_level;
      payload.mainline_parent_model = values.mainline_parent_model;
    }

    try {
      setSubmitting(true);
      await onSubmit(payload);
      form.resetFields();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      title={t('resource.model.actions.create')}
      width={640}
      open={visible}
      onClose={onClose}
      destroyOnClose
      maskClosable={!submitting}
      extra={
        <Space>
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="primary" loading={submitting} onClick={handleFinish}>
            {t('common.submit')}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <div className="model-page">
          <div className="model-page-note">{t('resource.model.helper.modelBasics')}</div>

        <Form.Item
          label={t('resource.model.fields.name')}
          name="name"
          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
        >
          <Input placeholder={t('resource.model.placeholders.name')} />
        </Form.Item>

        <Form.Item
          label={t('resource.model.fields.displayName')}
          name="display_name"
          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
        >
          <Input placeholder={t('resource.model.placeholders.displayName')} />
        </Form.Item>

        <Form.Item
          label={t('resource.model.fields.classification')}
          name="classification"
          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
        >
          <Select
            options={[
              { value: 'business', label: t('resource.model.options.classification.business') },
              { value: 'resource', label: t('resource.model.options.classification.resource') },
            ]}
          />
        </Form.Item>

        <Form.Item label={t('resource.model.fields.group')} name="group_id">
          <Select
            allowClear
            placeholder={t('resource.model.placeholders.group')}
            options={groups.map((group) => ({
              value: group.id,
              label: `${group.display_name} (${group.name})`,
            }))}
          />
        </Form.Item>

        <Form.Item label={t('resource.model.fields.icon')} name="icon">
          <Input placeholder={t('resource.model.placeholders.icon')} />
        </Form.Item>

        <Form.Item label={t('resource.model.fields.description')} name="description">
          <Input.TextArea rows={3} placeholder={t('resource.model.placeholders.description')} />
        </Form.Item>

          <Collapse
            items={[
              {
                key: 'advanced',
                label: t('resource.model.sections.advanced'),
                children: (
                  <>
                    <Form.Item
                      label={t('resource.model.fields.isMainline')}
                      name="is_mainline"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>

                    {isMainline ? (
                      <>
                        <Alert
                          type="info"
                          showIcon
                          message={t('resource.model.helper.mainlineNotice')}
                          style={{ marginBottom: 16 }}
                        />

                        <Form.Item
                          label={t('resource.model.fields.mainlineScope')}
                          name="mainline_scope"
                          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
                        >
                          <Select
                            options={[
                              { value: 'business', label: t('resource.model.options.scope.business') },
                              { value: 'global', label: t('resource.model.options.scope.global') },
                            ]}
                          />
                        </Form.Item>

                        <Form.Item
                          label={t('resource.model.fields.mainlineLevel')}
                          name="mainline_level"
                          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
                        >
                          <InputNumber min={1} style={{ width: '100%' }} />
                        </Form.Item>

                        <Form.Item
                          label={t('resource.model.fields.parentModel')}
                          name="mainline_parent_model"
                          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
                        >
                          <Select
                            placeholder={t('resource.model.placeholders.parentModel')}
                            options={availableParentModels.map((model) => ({
                              value: model.name,
                              label: `${model.display_name} (${model.name})`,
                            }))}
                          />
                        </Form.Item>
                      </>
                    ) : (
                      <div className="model-page-note">
                        {t('resource.model.helper.advancedMainline')}
                      </div>
                    )}
                  </>
                ),
              },
            ]}
          />
        </div>
      </Form>
    </Drawer>
  );
};

export default CreateModelDrawer;
