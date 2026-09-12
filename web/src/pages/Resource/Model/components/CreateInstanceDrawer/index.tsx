import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  message,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { adaptTopologyTree } from '@/api/adapters/topologyAdapter';
import { getTopologyTree } from '@/api/services/business';
import {
  CreateModelInstancePayload,
  ModelAttribute,
  ModelAttributeOptions,
  ModelDefinition,
} from '@/api/types/model';
import { BusinessDetail } from '@/api/types/resource';
import { GetTopologyTreeResponse } from '@/api/types/topology';
import { buildAttributeDefaultValues, normalizeAttributeOptions } from '../../shared';

interface ParentOption {
  label: string;
  value: string;
}

interface Props {
  visible: boolean;
  loading: boolean;
  businesses: BusinessDetail[];
  attributes: ModelAttribute[];
  model: ModelDefinition;
  parentModelName?: string;
  onClose: () => void;
  onSubmit: (payload: CreateModelInstancePayload) => Promise<void>;
}

const CreateInstanceDrawer: React.FC<Props> = ({
  visible,
  loading,
  businesses,
  attributes,
  model,
  parentModelName,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const selectedBusinessId = Form.useWatch('business_id', form);
  const [parentOptions, setParentOptions] = useState<ParentOption[]>([]);
  const [parentLoading, setParentLoading] = useState(false);
  const requiresBusiness = model.mainline_scope === 'business';
  const requiresParent = model.is_mainline && Boolean(parentModelName);
  const attributeDefaults = useMemo(() => buildAttributeDefaultValues(attributes), [attributes]);
  const hasNameAttribute = useMemo(
    () => attributes.some((attribute) => attribute.name === 'name'),
    [attributes],
  );
  const hasSortOrderAttribute = useMemo(
    () => attributes.some((attribute) => attribute.name === 'sort_order'),
    [attributes],
  );

  useEffect(() => {
    if (!visible) {
      form.resetFields();
      setParentOptions([]);
      return;
    }

    form.setFieldsValue({
      properties: attributeDefaults,
    });
  }, [attributeDefaults, form, visible]);

  useEffect(() => {
    if (!visible || !requiresParent || !selectedBusinessId || !parentModelName) {
      setParentOptions([]);
      return;
    }

    const loadParentOptions = async () => {
      try {
        setParentLoading(true);
        const response: GetTopologyTreeResponse = await getTopologyTree({
          business_id: selectedBusinessId,
          include_hosts: false,
          max_depth: 20,
        });

        const tree = adaptTopologyTree(response.data || []);
        const options: ParentOption[] = [];

        const walk = (nodes: typeof tree, parentLabels: string[] = []) => {
          nodes.forEach((node) => {
            const currentLabels = [...parentLabels, String(node.title)];
            if (node.backendType === parentModelName) {
              options.push({
                label: currentLabels.join(' / '),
                value: node.nodeId || '',
              });
            }
            if (node.children?.length) {
              walk(node.children, currentLabels);
            }
          });
        };

        walk(tree);
        setParentOptions(options.filter((item) => item.value));
      } catch (error) {
        console.error(error);
        setParentOptions([]);
        message.error(t('resource.model.messages.loadParentFailed'));
      } finally {
        setParentLoading(false);
      }
    };

    loadParentOptions();
  }, [visible, requiresParent, selectedBusinessId, parentModelName, t]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const properties = Object.entries(values.properties || {}).reduce<Record<string, unknown>>(
      (acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      },
      {},
    );

    if (values.name && properties.name === undefined) {
      properties.name = values.name;
    }
    if (values.sort_order !== undefined && properties.sort_order === undefined) {
      properties.sort_order = values.sort_order;
    }

    await onSubmit({
      business_id: values.business_id || undefined,
      mainline_parent_ref_id: values.mainline_parent_ref_id || undefined,
      properties,
    });
    form.resetFields();
    setParentOptions([]);
  };

  return (
    <Drawer
      title={t('resource.model.actions.createInstance')}
      width={640}
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
          label={t('resource.model.fields.business')}
          name="business_id"
          rules={
            requiresBusiness ? [{ required: true, message: t('common.form.rulesMessage') }] : []
          }
        >
          <Select
            allowClear={!requiresBusiness}
            placeholder={t('resource.model.placeholders.business')}
            options={businesses.map((business) => ({
              value: business.id,
              label: `${business.name} (${business.id})`,
            }))}
          />
        </Form.Item>

        {requiresParent ? (
          <Form.Item
            label={t('resource.model.fields.parentNode')}
            name="mainline_parent_ref_id"
            rules={[{ required: true, message: t('common.form.rulesMessage') }]}
            extra={
              parentOptions.length === 0 && selectedBusinessId
                ? t('resource.model.helper.parentNodeEmpty')
                : undefined
            }
          >
            <Select
              loading={parentLoading}
              placeholder={t('resource.model.placeholders.parentNode')}
              options={parentOptions}
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        ) : null}

        {!hasNameAttribute ? (
          <Form.Item
            label={t('resource.model.fields.instanceName')}
            name="name"
            rules={[{ required: true, message: t('common.form.rulesMessage') }]}
          >
            <Input placeholder={t('resource.model.placeholders.instanceName')} />
          </Form.Item>
        ) : null}

        {!hasSortOrderAttribute ? (
          <Form.Item label={t('resource.model.fields.sortOrder')} name="sort_order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        ) : null}

        {attributes.length === 0 ? (
          <Alert
            type="info"
            showIcon
            message={t('resource.model.helper.instanceFallbackForm')}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        {attributes.map((attribute) => {
          const options = normalizeAttributeOptions(attribute.options) as ModelAttributeOptions;
          const formRules = attribute.is_required
            ? [{ required: true, message: t('common.form.rulesMessage') }]
            : [];

          if (attribute.field_type === 'bool') {
            return (
              <Form.Item
                key={attribute.id}
                label={attribute.display_name}
                name={['properties', attribute.name]}
                valuePropName="checked"
                rules={
                  attribute.is_required
                    ? [
                        {
                          validator: (_rule, value) =>
                            value === undefined
                              ? Promise.reject(new Error(t('common.form.rulesMessage')))
                              : Promise.resolve(),
                        },
                      ]
                    : []
                }
                extra={options.help_text}
              >
                <Switch />
              </Form.Item>
            );
          }

          if (attribute.field_type === 'int') {
            return (
              <Form.Item
                key={attribute.id}
                label={attribute.display_name}
                name={['properties', attribute.name]}
                rules={formRules}
                extra={options.help_text}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder={options.placeholder} />
              </Form.Item>
            );
          }

          if (attribute.field_type === 'enum') {
            return (
              <Form.Item
                key={attribute.id}
                label={attribute.display_name}
                name={['properties', attribute.name]}
                rules={formRules}
                extra={options.help_text}
              >
                <Select
                  allowClear={!attribute.is_required}
                  placeholder={options.placeholder}
                  options={(options.enum_values || []).map((item) => ({
                    value: item,
                    label: item,
                  }))}
                />
              </Form.Item>
            );
          }

          return (
            <Form.Item
              key={attribute.id}
              label={attribute.display_name}
              name={['properties', attribute.name]}
              rules={formRules}
              extra={options.help_text}
            >
              <Input placeholder={options.placeholder} />
            </Form.Item>
          );
        })}
      </Form>
    </Drawer>
  );
};

export default CreateInstanceDrawer;
