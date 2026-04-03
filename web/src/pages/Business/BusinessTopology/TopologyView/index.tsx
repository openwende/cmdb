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
import { useTopologySceneStore } from '@/store/TopologySceneStore';

const BusinessTopology: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('hostList');
  const [view, setView] = useState<'instance' | 'process'>('instance');
  const [topologyVersion, setTopologyVersion] = useState(0);
  const businessId = getBusinessIdFromUrl();
  const currentBusinessTopoPath = businessId ? getBusinessTopologyPath(businessId) : '';
  const { selectedNode, parentNodes, selectNode, reset } = useTopologySceneStore();
  const previousBusinessIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (location.pathname !== currentBusinessTopoPath) {
      return;
    }

    const tabParam = searchParams.get('tab') || 'hostList';
    const viewParam = searchParams.get('view') as 'instance' | 'process' | null;

    setActiveTab(tabParam);
    if (tabParam === 'serviceInstance' && viewParam) {
      setView(viewParam);
    } else {
      setView('instance');
    }
  }, [currentBusinessTopoPath, location.pathname, searchParams]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    const params = new URLSearchParams(searchParams);
    params.set('tab', key);
    if (key !== 'serviceInstance') {
      params.delete('view');
    }
    setSearchParams(params);
  };

  const handleNodeSelect = useCallback(
    async (nextNode: TreeData, nextParents: TreeData[]) => {
      const params = new URLSearchParams(searchParams);
      params.set('node', nextNode.key);
      setSearchParams(params);

      await selectNode(nextNode, nextParents);
    },
    [searchParams, selectNode, setSearchParams],
  );

  const handleViewChange = (v: 'instance' | 'process') => {
    setView(v);
    const params = new URLSearchParams(searchParams);
    params.set('view', v);
    setSearchParams(params);
  };

  const handleTopologyChanged = useCallback(() => {
    setTopologyVersion((current) => current + 1);
  }, []);

  useEffect(() => {
    reset();
  }, [businessId, reset]);

  useEffect(() => {
    if (!businessId) {
      return;
    }

    const previousBusinessId = previousBusinessIdRef.current;
    previousBusinessIdRef.current = businessId;

    if (!previousBusinessId || previousBusinessId === businessId) {
      return;
    }

    setActiveTab('hostList');
    setView('instance');
    setSearchParams(new URLSearchParams());
  }, [businessId, setSearchParams]);

  const items = [
    {
      key: 'hostList',
      label: t('business.topology.tabs.hostList'),
      children:
        selectedNode && (
          <HostList
            selectedNode={selectedNode}
            parentNodes={parentNodes}
            onTopologyChanged={handleTopologyChanged}
          />
        ),
    },
    {
      key: 'serviceInstance',
      label: t('business.topology.tabs.serviceInstance'),
      children: selectedNode && (
        <ServiceInstance selectedNode={selectedNode} view={view} setView={handleViewChange} />
      ),
    },
    {
      key: 'nodeInfo',
      label: t('business.topology.tabs.nodeInfo'),
      children: <NodeInfo onTopologyChanged={handleTopologyChanged} />,
    },
  ];

  const initialSelectedKey =
    location.pathname === currentBusinessTopoPath ? searchParams.get('node') : null;

  const panelTitle = selectedNode ? String(selectedNode.title) : t('business.topology.workspace.noNode');
  const panelDescription = (() => {
    if (!selectedNode) {
      return t('business.topology.workspace.selectNode');
    }

    switch (activeTab) {
      case 'hostList':
        return t('business.topology.workspace.hostList');
      case 'serviceInstance':
        return t('business.topology.workspace.serviceInstance');
      case 'nodeInfo':
      default:
        return t('business.topology.workspace.nodeInfo');
    }
  })();

  return (
    <>
      <div className="topology-wrapper">
        <BusinessTree
          key={businessId ?? 'no-business'}
          selectedNode={selectedNode}
          initialSelectedKey={initialSelectedKey}
          topologyVersion={topologyVersion}
          onTopologyChanged={handleTopologyChanged}
          onNodeSelect={handleNodeSelect}
        />
        <div className="topology-panel">
          <div className="topology-panel__header">
            <div className="topology-panel__eyebrow">{t('business.topology.workspace.currentNode')}</div>
            <div className="topology-panel__title">{panelTitle}</div>
            <div className="topology-panel__description">{panelDescription}</div>
          </div>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={items}
            className="topology-tabs"
          />
        </div>
      </div>
    </>
  );
};

export default BusinessTopology;
