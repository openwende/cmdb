import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { Outlet, useMatch, useSearchParams } from 'react-router-dom';
import BusinessTree from './BusinessTree';
import HostList from './HostList';
import ServiceInstance from './ServiceInstance';
import NodeInfo from './NodeInfo';
import './style.css';
import { TreeData } from '../Types';

export const transferHostPath = '/business/topology/transferHost';

const BusinessTopology: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'hostList');
    const [selectedNode, setSelectedNode] = useState<TreeData | null>(null);

    const isTransferHostRoute = useMatch(transferHostPath);

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

    const items = [
        {
            key: 'hostList',
            label: '主机列表',
            children: <HostList selectedNode={selectedNode} />
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
        <>
            {
                isTransferHostRoute ? <Outlet /> : (
                    <div className='topology-wrapper'>
                        <BusinessTree selectedNode={selectedNode} onSelectNode={handleNodeSelect} />
                        <Tabs
                            activeKey={activeTab}
                            onChange={handleTabChange}
                            items={items}
                            className='topology-tabs'
                        />
                    </div>
                )
            }
        </>
    );
};

export default BusinessTopology;