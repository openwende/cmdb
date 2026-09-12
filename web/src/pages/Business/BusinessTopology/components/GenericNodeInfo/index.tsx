import React, { useMemo } from 'react';
import { Collapse } from 'antd';
import { useTranslation } from 'react-i18next';
import InfoItem from '../InfoItem';
import { TreeData } from '../../../Types';
import './style.css';

interface Props {
  selectedNode: TreeData;
}

const GenericNodeInfo: React.FC<Props> = ({ selectedNode }) => {
  const { t } = useTranslation();

  const extraItems = useMemo(() => {
    if (!selectedNode.extra) {
      return [];
    }

    return Object.entries(selectedNode.extra).filter(([, value]) => {
      return value !== null && value !== undefined && value !== '';
    });
  }, [selectedNode.extra]);

  return (
    <Collapse
      defaultActiveKey={['1', '2']}
      ghost
      items={[
        {
          key: '1',
          label: (
            <span className="basic-info">{t('business.topology.businessNodeInfo.basicInfo')}</span>
          ),
          children: (
            <div className="info-grid">
              <InfoItem label="ID" value={selectedNode.nodeId || selectedNode.key} />
              <InfoItem
                label={t('business.topology.businessNodeInfo.businessName')}
                value={String(selectedNode.title)}
              />
              <InfoItem label="Node Type" value={selectedNode.backendType || selectedNode.type} />
              <InfoItem label="Icon" value={selectedNode.icon} />
            </div>
          ),
        },
        {
          key: '2',
          label: <span className="basic-info">Extra</span>,
          children: (
            <div className="info-grid">
              {extraItems.length > 0 ? (
                extraItems.map(([key, value]) => (
                  <InfoItem key={key} label={key} value={String(value)} />
                ))
              ) : (
                <InfoItem label="Info" value="--" />
              )}
            </div>
          ),
        },
      ]}
    />
  );
};

export default GenericNodeInfo;
