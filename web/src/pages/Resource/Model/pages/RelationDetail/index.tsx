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
  Table,
  Tag,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import {
  createModelAssociation,
  deleteModelAssociation,
  getAvailableRelations,
  listModelAssociations,
  updateModelAssociation,
} from '@/api';
import {
  AssociationType,
  CreateModelAssociationPayload,
  ModelAssociation,
  UpdateModelAssociationPayload,
} from '@/api/types/modelRelation';
import { useModelPageContext } from '../../context';
import { useModelRelationStore } from '@/store/ModelRelationStore';

const mappingOptions: Array<{ value: '1:1' | '1:N' | 'N:N'; label: string }> = [
  { value: '1:1', label: '1:1' },
  { value: '1:N', label: '1:N' },
  { value: 'N:N', label: 'N:N' },
];

const deleteActionOptions: Array<{
  value: 'cascade' | 'restrict' | 'set_null';
  labelKey: string;
}> = [
  { value: 'restrict', labelKey: 'resource.model.relations.options.onDelete.restrict' },
  { value: 'cascade', labelKey: 'resource.model.relations.options.onDelete.cascade' },
  { value: 'set_null', labelKey: 'resource.model.relations.options.onDelete.set_null' },
];

const RelationDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { detailModel, allModels } = useModelPageContext();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingAssociation, setEditingAssociation] = useState<ModelAssociation | null>(null);
  const [associations, setAssociations] = useState<ModelAssociation[]>([]);
  const [associationTypes, setAssociationTypes] = useState<AssociationType[]>([]);
  const modelCapabilities = useModelRelationStore((state) => state.capabilities);
  const loadModelCapabilities = useModelRelationStore((state) => state.loadCapabilities);

  const selectedAssociationUID = Form.useWatch('association_uid', form);
  const selectedAssociationType = useMemo(
    () => associationTypes.find((item) => item.uid === selectedAssociationUID),
    [associationTypes, selectedAssociationUID],
  );

  const targetModelMap = useMemo(() => {
    const map = new Map<string, string>();
    modelCapabilities.forEach((item) => {
      if (item.target_model_uid) {
        map.set(
          item.target_model_uid,
          `${item.target_model_name || item.target_model_uid} (${item.target_model_uid})`,
        );
      }
    });
    allModels.forEach((model) => {
      if (!map.has(model.name)) {
        map.set(model.name, `${model.display_name} (${model.name})`);
      }
    });
    return map;
  }, [allModels, modelCapabilities]);

  const targetModelOptions = useMemo(() => {
    const seen = new Set<string>();
    return modelCapabilities
      .filter((item) => item.target_model_uid && !seen.has(item.target_model_uid))
      .map((item) => {
        seen.add(item.target_model_uid as string);
        return {
          value: item.target_model_uid as string,
          label: `${item.target_model_name || item.target_model_uid} (${item.target_model_uid})`,
        };
      });
  }, [modelCapabilities]);

  const loadRelationData = async () => {
    try {
      setLoading(true);
      const [associationResponse, availableResponse] = await Promise.all([
        listModelAssociations(detailModel.name),
        getAvailableRelations(detailModel.name),
        loadModelCapabilities(detailModel.name),
      ]);
      setAssociations(associationResponse.data.items || []);
      setAssociationTypes(availableResponse.data.association_types || []);
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.loadRelationsFailed'));
      setAssociations([]);
      setAssociationTypes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRelationData();
  }, [detailModel.name]);

  const openCreateDrawer = () => {
    setEditingAssociation(null);
    form.resetFields();
    form.setFieldsValue({
      mapping: 'N:N',
      on_delete: 'restrict',
    });
    setDrawerVisible(true);
  };

  const openEditDrawer = (record: ModelAssociation) => {
    setEditingAssociation(record);
    form.setFieldsValue({
      target_model_uid: record.target_model_uid,
      association_uid: record.association_uid,
      mapping: record.mapping,
      on_delete: record.on_delete,
      description: record.description,
    });
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    form.resetFields();
    setEditingAssociation(null);
    setDrawerVisible(false);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: CreateModelAssociationPayload | UpdateModelAssociationPayload = {
      target_model_uid: values.target_model_uid,
      association_uid: values.association_uid,
      mapping: values.mapping,
      on_delete: values.on_delete,
      description: values.description?.trim() || '',
    };

    try {
      setSubmitting(true);
      if (editingAssociation) {
        await updateModelAssociation(detailModel.name, editingAssociation.id, payload);
      } else {
        await createModelAssociation(detailModel.name, payload as CreateModelAssociationPayload);
      }
      message.success(t('common.message.createSuccess'));
      handleCloseDrawer();
      await loadRelationData();
    } catch (error) {
      console.error(error);
      message.error(
        editingAssociation
          ? t('resource.model.messages.updateRelationFailed')
          : t('resource.model.messages.createRelationFailed'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (record: ModelAssociation) => {
    try {
      await deleteModelAssociation(detailModel.name, record.id);
      message.success(t('resource.model.messages.deleteRelationSuccess'));
      await loadRelationData();
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.deleteRelationFailed'));
    }
  };

  const columns: ColumnsType<ModelAssociation> = [
    {
      title: t('resource.model.relations.columns.targetModel'),
      dataIndex: 'target_model_uid',
      width: 220,
      render: (value: string) => targetModelMap.get(value) || value,
    },
    {
      title: t('resource.model.relations.columns.associationType'),
      dataIndex: 'association_uid',
      width: 220,
      render: (value: string) => {
        const associationType = associationTypes.find((item) => item.uid === value);
        return associationType ? `${associationType.name} (${associationType.uid})` : value;
      },
    },
    {
      title: t('resource.model.relations.columns.mapping'),
      dataIndex: 'mapping',
      width: 100,
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: t('resource.model.relations.columns.onDelete'),
      dataIndex: 'on_delete',
      width: 120,
      render: (value: 'cascade' | 'restrict' | 'set_null') =>
        t(`resource.model.relations.options.onDelete.${value}`, { defaultValue: value }),
    },
    {
      title: t('resource.model.relations.columns.description'),
      dataIndex: 'description',
      render: (value?: string) => value || '--',
    },
    {
      title: t('resource.model.columns.updatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      render: (value?: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'),
    },
    {
      title: t('resource.model.relations.columns.actions'),
      key: 'actions',
      width: 160,
      render: (_value, record) => (
        <Space size="middle">
          <Button type="link" onClick={() => openEditDrawer(record)}>
            {t('common.edit')}
          </Button>
          <Popconfirm
            title={t('resource.model.relations.confirmDelete')}
            onConfirm={() => handleDelete(record)}
          >
            <Button type="link" danger>
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
        message={t('resource.model.helper.relationsDesign')}
        description={t('resource.model.helper.relationsDesignHint')}
      />

      <div className="model-page-toolbar">
        <div className="model-page-note">{t('resource.model.helper.relationsListNote')}</div>
        <div className="model-page-actions">
          <Space>
            <Button onClick={() => loadRelationData()}>{t('resource.model.actions.refresh')}</Button>
            <Button
              type="primary"
              onClick={openCreateDrawer}
              disabled={associationTypes.length === 0 || targetModelOptions.length === 0}
            >
              {t('resource.model.actions.createRelation')}
            </Button>
          </Space>
        </div>
      </div>

      {associations.length === 0 ? (
        <Empty description={t('resource.model.empty.noRelations')} />
      ) : (
        <Table
          rowKey="id"
          loading={loading}
          pagination={false}
          scroll={{ x: 1200 }}
          dataSource={associations}
          columns={columns}
        />
      )}

      <Drawer
        title={
          editingAssociation
            ? t('resource.model.actions.editRelation')
            : t('resource.model.actions.createRelation')
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
            label={t('resource.model.relations.fields.targetModel')}
            name="target_model_uid"
            rules={[{ required: true, message: t('common.form.rulesMessage') }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={targetModelOptions}
            />
          </Form.Item>

          <Form.Item
            label={t('resource.model.relations.fields.associationType')}
            name="association_uid"
            rules={[{ required: true, message: t('common.form.rulesMessage') }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={associationTypes.map((item) => ({
                value: item.uid,
                label: `${item.name} (${item.uid})`,
              }))}
            />
          </Form.Item>

          {selectedAssociationType ? (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message={`${selectedAssociationType.source_to_dest_desc || '--'} / ${
                selectedAssociationType.dest_to_source_desc || '--'
              }`}
              description={selectedAssociationType.description || '--'}
            />
          ) : null}

          <Form.Item
            label={t('resource.model.relations.fields.mapping')}
            name="mapping"
            rules={[{ required: true, message: t('common.form.rulesMessage') }]}
          >
            <Select options={mappingOptions} />
          </Form.Item>

          <Form.Item
            label={t('resource.model.relations.fields.onDelete')}
            name="on_delete"
            rules={[{ required: true, message: t('common.form.rulesMessage') }]}
          >
            <Select
              options={deleteActionOptions.map((item) => ({
                value: item.value,
                label: t(item.labelKey),
              }))}
            />
          </Form.Item>

          <Form.Item
            label={t('resource.model.relations.fields.description')}
            name="description"
          >
            <Input.TextArea rows={4} />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default RelationDetailPage;
