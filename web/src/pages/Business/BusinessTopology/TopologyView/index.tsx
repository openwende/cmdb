import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs } from 'antd';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BusinessTree from '../BusinessTree';
import HostList from '../HostList';
import ServiceInstance from '../ServiceInstance';
import NodeInfo from '../NodeInfo';
import './style.css';
import { TreeData } from '../../Types';
import { getBusinessTopologyPath, getBusinessIdFromUrl } from '@/utils/routes';

const DEFAULT_SELECTION = {
    selectedNode: null,
    parentNodes: []
};

interface NodeSelection {
    selectedNode: TreeData | null;
    parentNodes: TreeData[];
}

const BusinessTopology: React.FC = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState('hostList');
    const [nodeSelection, setNodeSelection] = useState<NodeSelection>(DEFAULT_SELECTION);
    const [view, setView] = useState<'instance' | 'process'>('instance');
    const [shouldInitializeKeys, setShouldInitializeKeys] = useState(true);
    const businessId = getBusinessIdFromUrl();
    const currentBusinessTopoPath = businessId ? getBusinessTopologyPath(businessId) : '';
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

        // Update previous pathname after initialization
        prevPathnameRef.current = location.pathname;
    }, [searchParams, location.pathname]);

    const handleTabChange = (key: string) => {
        setActiveTab(key);
        const params = new URLSearchParams(searchParams);
        params.set('tab', key);
        if (key !== 'serviceInstance') {
            params.delete('view');
        }
        setSearchParams(params);
    };

    const handleNodeSelect = useCallback((selectedNode: TreeData, parentNodes: TreeData[]) => {
        const params = new URLSearchParams(searchParams);
        params.set('node', selectedNode.key);
        setSearchParams(params);

        setNodeSelection({
            selectedNode,
            parentNodes
        });
    }, [searchParams, setSearchParams]);

    const handleViewChange = (v: 'instance' | 'process') => {
        setView(v);
        const params = new URLSearchParams(searchParams);
        params.set('view', v);
        setSearchParams(params);
    };

    const { selectedNode, parentNodes } = nodeSelection;

    const items = [
        {
            key: 'hostList',
            label: t('business.topology.tabs.hostList'),
            children: (
                selectedNode && (
                    <HostList
                        selectedNode={selectedNode}
                        parentNodes={parentNodes}
                    />
                )
            )
        },
        {
            key: 'serviceInstance',
            label: t('business.topology.tabs.serviceInstance'),
            children: (
                selectedNode && (
                    <ServiceInstance
                        selectedNode={selectedNode}
                        view={view}
                        setView={handleViewChange}
                    />
                )
            )
        },
        {
            key: 'nodeInfo',
            label: t('business.topology.tabs.nodeInfo'),
            children: (
                selectedNode && (
                    <NodeInfo
                        selectedNode={selectedNode}
                    />
                )
            )
        }
    ];

    const initialSelectedKey = shouldInitializeKeys ? searchParams.get('node') : null;

    return (
        <>
            <div className='topology-wrapper'>
                <BusinessTree
                    selectedNode={selectedNode}
                    initialSelectedKey={initialSelectedKey}
                    onNodeSelect={handleNodeSelect}
                />
                <Tabs
                    activeKey={activeTab}
                    onChange={handleTabChange}
                    items={items}
                    className='topology-tabs'
                />
            </div>
        </>
    );
};

export default BusinessTopology;