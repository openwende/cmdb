import React, { useState } from 'react';
import { Tabs } from 'antd';
import { useParams } from 'react-router-dom';
import Properties from '../components/Properties';
import './style.css';

const BusinessDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('attributes');

  const tabItems = [
    {
      key: 'attributes',
      label: '属性',
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
