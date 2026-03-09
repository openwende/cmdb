import React, { useEffect } from 'react';
import { Button, Drawer, Form, Input, InputNumber, Select, Space, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { CreateModelAttributePayload, ModelAttributeOptions } from '@/api/types/model';

const ATTRIBUTE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

interface Props {
  visible: boolean;
  loading: boolean;
  nextSortOrder: number;
  onClose: () => void;
  onSubmit: (payload: CreateModelAttributePayload) => Promise<void>;
}

const CreateAttributeDrawer: React.FC<Props> = ({
  visible,
  loading,
  nextSortOrder,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const fieldType = Form.useWatch('field_type', form);
  const enumValuesText = Form.useWatch('enum_values_text', form);

  useEffect(() => {
    if (!visible) {
      form.resetFields();
      return;
    }

    form.setFieldsValue({
      field_type: 'string',
      is_required: false,
      is_unique: false,
      is_editable: true,
      sort_order: nextSortOrder,
      enum_values_text: '',
    });
  }, [form, nextSortOrder, visible]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const options: ModelAttributeOptions = {};

    if (values.placeholder) {
      options.placeholder = values.placeholder.trim();
    }
    if (values.help_text) {
      options.help_text = values.help_text.trim();
    }
    if (fieldType === 'enum' && values.enum_values_text) {
      options.enum_values = String(values.enum_values_text)
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (values.default_value !== undefined && values.default_value !== '') {
      options.default = values.default_value;
    }

    await onSubmit({
      name: values.name.trim(),
      display_name: values.display_name.trim(),
      field_type: values.field_type,
      is_required: values.is_required,
      is_unique: values.is_unique,
      is_editable: values.is_editable,
      sort_order: values.sort_order || 0,
      options,
    });
    form.resetFields();
  };

  return (
    <Drawer
      title={t('resource.model.actions.createAttribute')}
      width={560}
      open={visible}
      onClose={onClose}
      destroyOnClose
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
          label={t('resource.model.fields.attributeDisplayName')}
          name="display_name"
          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
        >
          <Input placeholder={t('resource.model.placeholders.attributeDisplayName')} />
        </Form.Item>

        <Form.Item
          label={t('resource.model.fields.attributeName')}
          name="name"
          rules={[
            { required: true, message: t('common.form.rulesMessage') },
            {
              pattern: ATTRIBUTE_NAME_PATTERN,
              message: t('resource.model.messages.invalidAttributeName'),
            },
          ]}
        >
          <Input placeholder={t('resource.model.placeholders.attributeName')} />
        </Form.Item>

        <Form.Item
          label={t('resource.model.fields.attributeType')}
          name="field_type"
          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
        >
          <Select
            options={['string', 'int', 'bool', 'enum'].map((type) => ({
              value: type,
              label: t(`resource.model.options.fieldType.${type}`),
            }))}
          />
        </Form.Item>

        <Form.Item
          label={t('resource.model.fields.sortOrder')}
          name="sort_order"
          rules={[{ required: true, message: t('common.form.rulesMessage') }]}
        >
          <InputNumber min={0} style={{ width: '100%' }} />
        </Form.Item>

        <div className="switch-row">
          <Form.Item
            label={t('resource.model.fields.attributeRequired')}
            name="is_required"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label={t('resource.model.fields.attributeUnique')}
            name="is_unique"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label={t('resource.model.fields.attributeEditable')}
            name="is_editable"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </div>

        {fieldType === 'enum' ? (
          <Form.Item
            label={t('resource.model.fields.enumValues')}
            name="enum_values_text"
            rules={[{ required: true, message: t('common.form.rulesMessage') }]}
            extra={t('resource.model.helper.enumValues')}
          >
            <Input.TextArea rows={4} placeholder={t('resource.model.placeholders.enumValues')} />
          </Form.Item>
        ) : null}

        <Form.Item label={t('resource.model.fields.defaultValue')} name="default_value">
          {fieldType === 'bool' ? (
            <Select
              allowClear
              options={[
                { value: true, label: t('resource.model.options.boolean.yes') },
                { value: false, label: t('resource.model.options.boolean.no') },
              ]}
            />
          ) : fieldType === 'int' ? (
            <InputNumber style={{ width: '100%' }} />
          ) : fieldType === 'enum' ? (
            <Select
              allowClear
              options={(String(enumValuesText || '')
                .split(/\n|,/)
                .map((item) => item.trim())
                .filter(Boolean) || []
              ).map((item) => ({ value: item, label: item }))}
            />
          ) : (
            <Input placeholder={t('resource.model.placeholders.defaultValue')} />
          )}
        </Form.Item>

        <Form.Item label={t('resource.model.fields.placeholder')} name="placeholder">
          <Input placeholder={t('resource.model.placeholders.placeholder')} />
        </Form.Item>

        <Form.Item label={t('resource.model.fields.helpText')} name="help_text">
          <Input.TextArea rows={3} placeholder={t('resource.model.placeholders.helpText')} />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default CreateAttributeDrawer;
