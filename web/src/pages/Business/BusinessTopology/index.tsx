import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs } from 'antd';
import { Outlet, useMatch, useSearchParams, useLocation } from 'react-router-dom';
import BusinessTree from './BusinessTree';
import HostList from './HostList';
import ServiceInstance from './ServiceInstance';
import NodeInfo from './NodeInfo';
import './style.css';
import { TreeData } from '../Types';
import { findNodeAndParents } from '../utils';
import { getBusinessTopologyPath, getTransferHostPath, getBusinessIdFromUrl } from '../../../utils/routes';

const BusinessTopology: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'hostList');
    const [selectedNodes, setSelectedNodes] = useState<TreeData[]>([]);
    const nodeKey = searchParams.get('node');
    const [selectedKeys, setSelectedKeys] = useState<string[]>(nodeKey ? [nodeKey] : []);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [treeData, setTreeData] = useState<TreeData[]>([]);
    const [view, setView] = useState<'instance' | 'process'>(searchParams.get('view') === 'process' ? 'process' : 'instance');
    const [shouldInitializeKeys, setShouldInitializeKeys] = useState(true);
    const location = useLocation();
    const businessId = getBusinessIdFromUrl();
    const currentBusinessTopoPath = businessId ? getBusinessTopologyPath(businessId) : '';
    const currentTransferHostPath = businessId ? getTransferHostPath(businessId) : '';
    const isTransferHostRoute = useMatch(currentTransferHostPath);
    const prevPathnameRef = useRef<string>('');

    useEffect(() => {
        const isJustSwitchedToCurPath = (
            location.pathname === currentBusinessTopoPath
            && prevPathnameRef.current !== currentBusinessTopoPath
        );
        if (!isJustSwitchedToCurPath) {
            // Update previous pathname after initialization
            prevPathnameRef.current = location.pathname;
            setShouldInitializeKeys(false);
            return;
        }

        setShouldInitializeKeys(true);
        const tabParam = searchParams.get('tab') || 'hostList';
        const viewParam = searchParams.get('view') as 'instance' | 'process' | null;

        setActiveTab(tabParam);
        if (tabParam === 'serviceInstance' && viewParam) {
            setView(viewParam);
        } else {
            setView('instance');
        }

        if (treeData.length === 0) return;
        const nodeKey = searchParams.get('node');
        if (nodeKey) {
            const { node, parents } = findNodeAndParents(treeData, nodeKey);
            const parentKeys = parents.map(p => p.key);
            if (node) {
                setSelectedKeys([nodeKey]);
                setSelectedNodes([node]);
                // On initial load, expand the selected node and its parents
                setExpandedKeys([...parentKeys, nodeKey]);
            }
        } else {
            const firstNode = treeData[0];
            if (firstNode) {
                setSelectedKeys([firstNode.key]);
                setSelectedNodes([firstNode]);
                setExpandedKeys([firstNode.key]);
            }
        }
        // Update previous pathname after initialization
        prevPathnameRef.current = location.pathname;
    }, [treeData, searchParams, location.pathname]);

    const handleTreeData = useCallback((data: TreeData[]) => {
        setTreeData(data);
    }, []);

    const handleTabChange = (key: string) => {
        setActiveTab(key);
        const params = new URLSearchParams(searchParams);
        params.set('tab', key);
        if (key !== 'serviceInstance') {
            params.delete('view');
        }
        setSearchParams(params);
    };

    const handleNodeSelect = useCallback((node: TreeData) => {
        const params = new URLSearchParams(searchParams);
        params.set('node', node.key);
        setSearchParams(params);
        setSelectedNodes([node]);
    }, [searchParams])

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
            children: <HostList selectedNodes={selectedNodes} treeData={treeData} />
        },
        {
            key: 'serviceInstance',
            label: '服务实例',
            children: <ServiceInstance selectedNodes={selectedNodes} view={view} setView={handleViewChange} />
        },
        {
            key: 'nodeInfo',
            label: '节点信息',
            children: <NodeInfo selectedNode={selectedNodes[0]} />
        }
    ];

    return (
        <>
            {
                isTransferHostRoute ? <Outlet /> : (
                    <div className='topology-wrapper'>
                        <BusinessTree
                            selectedKeys={shouldInitializeKeys ? selectedKeys : undefined}
                            expandedKeys={shouldInitializeKeys ? expandedKeys : undefined}
                            onSelectNode={handleNodeSelect}
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