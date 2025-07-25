import React from 'react';
import { Alert } from 'antd';
import InfoItem from '../InfoItem';
import { TreeData } from '../../../Types';
import './style.css';

interface Props {
    selectedNode: TreeData;
}

const IdleNodeInfo: React.FC<Props> = ({ selectedNode }) => {
    const idValue = selectedNode.key.split('-')[1] || selectedNode.key;

    return (
        <div className="idle-container">
            <Alert
                message='容器集群节点（Node）上没有运行任何Pod，都会归于 "空Pod节点"'
                type="info"
                showIcon
                className="alert-info"
            />
            <div className="info-grid">
                <InfoItem label="ID" value={idValue} />
                <InfoItem label="节点名称" value={selectedNode.title as string} />
            </div>
        </div>
    );
};

export default IdleNodeInfo;
