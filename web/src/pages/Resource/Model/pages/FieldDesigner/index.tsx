import React, { useMemo, useState } from 'react';
import { Alert, Button, Empty, Table, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { createModelAttribute } from '@/api';
import { CreateModelAttributePayload, ModelAttribute } from '@/api/types/model';
import CreateAttributeDrawer from '../../components/CreateAttributeDrawer';
import { useModelPageContext } from '../../context';
import { formatAttributeOptions } from '../../shared';

const FieldDesignerPage: React.FC = () => {
  const { t } = useTranslation();
  const { detailModel, attributes, refreshDetail } = useModelPageContext();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const nextSortOrder = useMemo(() => {
    if (attributes.length === 0) {
      return 10;
    }

    return Math.max(...attributes.map((item) => item.sort_order)) + 10;
  }, [attributes]);

  const handleCreateAttribute = async (payload: CreateModelAttributePayload) => {
    try {
      setSubmitting(true);
      await createModelAttribute(detailModel.name, payload);
      message.success(t('common.message.createSuccess'));
      setDrawerVisible(false);
      await refreshDetail();
    } catch (error) {
      console.error(error);
      message.error(t('resource.model.messages.attributeCreateFailed'));
      throw error;
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="model-page">
      <Alert
        type="info"
        showIcon
        message={t('resource.model.helper.attributeDesigner')}
        description={t('resource.model.helper.attributeRoadmap')}
      />

      <div className="model-page-toolbar">
        <div className="model-page-note">{t('resource.model.helper.attributeSortHint')}</div>
        <div className="model-page-actions">
          <Button type="primary" onClick={() => setDrawerVisible(true)}>
            {t('resource.model.actions.createAttribute')}
          </Button>
        </div>
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

      <CreateAttributeDrawer
        visible={drawerVisible}
        loading={submitting}
        nextSortOrder={nextSortOrder}
        onClose={() => setDrawerVisible(false)}
        onSubmit={handleCreateAttribute}
      />
    </div>
  );
};

export default FieldDesignerPage;
