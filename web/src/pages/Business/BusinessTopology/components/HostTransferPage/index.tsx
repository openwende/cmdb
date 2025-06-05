import React, { useState } from 'react';
import { Button, Collapse, Tooltip } from 'antd';
import { EditOutlined, PlusOutlined, LeftOutlined } from '@ant-design/icons';
import AddHostModal from '../AddHostModal';
import AddProcessModal from '../AddProcessModal';
import { transferTarget } from '@/mock/business';
import './style.css';

const { Panel } = Collapse;

interface Props {
    onBack: () => void;
    selectedHosts: any[];
    targetModuleId?: string;
}

const HostTransferPage: React.FC<Props> = ({ onBack, selectedHosts, targetModuleId }) => {
    const [showEditHostModal, setShowEditHostModal] = useState(false);
    const [showAddProcessModal, setShowAddProcessModal] = useState(false);
    const [currentHosts, setCurrentHosts] = useState(selectedHosts);

    // Get tooltip content for transfer target
    const getTransferTargetTooltip = () => {
        if (!targetModuleId) return '';
        
        const target = transferTarget.nodes.find(node => 
            node.topo_node.bk_inst_id.toString() === targetModuleId
        );
        
        if (!target) return '';
        
        // Build topology path string
        const pathReversed = [...target.topo_path].reverse();
        return pathReversed.map(item => item.bk_inst_name).join(' > ');
    };

    // Handle edit hosts
    const handleEditHosts = () => {
        setShowEditHostModal(true);
    };

    // Handle confirm edit hosts
    const handleConfirmEditHosts = (hosts: any[]) => {
        setCurrentHosts(hosts);
        setShowEditHostModal(false);
    };

    // Handle add process
    const handleAddProcess = () => {
        setShowAddProcessModal(true);
    };

    return (
        <div className="host-transfer-page">
            <div className="page-header">
                <div className="breadcrumb-navigation">
                    <Button type="link" icon={<LeftOutlined />} onClick={onBack}>
                        业务拓扑
                    </Button>
                    <span className="separator">/</span>
                    <span className="current-page">添加主机</span>
                </div>
                <div className="page-info">
                    <span>已选主机: {currentHosts.length} 台</span>
                    <span className="separator">•</span>
                    <span>转移目标: {targetModuleId ? `module${targetModuleId}` : '未选择'}</span>
                </div>
            </div>

            <div className="page-content">
                {/* Selected hosts section */}
                <div className="hosts-section">
                    <div className="hosts-header">
                        <span>已选择 {currentHosts.length} 台主机</span>
                        <EditOutlined 
                            className="edit-icon" 
                            onClick={handleEditHosts}
                        />
                    </div>
                    <div className="hosts-list">
                        {currentHosts.map((host, index) => (
                            <span key={index} className="host-item">
                                {host.bk_host_innerip}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Transfer target section */}
                <div className="transfer-section">
                    <span>转移到</span>
                    <Tooltip title={getTransferTargetTooltip()}>
                        <span className="transfer-target">
                            {targetModuleId ? `模块 ${targetModuleId}` : '未选择目标模块'}
                        </span>
                    </Tooltip>
                </div>

                {/* Process management section */}
                <div className="process-section">
                    <h3>进程管理</h3>
                    <Collapse defaultActiveKey={['1']} className="process-collapse">
                        <Panel header="10.0.0.4 (未识别到进程)" key="1">
                            <div className="process-content">
                                <p>当前主机未检测到进程，您可以点击下方按钮添加进程</p>
                            </div>
                        </Panel>
                        <Panel header="10.0.0.6 (未识别到进程)" key="2">
                            <div className="process-content">
                                <p>当前主机未检测到进程，您可以点击下方按钮添加进程</p>
                            </div>
                        </Panel>
                    </Collapse>

                    {/* Add process button */}
                    <div className="add-process-btn-section">
                        <Button 
                            type="primary" 
                            icon={<PlusOutlined />}
                            onClick={handleAddProcess}
                        >
                            添加进程
                        </Button>
                    </div>
                </div>

                {/* Action buttons */}
                <div className="action-buttons">
                    <Button onClick={onBack}>
                        取消
                    </Button>
                    <Button type="primary">
                        确认转移
                    </Button>
                </div>
            </div>

            {/* Edit hosts modal */}
            <AddHostModal
                visible={showEditHostModal}
                onClose={() => setShowEditHostModal(false)}
                onConfirm={handleConfirmEditHosts}
                initialSelectedHosts={currentHosts}
            />

            {/* Add process modal */}
            <AddProcessModal
                visible={showAddProcessModal}
                onClose={() => setShowAddProcessModal(false)}
                onBack={() => setShowAddProcessModal(false)}
                selectedHosts={currentHosts}
                targetModuleId={targetModuleId}
            />
        </div>
    );
};

export default HostTransferPage; 