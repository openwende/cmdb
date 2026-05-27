import React, { useState } from 'react';
import { Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import Properties from '../components/Properties';
import './style.css';

const BusinessDetail: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('attributes');

  const tabItems = [
    {
      key: 'attributes',
      label: t('resource.business.detail.tabs.attributes'),
      children: id && <Properties businessId={id} />,
    },
  ];

  return (
    <div className="business-detail">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        className="detail-tabs"
      />
    </div>
  );
};

export default BusinessDetail;
