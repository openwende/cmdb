import React, { useMemo } from 'react';
import { Alert, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { TopoTreeNodeType } from '../../Types';
import {
  BusinessNodeInfo,
  GenericNodeInfo,
  IdleNodeInfo,
  SetNodeInfo,
  ModuleNodeInfo,
} from '../components';
import './style.css';
import { useTopologySceneStore } from '@/store/TopologySceneStore';
import { useNodeDetailStore } from '@/store/NodeDetailStore';

interface Props {
  onTopologyChanged?: () => void;
}

const NodeInfo: React.FC<Props> = ({ onTopologyChanged }) => {
  const { t } = useTranslation();
  const selectedNode = useTopologySceneStore((state) => state.selectedNode);
  const detail = useNodeDetailStore((state) => state.detail);
  const loading = useNodeDetailStore((state) => state.loading);
  const error = useNodeDetailStore((state) => state.error);

  // Get current node type
  const nodeType = useMemo(() => {
    if (!selectedNode) return null;
    return selectedNode.type;
  }, [selectedNode]);

  const enrichedNode = useMemo(() => {
    if (!selectedNode) {
      return null;
    }

    return {
      ...selectedNode,
      extra: {
        ...selectedNode.extra,
        ...(detail?.binding_summary ?? {}),
        allowed_actions: detail?.allowed_actions ?? [],
        model_uid: detail?.model_uid,
        path: detail?.path,
        statistics: detail?.statistics,
      },
    };
  }, [detail, selectedNode]);

  const renderContent = () => {
    if (!nodeType) {
      return <Alert message={t('business.topology.nodeInfo.selectNodeMessage')} type="info" />;
    }

    if (loading) {
      return (
        <div className="node-info-loading">
          <Spin />
        </div>
      );
    }

    if (error) {
      return <Alert message={error} type="error" />;
    }

    if (!enrichedNode) {
      return <Alert message={t('business.topology.nodeInfo.selectNodeMessage')} type="info" />;
    }

    return (
      <>
        {nodeType === TopoTreeNodeType.Biz && <BusinessNodeInfo selectedNode={enrichedNode} />}
        {nodeType === TopoTreeNodeType.Idle && <IdleNodeInfo selectedNode={enrichedNode} />}
        {nodeType === TopoTreeNodeType.Set && (
          <SetNodeInfo selectedNode={enrichedNode} onTopologyChanged={onTopologyChanged} />
        )}
        {nodeType === TopoTreeNodeType.Module && (
          <ModuleNodeInfo selectedNode={enrichedNode} onTopologyChanged={onTopologyChanged} />
        )}
        {![
          TopoTreeNodeType.Biz,
          TopoTreeNodeType.Idle,
          TopoTreeNodeType.Set,
          TopoTreeNodeType.Module,
        ].includes(nodeType as TopoTreeNodeType) && <GenericNodeInfo selectedNode={enrichedNode} />}
      </>
    );
  };

  return (
    <div className="node-info-wrapper">
      <div className="node-info-container">{renderContent()}</div>
    </div>
  );
};

export default NodeInfo;
