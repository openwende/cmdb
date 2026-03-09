import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Empty, Form, Input, InputNumber, Modal, Select, Spin, Switch, message } from 'antd';
import {
  createModelInstance,
  createTopologyModule,
  createTopologySet,
  getBusinessFormSchema,
  getModelDetail,
} from '@/api';
import {
  BusinessFormSchemaField,
  BusinessFormSchemaGroup,
} from '@/api/types/businessCustomField';
import { CreateModelInstancePayload, ModelAttribute, ModelAttributeOptions } from '@/api/types/model';
import { MainlineModel } from '@/api/types/mainline';
import { TopoTreeNodeType, TreeData } from '@/pages/Business/Types';
import { useBusinessStore } from '@/store/BusinessStore';
import { useMainlineStore } from '@/store/MainlineStore';
import './style.css';

interface CreateModalProps {
  visible: boolean;
  selectedNode: TreeData | null;
  parentNodes: TreeData[];
  onClose: () => void;
  onCreated: () => void;
}

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

const buildSchemaDefaultValues = (fields: BusinessFormSchemaField[]) => {
  return fields.reduce<Record<string, string | number | boolean>>((acc, field) => {
    if (field.default_value !== undefined) {
      acc[field.name] = field.default_value;
    } else if (field.name === 'sort_order') {
      acc[field.name] = 0;
    }
    return acc;
  }, {});
};

const resolveParentModelName = (node: TreeData | null) => {
  if (!node) {
    return '';
  }

  if (node.backendType) {
    return node.backendType;
  }

  if (node.type === TopoTreeNodeType.Biz) {
    return 'business';
  }

  return node.type;
};

const CreateModal: React.FC<CreateModalProps> = ({
  visible,
  selectedNode,
  parentNodes,
  onClose,
  onCreated,
}) => {
  const { t } = useTranslation();
  const { currentBusiness } = useBusinessStore();
  const { mainlineModels, loadMainlineModels, getChildModels } = useMainlineStore();
  const [form] = Form.useForm();
  const [modelsLoading, setModelsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedModelName, setSelectedModelName] = useState('');
  const [selectedModel, setSelectedModel] = useState<MainlineModel | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<ModelAttribute[]>([]);
  const [builtinSchemaGroups, setBuiltinSchemaGroups] = useState<BusinessFormSchemaGroup[]>([]);
  const [builtinSchemaFields, setBuiltinSchemaFields] = useState<BusinessFormSchemaField[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const topoPath = useMemo(() => {
    return parentNodes.length > 0
      ? [...parentNodes.map((node) => String(node.title)), String(selectedNode?.title || '')].join(' / ')
      : String(selectedNode?.title || '');
  }, [parentNodes, selectedNode]);

  const parentModelName = useMemo(() => resolveParentModelName(selectedNode), [selectedNode]);

  const availableModels = useMemo(() => {
    if (!parentModelName || mainlineModels.length === 0) {
      return [];
    }

    return getChildModels(parentModelName);
  }, [getChildModels, mainlineModels.length, parentModelName]);

  const hasNameAttribute = useMemo(
    () => selectedAttributes.some((attribute) => attribute.name === 'name'),
    [selectedAttributes],
  );
  const hasSortOrderAttribute = useMemo(
    () => selectedAttributes.some((attribute) => attribute.name === 'sort_order'),
    [selectedAttributes],
  );

  const isBuiltinSet = selectedModel?.uid === 'set';
  const isBuiltinModule = selectedModel?.uid === 'module';
  const isBuiltinTopologyModel = isBuiltinSet || isBuiltinModule;

  useEffect(() => {
    if (!visible) {
      form.resetFields();
      setSelectedModelName('');
      setSelectedModel(null);
      setSelectedAttributes([]);
      setBuiltinSchemaGroups([]);
      setBuiltinSchemaFields([]);
      return;
    }

    const loadModels = async () => {
      try {
        setModelsLoading(true);
        await loadMainlineModels();
      } catch (error) {
        console.error(error);
        message.error(t('business.topology.tree.create.messages.loadModelsFailed'));
      } finally {
        setModelsLoading(false);
      }
    };

    loadModels();
  }, [form, loadMainlineModels, t, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (availableModels.length === 0) {
      setSelectedModelName('');
      setSelectedModel(null);
      setSelectedAttributes([]);
      setBuiltinSchemaGroups([]);
      setBuiltinSchemaFields([]);
      return;
    }

    if (!availableModels.some((model) => model.uid === selectedModelName)) {
      setSelectedModelName(availableModels[0].uid);
    }
  }, [availableModels, selectedModelName, visible]);

  useEffect(() => {
    if (!visible || !selectedModelName) {
      return;
    }

    const model = availableModels.find((item) => item.uid === selectedModelName) || null;
    setSelectedModel(model);
    form.resetFields();
    setSelectedAttributes([]);
    setBuiltinSchemaGroups([]);
    setBuiltinSchemaFields([]);
    form.setFieldsValue({
      sort_order: 0,
      properties: {},
    });

    const loadModelSchema = async () => {
      try {
        setDetailLoading(true);
        if (currentBusiness && (selectedModelName === 'set' || selectedModelName === 'module')) {
          const schema = await getBusinessFormSchema(currentBusiness.id, selectedModelName);
          const builtinFields = schema.data.builtin_fields || [];
          setBuiltinSchemaFields(builtinFields);
          setBuiltinSchemaGroups(
            builtinFields.length > 0
              ? [
                  {
                    group_name: t('business.dynamicGroupForm.sections.basicInfo'),
                    collapsed_by_default: false,
                    fields: builtinFields,
                  },
                ]
              : [],
          );
          form.setFieldsValue(buildSchemaDefaultValues(builtinFields));
          return;
        }

        const detail = await getModelDetail(selectedModelName);
        setSelectedAttributes(detail.attributes || []);
        form.setFieldsValue({
          properties: buildAttributeDefaultValues(detail.attributes || []),
        });
      } catch (error) {
        console.error(error);
        setSelectedAttributes([]);
        setBuiltinSchemaGroups([]);
        setBuiltinSchemaFields([]);
        message.error(t('business.topology.tree.create.messages.loadModelDetailFailed'));
      } finally {
        setDetailLoading(false);
      }
    };

    loadModelSchema();
  }, [availableModels, currentBusiness, form, selectedModelName, t, visible]);

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedNode || !selectedModel || !currentBusiness) {
      return;
    }

    const values = await form.validateFields();

    try {
      setSubmitting(true);

      if (isBuiltinSet) {
        await createTopologySet({
          business_id: currentBusiness.id,
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
          env_type: values.env_type || undefined,
          sort_order: values.sort_order || 0,
        });
      } else if (isBuiltinModule) {
        await createTopologyModule({
          set_id: Number(selectedNode.nodeId),
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
          service_type: values.service_type || undefined,
          sort_order: values.sort_order || 0,
        });
      } else {
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
          properties.name = values.name.trim();
        }
        if (values.sort_order !== undefined && properties.sort_order === undefined) {
          properties.sort_order = values.sort_order;
        }

        const payload: CreateModelInstancePayload = {
          business_id: currentBusiness.id,
          mainline_parent_ref_id: String(selectedNode.nodeId || ''),
          properties,
        };
        await createModelInstance(selectedModel.uid, payload);
      }

      message.success(t('common.message.createSuccess'));
      handleCancel();
      onCreated();
    } catch (error) {
      console.error(error);
      message.error(t('business.topology.tree.create.messages.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const renderBuiltinFields = () => {
    if (!isBuiltinTopologyModel || builtinSchemaGroups.length === 0) {
      return null;
    }

    return builtinSchemaGroups.map((group) => (
      <React.Fragment key={group.group_name || 'builtin'}>
        {group.group_name ? (
          <div className="selected-model-summary" style={{ marginBottom: 12 }}>
            <span>{group.group_name}</span>
          </div>
        ) : null}
        {group.fields.map((field) => {
          const rules = field.is_required
            ? [{ required: true, message: t('common.form.rulesMessage') }]
            : [];

          if (field.field_type === 'bool') {
            return (
              <Form.Item
                key={field.name}
                label={field.display_name}
                name={field.name}
                valuePropName="checked"
                rules={
                  field.is_required
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
              >
                <Switch disabled={!field.is_editable} />
              </Form.Item>
            );
          }

          if (field.field_type === 'int') {
            return (
              <Form.Item key={field.name} label={field.display_name} name={field.name} rules={rules}>
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  placeholder={field.placeholder}
                  disabled={!field.is_editable}
                />
              </Form.Item>
            );
          }

          if (field.field_type === 'enum') {
            return (
              <Form.Item key={field.name} label={field.display_name} name={field.name} rules={rules}>
                <Select
                  allowClear={!field.is_required}
                  placeholder={field.placeholder}
                  disabled={!field.is_editable}
                  options={((field.options?.enum_values as string[]) || []).map((item) => ({
                    value: item,
                    label: item,
                  }))}
                />
              </Form.Item>
            );
          }

          if (field.field_type === 'text') {
            return (
              <Form.Item key={field.name} label={field.display_name} name={field.name} rules={rules}>
                <Input.TextArea
                  rows={3}
                  placeholder={field.placeholder}
                  disabled={!field.is_editable}
                />
              </Form.Item>
            );
          }

          return (
            <Form.Item key={field.name} label={field.display_name} name={field.name} rules={rules}>
              <Input placeholder={field.placeholder} disabled={!field.is_editable} />
            </Form.Item>
          );
        })}
      </React.Fragment>
    ));
  };

  const renderDynamicFields = () => {
    if (!selectedModel) {
      return null;
    }

    return (
      <>
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

        {selectedAttributes.map((attribute) => {
          const options = normalizeAttributeOptions(attribute.options);
          const rules = attribute.is_required
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
                rules={rules}
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
                rules={rules}
                extra={options.help_text}
              >
                <Select
                  allowClear={!attribute.is_required}
                  placeholder={options.placeholder}
                  options={(options.enum_values || []).map((item) => ({ value: item, label: item }))}
                />
              </Form.Item>
            );
          }

          return (
            <Form.Item
              key={attribute.id}
              label={attribute.display_name}
              name={['properties', attribute.name]}
              rules={rules}
              extra={options.help_text}
            >
              <Input placeholder={options.placeholder} />
            </Form.Item>
          );
        })}
      </>
    );
  };

  return (
    <Modal
      open={visible}
      title={t('business.topology.tree.create.dynamicTitle')}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
      width={640}
      onOk={handleSubmit}
      confirmLoading={submitting}
      onCancel={handleCancel}
      maskClosable={false}
      className="create-modal"
    >
      <div className="selected-tip">
        {t('business.topology.tree.create.selected')}: {topoPath}
      </div>

      {modelsLoading ? (
        <div className="create-modal-loading">
          <Spin />
        </div>
      ) : availableModels.length === 0 ? (
        <Empty description={t('business.topology.tree.create.empty.noChildModels')} />
      ) : (
        <Form form={form} layout="vertical">
          <Alert
            type="info"
            showIcon
            message={t('business.topology.tree.create.helper.modelDriven')}
            style={{ marginBottom: 16 }}
          />

          {isBuiltinTopologyModel && builtinSchemaFields.length > 0 ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={t('business.topology.tree.create.helper.schemaDriven')}
            />
          ) : null}

          <Form.Item
            label={t('business.topology.tree.create.fields.childModel')}
            name="model_name"
            initialValue={selectedModelName}
            rules={[{ required: true, message: t('common.form.rulesMessage') }]}
          >
            <Select
              value={selectedModelName}
              onChange={(value) => {
                setSelectedModelName(value);
                form.setFieldValue('model_name', value);
              }}
              options={availableModels.map((model) => ({
                value: model.uid,
                label: `${model.display_name} (${model.uid})`,
              }))}
            />
          </Form.Item>

          {selectedModel ? (
            <div className="selected-model-summary">
              <span>{selectedModel.display_name}</span>
              <span>{selectedModel.uid}</span>
              {selectedModel.level !== null && selectedModel.level !== undefined ? (
                <span>{`L${selectedModel.level}`}</span>
              ) : null}
            </div>
          ) : null}

          {detailLoading ? (
            <div className="create-modal-loading">
              <Spin />
            </div>
          ) : isBuiltinTopologyModel ? (
            renderBuiltinFields()
          ) : (
            renderDynamicFields()
          )}
        </Form>
      )}
    </Modal>
  );
};

export default CreateModal;
