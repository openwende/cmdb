import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs } from 'antd';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BusinessTree from '../BusinessTree';
import HostList from '../HostList';
import NodeInfo from '../NodeInfo';
import './style.css';
import { TreeData } from '../../Types';
import { getBusinessTopologyPath, getBusinessIdFromUrl } from '@/utils/routes';
import { useTopologySceneStore } from '@/store/TopologySceneStore';
import { useBusinessStore } from '@/store/BusinessStore';

const BusinessTopology: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('hostList');
  const [topologyVersion, setTopologyVersion] = useState(0);
  const businessId = getBusinessIdFromUrl();
  const currentBusinessTopoPath = businessId ? getBusinessTopologyPath(businessId) : '';
  const { selectedNode, parentNodes, selectNode, reset } = useTopologySceneStore();
  const { currentBusiness, businessList, setCurrentBusiness, loadBusinessData } =
    useBusinessStore();
  const previousBusinessIdRef = useRef<number | null>(null);

  useEffect(() => {
    loadBusinessData();
  }, [loadBusinessData]);

  useEffect(() => {
    if (location.pathname !== currentBusinessTopoPath) {
      return;
    }

    const tabParam = searchParams.get('tab') || 'hostList';
    setActiveTab(tabParam === 'nodeInfo' ? 'nodeInfo' : 'hostList');
  }, [currentBusinessTopoPath, location.pathname, searchParams]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    const params = new URLSearchParams(searchParams);
    params.set('tab', key);
    params.delete('view');
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
    setSearchParams(new URLSearchParams());
  }, [businessId, setSearchParams]);

  useEffect(() => {
    if (!businessId || !businessList.length) {
      return;
    }

    const matchedBusiness = businessList.find((item) => item.id === businessId);
    if (matchedBusiness && matchedBusiness.id !== currentBusiness?.id) {
      setCurrentBusiness(matchedBusiness);
    }
  }, [businessId, businessList, currentBusiness?.id, setCurrentBusiness]);

  const items = [
    {
      key: 'hostList',
      label: t('business.topology.tabs.hostList'),
      children: selectedNode && (
        <HostList
          selectedNode={selectedNode}
          parentNodes={parentNodes}
          onTopologyChanged={handleTopologyChanged}
        />
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

  return (
    <div className="topology-wrapper">
      <BusinessTree
        key={businessId ?? 'no-business'}
        selectedNode={selectedNode}
        initialSelectedKey={initialSelectedKey}
        topologyVersion={topologyVersion}
        onTopologyChanged={handleTopologyChanged}
        onNodeSelect={handleNodeSelect}
      />
      <div className="main-workspace">
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          items={items}
          className="topology-tabs"
        />
      </div>
    </div>
  );
};

export default BusinessTopology;
