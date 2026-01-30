import React from 'react';
import { Collapse } from 'antd';
import { useTranslation } from 'react-i18next';
import { bizNodeInfo } from '@/mock/business';
import InfoItem from '../InfoItem';
import { TreeData } from '../../../Types';
import './style.css';

interface Props {
  selectedNode: TreeData;
}

const BusinessNodeInfo: React.FC<Props> = () => {
  const { t } = useTranslation();
  const bizData = bizNodeInfo[0];

  return (
    <>
      <Collapse
        defaultActiveKey={['1', '2']}
        ghost
        items={[
          {
            key: '1',
            label: (
              <span className="basic-info">
                {t('business.topology.businessNodeInfo.basicInfo')}
              </span>
            ),
            children: (
              <div className="info-grid">
                <InfoItem label="ID" value={bizData.bk_biz_id} />
                <InfoItem
                  label={t('business.topology.businessNodeInfo.businessName')}
                  value={bizData.bk_biz_name}
                />
                <InfoItem
                  label={t('business.topology.businessNodeInfo.createTime')}
                  value={new Date(bizData.create_time).toLocaleString()}
                />
                <InfoItem
                  label={t('business.topology.businessNodeInfo.creator')}
                  value={bizData.bk_created_by}
                />
                <InfoItem
                  label={t('business.topology.businessNodeInfo.updateTime')}
                  value={new Date(bizData.last_time).toLocaleString()}
                />
                <InfoItem
                  label={t('business.topology.businessNodeInfo.updater')}
                  value={bizData.bk_updated_by}
                />
                <InfoItem
                  label={t('business.topology.businessNodeInfo.lifecycle')}
                  value={
                    bizData.life_cycle === '2'
                      ? t('business.topology.businessNodeInfo.online')
                      : t('business.topology.businessNodeInfo.testing')
                  }
                />
                <InfoItem
                  label={t('business.topology.businessNodeInfo.timezone')}
                  value={bizData.time_zone}
                />
                <InfoItem
                  label={t('business.topology.businessNodeInfo.language')}
                  value={
                    bizData.language === '1'
                      ? t('business.topology.businessNodeInfo.chinese')
                      : t('business.topology.businessNodeInfo.english')
                  }
                />
              </div>
            ),
          },
          {
            key: '2',
            label: (
              <span className="basic-info">{t('business.topology.businessNodeInfo.roles')}</span>
            ),
            children: (
              <div className="info-grid">
                <InfoItem
                  label={t('business.topology.businessNodeInfo.maintainer')}
                  value={bizData.bk_biz_maintainer}
                />
                <InfoItem
                  label={t('business.topology.businessNodeInfo.productor')}
                  value={bizData.bk_biz_productor}
                />
                <InfoItem
                  label={t('business.topology.businessNodeInfo.tester')}
                  value={bizData.bk_biz_tester}
                />
                <InfoItem
                  label={t('business.topology.businessNodeInfo.developer')}
                  value={bizData.bk_biz_developer}
                />
                <InfoItem
                  label={t('business.topology.businessNodeInfo.operator')}
                  value={bizData.operator}
                />
              </div>
            ),
          },
        ]}
      />
    </>
  );
};

export default BusinessNodeInfo;
