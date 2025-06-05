import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { useSearchParams } from 'react-router-dom';
import BusinessTree from './BusinessTree';
import HostList from './HostList';
import ServiceInstance from './ServiceInstance';
import NodeInfo from './NodeInfo';
import HostTransferPage from './components/HostTransferPage';
import './style.css';
import { TreeData } from '../Types';

enum PageView {
    Topology = 'topology',
    HostTransfer = 'hostTransfer'
}

const BusinessTopology: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'hostList');
    const [selectedNode, setSelectedNode] = useState<TreeData | null>(null);
    const [currentView, setCurrentView] = useState<PageView>(PageView.Topology);
    const [transferData, setTransferData] = useState<{
        selectedHosts: any[];
        targetModuleId?: string;
    }>({ selectedHosts: [] });

    // Initialize from URL params
    useEffect(() => {
        const nodeParam = searchParams.get('node');
        const tabParam = searchParams.get('tab');

        if (nodeParam) {
            // setSelectedNode(nodeParam);
        }
        if (tabParam) {
            setActiveTab(tabParam);
        }
    }, [searchParams]);

    // Update URL when state changes
    const updateURL = (tab?: string, node?: string, page?: number) => {
        const params = new URLSearchParams(searchParams);

        if (tab) params.set('tab', tab);
        if (node) params.set('node', node);
        if (page) params.set('page', page.toString());

        setSearchParams(params);
    };

    // Handle tab change
    const handleTabChange = (key: string) => {
        setActiveTab(key);
        updateURL(key, selectedNode!.key, 1);
    };

    // Handle node selection
    const handleNodeSelect = (node: TreeData) => {
        setSelectedNode(node);
        updateURL(activeTab, node.key || undefined, 1);
    };

    // Handle navigation to host transfer page
    const handleGoToHostTransfer = (selectedHosts: any[], targetModuleId?: string) => {
        setTransferData({ selectedHosts, targetModuleId });
        setCurrentView(PageView.HostTransfer);
    };

    // Handle back to topology
    const handleBackToTopology = () => {
        setCurrentView(PageView.Topology);
        setTransferData({ selectedHosts: [] });
    };

    if (currentView === PageView.HostTransfer) {
        return (
            <HostTransferPage
                onBack={handleBackToTopology}
                selectedHosts={transferData.selectedHosts}
                targetModuleId={transferData.targetModuleId}
            />
        );
    }

    const items = [
        {
            key: 'hostList',
            label: '主机列表',
            children: <HostList selectedNode={selectedNode} onGoToHostTransfer={handleGoToHostTransfer} />
        },
        {
            key: 'serviceInstance',
            label: '服务实例',
            children: <ServiceInstance selectedNode={selectedNode} />
        },
        {
            key: 'nodeInfo',
            label: '节点信息',
            children: <NodeInfo selectedNode={selectedNode} />
        }
    ];

    return (
        <div className='topology-wrapper'>
            <BusinessTree selectedNode={selectedNode} onSelectNode={handleNodeSelect} />
            <Tabs
                activeKey={activeTab}
                onChange={handleTabChange}
                items={items}
                className='topology-tabs'
            />
        </div>
    );
};

export default BusinessTopology;