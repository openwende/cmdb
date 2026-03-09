import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button, Descriptions, Spin, Tabs, Tag, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { getBusinessList, getModelDetail, listModels } from '@/api';
import { ModelAttribute, ModelDefinition } from '@/api/types/model';
import { BusinessDetail } from '@/api/types/resource';
import { buildModelDetailPath } from '..';
import { ModelPageContextValue } from '../context';
import './style.css';

const ModelLayout: React.FC = () => {
  const { t } = useTranslation();
  const { name } = useParams<{ name: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [detailModel, setDetailModel] = useState<ModelDefinition | null>(null);
  const [attributes, setAttributes] = useState<ModelAttribute[]>([]);
  const [allModels, setAllModels] = useState<ModelDefinition[]>([]);
  const [businesses, setBusinesses] = useState<BusinessDetail[]>([]);

  const parentModelName = useMemo(() => {
    if (!detailModel?.mainline_parent_model_id) {
      return '';
    }

    return allModels.find((item) => item.id === detailModel.mainline_parent_model_id)?.name || '';
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

  useEffect(() => {
    fetchDetail();
  }, [name]);

  const activeKey = useMemo(() => {
    const segment = location.pathname.split('/').filter(Boolean).pop();
    return segment || 'basic';
  }, [location.pathname]);

  const contextValue: ModelPageContextValue | null = detailModel
    ? {
        detailModel,
        attributes,
        allModels,
        businesses,
        parentModelName,
        parentModelDisplayName,
        refreshDetail: fetchDetail,
      }
    : null;

  if (loading || !detailModel || !contextValue) {
    return (
      <div className="model-detail loading-container">
        <Spin />
      </div>
    );
  }

  return (
    <div className="model-detail">
      <div className="model-layout-header">
        <div>
          <div className="model-layout-title-row">
            <Button
              type="text"
              className="model-layout-back-btn"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/model')}
            />
            <h2>{detailModel.display_name}</h2>
            <Tag>{detailModel.name}</Tag>
            {detailModel.is_mainline ? (
              <Tag color="blue">{t('resource.model.options.boolean.yes')}</Tag>
            ) : null}
            {detailModel.is_builtin ? (
              <Tag color="gold">{t('resource.model.fields.builtIn')}</Tag>
            ) : null}
          </div>
          <div className="model-layout-subtitle">
            {detailModel.description || t('resource.model.empty.noDescription')}
          </div>
        </div>
        <Button onClick={() => navigate(buildModelDetailPath(detailModel.name, 'instances'))}>
          {t('resource.model.actions.viewInstances')}
        </Button>
      </div>

      <Descriptions bordered column={4} className="model-layout-summary">
        <Descriptions.Item label={t('resource.model.fields.classification')}>
          {t(`resource.model.options.classification.${detailModel.classification}`, {
            defaultValue: detailModel.classification,
          })}
        </Descriptions.Item>
        <Descriptions.Item label={t('resource.model.fields.group')}>
          {detailModel.group_display_name || detailModel.group_name || '--'}
        </Descriptions.Item>
        <Descriptions.Item label={t('resource.model.fields.icon')}>
          {detailModel.icon || '--'}
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
        <Descriptions.Item label={t('resource.model.fields.updatedAt')} span={2}>
          {detailModel.updated_at
            ? dayjs(detailModel.updated_at).format('YYYY-MM-DD HH:mm:ss')
            : '--'}
        </Descriptions.Item>
      </Descriptions>

      <Tabs
        activeKey={activeKey}
        onChange={(key) => navigate(buildModelDetailPath(detailModel.name, key))}
        items={[
          { key: 'basic', label: t('resource.model.tabs.basic') },
          { key: 'fields', label: t('resource.model.tabs.fields') },
          { key: 'uniques', label: t('resource.model.tabs.uniques') },
          { key: 'preview', label: t('resource.model.tabs.preview') },
          { key: 'instances', label: t('resource.model.tabs.instances') },
          { key: 'relations', label: t('resource.model.tabs.relations') },
          { key: 'history', label: t('resource.model.tabs.history') },
        ]}
      />

      <Outlet context={contextValue} />
    </div>
  );
};

export default ModelLayout;
