import React from 'react';
import { Button, Result, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const ModelGlobalTopology: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div
      style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Result
        status="info"
        title={t('resource.model.topologyPending.title')}
        subTitle={t('resource.model.topologyPending.subtitle')}
        extra={
          <Space wrap>
            <Button type="primary" onClick={() => navigate('/model/overview')}>
              {t('resource.model.topologyPending.backOverview')}
            </Button>
            <Button onClick={() => navigate('/model/groups')}>
              {t('resource.model.topologyPending.viewGroups')}
            </Button>
            <Button onClick={() => navigate('/business')}>
              {t('resource.model.topologyPending.viewBusinessTopology')}
            </Button>
          </Space>
        }
      />
    </div>
  );
};

export default ModelGlobalTopology;
