import React from 'react';
import { Descriptions, Tag } from 'antd';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { useModelPageContext } from '../../context';

const BasicInfoPage: React.FC = () => {
  const { t } = useTranslation();
  const { detailModel } = useModelPageContext();

  return (
    <div className="model-page">
      <Descriptions bordered column={2}>
        <Descriptions.Item label={t('resource.model.fields.displayName')}>
          {detailModel.display_name}
        </Descriptions.Item>
        <Descriptions.Item label={t('resource.model.fields.name')}>
          {detailModel.name}
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
  );
};

export default BasicInfoPage;
