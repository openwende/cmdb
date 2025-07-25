import React, { useMemo } from 'react';
import { Alert } from 'antd';
import { TreeData, TopoTreeNodeType } from '../../Types';
import { 
    BusinessNodeInfo, 
    IdleNodeInfo, 
    SetNodeInfo, 
    ModuleNodeInfo
} from '../components';
import './style.css';

interface Props {
    selectedNode: TreeData;
}

const NodeInfo: React.FC<Props> = ({ selectedNode }) => {
    // Get current node type
    const nodeType = useMemo(() => {
        if (!selectedNode) return null;
        return selectedNode.type;
    }, [selectedNode]);

    // If no node is selected
    if (!nodeType) {
        return <Alert message="请选择一个节点查看详情" type="info" />;
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
