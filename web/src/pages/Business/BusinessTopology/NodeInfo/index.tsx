import React, { useMemo } from 'react';
import { Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { TreeData, TopoTreeNodeType } from '../../Types';
import { BusinessNodeInfo, IdleNodeInfo, SetNodeInfo, ModuleNodeInfo } from '../components';
import './style.css';

interface Props {
  selectedNode: TreeData;
}

const NodeInfo: React.FC<Props> = ({ selectedNode }) => {
  const { t } = useTranslation();

  // Get current node type
  const nodeType = useMemo(() => {
    if (!selectedNode) return null;
    return selectedNode.type;
  }, [selectedNode]);

  // If no node is selected
  if (!nodeType) {
    return <Alert message={t('business.topology.nodeInfo.selectNodeMessage')} type="info" />;
  }

  // Render appropriate node info based on type
  return (
    <div className="node-info-container">
      {nodeType === TopoTreeNodeType.Biz && <BusinessNodeInfo selectedNode={selectedNode} />}
      {nodeType === TopoTreeNodeType.Idle && <IdleNodeInfo selectedNode={selectedNode} />}
      {nodeType === TopoTreeNodeType.Set && <SetNodeInfo selectedNode={selectedNode} />}
      {nodeType === TopoTreeNodeType.Module && <ModuleNodeInfo selectedNode={selectedNode} />}
    </div>
  );
};

export default NodeInfo;
