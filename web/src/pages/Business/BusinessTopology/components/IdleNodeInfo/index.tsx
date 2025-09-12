import React from 'react';
import { Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import InfoItem from '../InfoItem';
import { TreeData } from '../../../Types';
import './style.css';

interface Props {
    selectedNode: TreeData;
}

const IdleNodeInfo: React.FC<Props> = ({ selectedNode }) => {
    const { t } = useTranslation();
    const idValue = selectedNode.key.split('-')[1] || selectedNode.key;

    return (
        <div className="idle-container">
            <Alert
                message={t('business.topology.idleNodeInfo.alertMessage')}
                type="info"
                showIcon
                className="alert-info"
            />
            <div className="info-grid">
                <InfoItem label="ID" value={idValue} />
                <InfoItem label={t('business.topology.idleNodeInfo.nodeName')} value={selectedNode.title as string} />
            </div>
        </div>
    );
};

export default IdleNodeInfo;
