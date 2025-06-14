import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { Outlet, useMatch, useSearchParams } from 'react-router-dom';
import BusinessTree from './BusinessTree';
import HostList from './HostList';
import ServiceInstance from './ServiceInstance';
import NodeInfo from './NodeInfo';
import './style.css';
import { TreeData } from '../Types';
import { findNodeAndParents } from '../utils';

export const transferHostPath = '/business/topology/transferHost';

const BusinessTopology: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'hostList');
    const [selectedNode, setSelectedNode] = useState<TreeData | null>(null);
    const [treeSelectedKey, setTreeSelectedKey] = useState<string | undefined>(searchParams.get('node') || undefined);
    const [treeExpandedKeys, setTreeExpandedKeys] = useState<string[]>([]);
    const [treeData, setTreeData] = useState<TreeData[]>([]);
    const [view, setView] = useState<'instance' | 'process'>(searchParams.get('view') === 'process' ? 'process' : 'instance');
    const isTransferHostRoute = useMatch(transferHostPath);

    useEffect(() => {
        const tabParam = searchParams.get('tab');
        if (tabParam) setActiveTab(tabParam);
        const viewParam = searchParams.get('view');
        if (tabParam === 'serviceInstance' && (viewParam === 'process' || viewParam === 'instance')) {
            setView(viewParam);
        } else if (tabParam !== 'serviceInstance') {
            setView('instance');
            const params = new URLSearchParams(searchParams);
            params.delete('view');
            setSearchParams(params);
        }
    }, [searchParams]);

    const handleTreeData = (data: TreeData[]) => {
        setTreeData(data);
        const nodeKey = searchParams.get('node');
        if (nodeKey) {
            const { node, parentKeys } = findNodeAndParents(data, nodeKey);
            if (node) {
                setSelectedNode(node);
                setTreeSelectedKey(nodeKey);
                setTreeExpandedKeys([...parentKeys, nodeKey]);
            }
        } else if (data.length && treeExpandedKeys.length === 0) {
            setTreeExpandedKeys([data[0].key]);
            setSelectedNode(data[0]);
            setTreeSelectedKey(data[0].key);
            const params = new URLSearchParams(searchParams);
            params.set('node', data[0].key);
            setSearchParams(params);
        }
    };

    const handleTabChange = (key: string) => {
        setActiveTab(key);
        const params = new URLSearchParams(searchParams);
        params.set('tab', key);
        if (key !== 'serviceInstance') {
            params.delete('view');
        }
        setSearchParams(params);
    };

    const handleNodeSelect = (node: TreeData) => {
        setSelectedNode(node);
        setTreeSelectedKey(node.key);
        // Only append parentKeys and nodeKey to expandedKeys without removing existing entries
        const { parentKeys } = findNodeAndParents(treeData, node.key);
        const newExpanded = Array.from(new Set([...treeExpandedKeys, ...parentKeys, node.key]));
        setTreeExpandedKeys(newExpanded);
        const params = new URLSearchParams(searchParams);
        params.set('node', node.key);
        setSearchParams(params);
    };

    const handleTreeExpand = (keys: string[]) => {
        setTreeExpandedKeys(keys);
    };

    const handleViewChange = (v: 'instance' | 'process') => {
        setView(v);
        const params = new URLSearchParams(searchParams);
        params.set('view', v);
        setSearchParams(params);
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
            children: <ServiceInstance selectedNode={selectedNode} view={view} setView={handleViewChange} />
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
                        <BusinessTree
                            selectedNode={selectedNode}
                            onSelectNode={handleNodeSelect}
                            selectedKey={treeSelectedKey}
                            expandedKeys={treeExpandedKeys}
                            onExpand={handleTreeExpand}
                            onSearchDataChange={handleTreeData}
                        />
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