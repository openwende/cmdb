import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Spin,
  Switch,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import Pagination from '@/components/common/Pagination';
import {
  createModelAttribute,
  createModelInstance,
  getBusinessList,
  getModelDetail,
  listModelInstances,
  listModels,
} from '@/api';
import { adaptTopologyTree } from '@/api/adapters/topologyAdapter';
import {
  CreateModelAttributePayload,
  CreateModelInstancePayload,
  ModelAttribute,
  ModelAttributeOptions,
  ModelDefinition,
  ModelInstance,
} from '@/api/types/model';
import { BusinessDetail } from '@/api/types/resource';
import { GetTopologyTreeResponse } from '@/api/types/topology';
import { getTopologyTree } from '@/api/services/business';
import './style.css';

interface ParentOption {
  label: string;
  value: string;
}

const DEFAULT_PAGE_SIZE = 20;
const ATTRIBUTE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

const normalizeAttributeOptions = (
  options?: Record<string, unknown> | ModelAttributeOptions | null,
): ModelAttributeOptions => {
  if (!options || typeof options !== 'object') {
    return {};
  }

  return options as ModelAttributeOptions;
};

const buildAttributeDefaultValues = (attributes: ModelAttribute[]) => {
  return attributes.reduce<Record<string, string | number | boolean>>((acc, attribute) => {
    const options = normalizeAttributeOptions(attribute.options);
    if (options.default !== undefined) {
      acc[attribute.name] = options.default;
    }
    return acc;
  }, {});
};

const formatAttributeOptions = (attribute: ModelAttribute) => {
  const options = normalizeAttributeOptions(attribute.options);
  const parts: string[] = [];

  if (Array.isArray(options.enum_values) && options.enum_values.length > 0) {
    parts.push(`enum: ${options.enum_values.join(', ')}`);
  }
  if (options.default !== undefined && options.default !== '') {
    parts.push(`default: ${String(options.default)}`);
  }
  if (options.placeholder) {
    parts.push(`placeholder: ${options.placeholder}`);
  }
  if (options.help_text) {
    parts.push(`help: ${options.help_text}`);
  }

  return parts.length > 0 ? parts.join(' | ') : '--';
};

interface CreateAttributeDrawerProps {
  visible: boolean;
  loading: boolean;
  nextSortOrder: number;
  onClose: () => void;
  onSubmit: (payload: CreateModelAttributePayload) => Promise<void>;
}

const CreateAttributeDrawer: React.FC<CreateAttributeDrawerProps> = ({
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
                {
                  value: true,
                  label: t('resource.model.options.boolean.yes'),
                },
                {
                  value: false,
                  label: t('resource.model.options.boolean.no'),
                },
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

interface CreateInstanceDrawerProps {
  visible: boolean;
  loading: boolean;
  businesses: BusinessDetail[];
  attributes: ModelAttribute[];
  model: ModelDefinition;
  parentModelName?: string;
  onClose: () => void;
  onSubmit: (payload: CreateModelInstancePayload) => Promise<void>;
}

const CreateInstanceDrawer: React.FC<CreateInstanceDrawerProps> = ({
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
          const options = normalizeAttributeOptions(attribute.options);
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
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder={options.placeholder}
                />
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

const ModelDetail: React.FC = () => {
  const { t } = useTranslation();
  const { name } = useParams<{ name: string }>();
  const [loading, setLoading] = useState(false);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [attributeSubmitting, setAttributeSubmitting] = useState(false);
  const [detailModel, setDetailModel] = useState<ModelDefinition | null>(null);
  const [attributes, setAttributes] = useState<ModelAttribute[]>([]);
  const [allModels, setAllModels] = useState<ModelDefinition[]>([]);
  const [businesses, setBusinesses] = useState<BusinessDetail[]>([]);
  const [instances, setInstances] = useState<ModelInstance[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [attributeDrawerVisible, setAttributeDrawerVisible] = useState(false);

  const parentModelName = useMemo(() => {
    if (!detailModel?.mainline_parent_model_id) {
      return '';
    }
    return (
      allModels.find((item) => item.id === detailModel.mainline_parent_model_id)?.name || ''
    );
  }, [allModels, detailModel]);

  const parentModelDisplayName = useMemo(() => {
    if (!detailModel?.mainline_parent_model_id) {
      return '';
    }
    const parent = allModels.find((item) => item.id === detailModel.mainline_parent_model_id);
    return parent ? `${parent.display_name} (${parent.name})` : '';
  }, [allModels, detailModel]);

  const fetchDetail = async () => {
    if (!name) {
      return;
    }

    try {
      setLoading(true);
      const [detail, models, businessResponse] = await Promise.all([
        getModelDetail(name),
        listModels(),
        getBusinessList({ limit: 100, offset: 0 }),
      ]);

      setDetailModel(detail.model);
      setAttributes(detail.attributes || []);
      setAllModels(models);
      setBusinesses(businessResponse.data.items || []);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchInstances = async () => {
    if (!name) {
      return;
    }

    try {
      setInstancesLoading(true);
      const response = await listModelInstances(name, {
        page,
        page_size: pageSize,
      });
      // R8：后端收口为 {code,data:{items,pagination}}；?. 链在旧 {data:[],meta} 下优雅降级为空，不崩。
      setInstances(response.data?.items || []);
      setTotal(response.data?.pagination?.total || 0);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadInstancesFailed'));
    } finally {
      setInstancesLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [name]);

  useEffect(() => {
    fetchInstances();
  }, [name, page, pageSize]);

  const handleCreateInstance = async (payload: CreateModelInstancePayload) => {
    if (!name) {
      return;
    }

    try {
      setSubmitting(true);
      await createModelInstance(name, payload);
      message.success(t('common.message.createSuccess'));
      setDrawerVisible(false);
      await fetchInstances();
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.instanceCreateFailed'));
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAttribute = async (payload: CreateModelAttributePayload) => {
    if (!name) {
      return;
    }

    try {
      setAttributeSubmitting(true);
      await createModelAttribute(name, payload);
      message.success(t('common.message.createSuccess'));
      setAttributeDrawerVisible(false);
      await fetchDetail();
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.attributeCreateFailed'));
      throw error;
    } finally {
      setAttributeSubmitting(false);
    }
  };

  const instanceColumns: ColumnsType<ModelInstance> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 260,
    },
    {
      title: t('resource.model.columns.instanceName'),
      key: 'name',
      width: 220,
      render: (_value, record) => String(record.properties?.name || '--'),
    },
    {
      title: t('resource.model.columns.business'),
      dataIndex: 'business_id',
      width: 260,
      render: (value?: string | null) => value || '--',
    },
    {
      title: t('resource.model.columns.createdAt'),
      dataIndex: 'created_at',
      width: 180,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
    {
      title: t('resource.model.columns.updatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
  ];

  const attributeColumns: ColumnsType<ModelAttribute> = [
    {
      title: t('resource.model.columns.attributeDisplayName'),
      dataIndex: 'display_name',
      width: 180,
    },
    {
      title: t('resource.model.columns.attributeName'),
      dataIndex: 'name',
      width: 180,
    },
    {
      title: t('resource.model.columns.attributeType'),
      dataIndex: 'field_type',
      width: 120,
      render: (value: string) =>
        t(`resource.model.options.fieldType.${value}`, {
          defaultValue: value,
        }),
    },
    {
      title: t('resource.model.columns.attributeRequired'),
      dataIndex: 'is_required',
      width: 100,
      render: (value: boolean) =>
        value ? t('resource.model.options.boolean.yes') : t('resource.model.options.boolean.no'),
    },
    {
      title: t('resource.model.columns.attributeUnique'),
      dataIndex: 'is_unique',
      width: 100,
      render: (value: boolean) =>
        value ? t('resource.model.options.boolean.yes') : t('resource.model.options.boolean.no'),
    },
    {
      title: t('resource.model.columns.attributeEditable'),
      dataIndex: 'is_editable',
      width: 100,
      render: (value: boolean) =>
        value ? t('resource.model.options.boolean.yes') : t('resource.model.options.boolean.no'),
    },
    {
      title: t('resource.model.columns.attributeSortOrder'),
      dataIndex: 'sort_order',
      width: 110,
    },
    {
      title: t('resource.model.columns.attributeOptions'),
      key: 'options',
      render: (_value, record) => formatAttributeOptions(record),
    },
  ];

  if (loading || !detailModel) {
    return (
      <div className="model-detail loading-container">
        <Spin />
      </div>
    );
  }

  return (
    <div className="model-detail">
      <Tabs
        items={[
          {
            key: 'overview',
            label: t('resource.model.tabs.overview'),
            children: (
              <div className="tab-section">
                <Descriptions bordered column={2}>
                  <Descriptions.Item label={t('resource.model.fields.displayName')}>
                    {detailModel.display_name}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('resource.model.fields.name')}>
                    {detailModel.name}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('resource.model.fields.classification')}>
                    {t(`resource.model.options.classification.${detailModel.classification}`, {
                      defaultValue: detailModel.classification,
                    })}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('resource.model.fields.icon')}>
                    {detailModel.icon || '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('resource.model.fields.isMainline')}>
                    {detailModel.is_mainline ? (
                      <Tag color="blue">{t('resource.model.options.boolean.yes')}</Tag>
                    ) : (
                      t('resource.model.options.boolean.no')
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('resource.model.fields.builtIn')}>
                    {detailModel.is_builtin ? (
                      <Tag color="gold">{t('resource.model.options.boolean.yes')}</Tag>
                    ) : (
                      t('resource.model.options.boolean.no')
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('resource.model.fields.mainlineScope')}>
                    {t(`resource.model.options.scope.${detailModel.mainline_scope || 'none'}`, {
                      defaultValue: detailModel.mainline_scope || '--',
                    })}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('resource.model.fields.mainlineLevel')}>
                    {detailModel.mainline_level ?? '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('resource.model.fields.parentModel')} span={2}>
                    {parentModelDisplayName || '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('resource.model.fields.description')} span={2}>
                    {detailModel.description || '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('resource.model.fields.createdAt')}>
                    {detailModel.created_at
                      ? dayjs(detailModel.created_at).format('YYYY-MM-DD HH:mm:ss')
                      : '--'}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('resource.model.fields.updatedAt')}>
                    {detailModel.updated_at
                      ? dayjs(detailModel.updated_at).format('YYYY-MM-DD HH:mm:ss')
                      : '--'}
                  </Descriptions.Item>
                </Descriptions>
              </div>
            ),
          },
          {
            key: 'attributes',
            label: t('resource.model.tabs.attributes'),
            children: (
              <div className="tab-section">
                <Alert
                  type="info"
                  showIcon
                  message={t('resource.model.helper.attributeDesigner')}
                />
                <div className="attribute-toolbar">
                  <Button type="primary" onClick={() => setAttributeDrawerVisible(true)}>
                    {t('resource.model.actions.createAttribute')}
                  </Button>
                </div>
                {attributes.length === 0 ? (
                  <Empty description={t('resource.model.empty.noAttributes')} />
                ) : (
                  <Table
                    rowKey="id"
                    pagination={false}
                    scroll={{ x: 1100 }}
                    dataSource={attributes}
                    columns={attributeColumns}
                  />
                )}
              </div>
            ),
          },
          {
            key: 'instances',
            label: t('resource.model.tabs.instances'),
            children: (
              <div className="tab-section">
                {detailModel.is_mainline && detailModel.mainline_scope === 'business' ? (
                  <Alert
                    type="info"
                    showIcon
                    message={t('resource.model.helper.instanceBusinessScope')}
                    style={{ marginBottom: 16 }}
                  />
                ) : null}
                <div className="instance-toolbar">
                  <Button type="primary" onClick={() => setDrawerVisible(true)}>
                    {t('resource.model.actions.createInstance')}
                  </Button>
                </div>
                <Table
                  rowKey="id"
                  loading={instancesLoading}
                  pagination={false}
                  scroll={{ x: 1100 }}
                  dataSource={instances}
                  columns={instanceColumns}
                  expandable={{
                    expandedRowRender: (record) => (
                      <pre className="properties-preview">
                        {JSON.stringify(record.properties || {}, null, 2)}
                      </pre>
                    ),
                  }}
                  locale={{
                    emptyText: <Empty description={t('resource.model.empty.noInstances')} />,
                  }}
                />
                <Pagination
                  total={total}
                  current={page}
                  pageSize={pageSize}
                  onChange={(nextPage, nextPageSize) => {
                    setPage(nextPage);
                    setPageSize(nextPageSize);
                  }}
                  onSizeChange={(_current, size) => {
                    setPage(1);
                    setPageSize(size);
                  }}
                />
              </div>
            ),
          },
          {
            key: 'relations',
            label: t('resource.model.tabs.relations'),
            children: (
              <div className="tab-section">
                <Alert
                  type="info"
                  showIcon
                  message={t('resource.model.empty.tabPending')}
                  description={t('resource.model.helper.relationsPending')}
                />
              </div>
            ),
          },
          {
            key: 'history',
            label: t('resource.model.tabs.history'),
            children: (
              <div className="tab-section">
                <Alert
                  type="info"
                  showIcon
                  message={t('resource.model.empty.tabPending')}
                  description={t('resource.model.helper.historyPending')}
                />
              </div>
            ),
          },
          {
            key: 'import-export',
            label: t('resource.model.tabs.importExport'),
            children: (
              <div className="tab-section">
                <Alert
                  type="info"
                  showIcon
                  message={t('resource.model.empty.tabPending')}
                  description={t('resource.model.helper.importExportPending')}
                />
              </div>
            ),
          },
        ]}
      />

      <CreateAttributeDrawer
        visible={attributeDrawerVisible}
        loading={attributeSubmitting}
        nextSortOrder={attributes.length > 0 ? Math.max(...attributes.map((item) => item.sort_order)) + 10 : 10}
        onClose={() => setAttributeDrawerVisible(false)}
        onSubmit={handleCreateAttribute}
      />
      <CreateInstanceDrawer
        visible={drawerVisible}
        loading={submitting}
        businesses={businesses}
        attributes={attributes}
        model={detailModel}
        parentModelName={parentModelName}
        onClose={() => setDrawerVisible(false)}
        onSubmit={handleCreateInstance}
      />
    </div>
  );
};

export default ModelDetail;
