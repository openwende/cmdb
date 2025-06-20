import React, { useState, useEffect, useCallback } from 'react';
import { Tabs } from 'antd';
import { Outlet, useMatch, useSearchParams } from 'react-router-dom';
import BusinessTree from './BusinessTree';
import HostList from './HostList';
import ServiceInstance from './ServiceInstance';
import NodeInfo from './NodeInfo';
import './style.css';
import { TreeData } from '../Types';
import { findNodeAndParents } from '../utils';

export const businessTopoPath = '/business/topology';
export const transferHostPath = businessTopoPath + '/transferHost';

const BusinessTopology: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'hostList');
    const [selectedNodes, setSelectedNodes] = useState<TreeData[]>([]);
    const nodeKey = searchParams.get('node');
    const [selectedKeys, setSelectedKeys] = useState<string[]>(nodeKey ? [nodeKey] : []);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [treeData, setTreeData] = useState<TreeData[]>([]);
    const [view, setView] = useState<'instance' | 'process'>(searchParams.get('view') === 'process' ? 'process' : 'instance');
    const isTransferHostRoute = useMatch(transferHostPath);
    const prevPathnameRef = React.useRef(window.location.pathname);

    useEffect(() => {
        const tabParam = searchParams.get('tab') || 'hostList';
        const viewParam = searchParams.get('view') as 'instance' | 'process' | null;

        const isJustSwitchedToCurPath = (
            location.pathname === businessTopoPath &&
            prevPathnameRef.current !== businessTopoPath
        );

        setActiveTab(tabParam);
        if (tabParam === 'serviceInstance' && viewParam) {
            setView(viewParam);
        } else {
            setView('instance');
        }

        if (treeData.length === 0) return;
        const nodeKey = searchParams.get('node');
        if (nodeKey) {
            const { node, parentKeys } = findNodeAndParents(treeData, nodeKey);
            if (node) {
                setSelectedKeys([nodeKey]);
                setSelectedNodes([node]);
                if (isJustSwitchedToCurPath) {
                    // On initial load, expand the selected node and its parents
                    setExpandedKeys([...parentKeys, nodeKey]);
                } else {
                    // Not the initial load, so expand the node triggered by the user
                    setExpandedKeys(prevExpandedKeys =>
                        Array.from(new Set([...prevExpandedKeys, ...parentKeys, nodeKey]))
                    );
                }
            }
        } else {
            const firstNode = treeData[0];
            if (firstNode) {
                setSelectedKeys([firstNode.key]);
                setSelectedNodes([firstNode]);
                setExpandedKeys([firstNode.key]);
            }
        }

        prevPathnameRef.current = location.pathname;
    }, [searchParams, treeData, location.pathname]);

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

    const handleNodeSelect = (node: TreeData) => {
        const isAlreadySelected = selectedKeys.includes(node.key);
        const isCurrentlyExpanded = expandedKeys.includes(node.key);

        const params = new URLSearchParams(searchParams);
        params.set('node', node.key);
        setSearchParams(params);

        if (!node.children || node.children.length === 0) {
            return;
        }

        if (isAlreadySelected) {
            // Node is selected, toggle expand/collapse
            if (isCurrentlyExpanded) {
                setExpandedKeys(expandedKeys.filter(k => k !== node.key));
            } else {
                setExpandedKeys([...expandedKeys, node.key]);
            }
        } else {
            // Node is not selected, select and expand
            const { parentKeys } = findNodeAndParents(treeData, node.key);
            const newExpanded = Array.from(new Set([...expandedKeys, ...parentKeys, node.key]));
            setExpandedKeys(newExpanded);
        }
    };

    const handleTreeExpand = (keys: string[]) => {
        setExpandedKeys(keys);
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
            children: <HostList selectedNodes={selectedNodes} />
        },
        {
            key: 'serviceInstance',
            label: '服务实例',
            children: <ServiceInstance selectedNode={selectedNodes} view={view} setView={handleViewChange} />
        },
        {
            key: 'nodeInfo',
            label: '节点信息',
            children: <NodeInfo selectedNode={selectedNodes} />
        }
    ];

    return (
        <>
            {
                isTransferHostRoute ? <Outlet /> : (
                    <div className='topology-wrapper'>
                        <BusinessTree
                            selectedNodes={selectedNodes}
                            onSelectNode={handleNodeSelect}
                            selectedKeys={selectedKeys}
                            expandedKeys={expandedKeys}
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