import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Tabs } from 'antd';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BusinessTree from '../BusinessTree';
import HostList from '../HostList';
import ServiceInstance from '../ServiceInstance';
import NodeInfo from '../NodeInfo';
import './style.css';
import { TopoTreeNodeType, TreeData } from '../../Types';
import { getBusinessTopologyPath, getBusinessIdFromUrl } from '@/utils/routes';
import { useTopologySceneStore } from '@/store/TopologySceneStore';
import { useBusinessStore } from '@/store/BusinessStore';

const BusinessTopology: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('hostList');
  const [view, setView] = useState<'instance' | 'process'>('instance');
  const [topologyVersion, setTopologyVersion] = useState(0);
  const [bizMenuOpen, setBizMenuOpen] = useState(false);
  const bizMenuRef = useRef<HTMLDivElement>(null);
  const businessId = getBusinessIdFromUrl();
  const currentBusinessTopoPath = businessId ? getBusinessTopologyPath(businessId) : '';
  const { selectedNode, parentNodes, selectNode, reset } = useTopologySceneStore();
  const { currentBusiness, businessList, setCurrentBusiness, loadBusinessData } = useBusinessStore();
  const previousBusinessIdRef = useRef<string | null>(null);

  useEffect(() => {
    loadBusinessData();
  }, [loadBusinessData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bizMenuRef.current && !bizMenuRef.current.contains(event.target as Node)) {
        setBizMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBusinessSwitch = useCallback(
    (nextBiz: (typeof businessList)[0]) => {
      setBizMenuOpen(false);
      setCurrentBusiness(nextBiz);
      navigate(getBusinessTopologyPath(nextBiz.id));
    },
    [businessList, navigate, setCurrentBusiness],
  );

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

  useEffect(() => {
    if (!businessId || !businessList.length) {
      return;
    }

    const matchedBusiness = businessList.find(
      (item) => item.id === businessId || item.legacyId === businessId,
    );
    if (matchedBusiness && matchedBusiness.id !== currentBusiness?.id) {
      setCurrentBusiness(matchedBusiness);
    }
  }, [businessId, businessList, currentBusiness?.id, setCurrentBusiness]);

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

  const breadcrumbItems = useMemo(() => {
    const nodes = [...parentNodes];
    if (selectedNode) {
      nodes.push(selectedNode);
    }
    return nodes.map((node) => String(node.title));
  }, [parentNodes, selectedNode]);

  const nodeTypeLabel = (() => {
    switch (selectedNode?.type) {
      case TopoTreeNodeType.Module:
        return t('business.topology.workspace.module');
      case TopoTreeNodeType.Set:
        return t('business.topology.workspace.cluster');
      case TopoTreeNodeType.Idle:
        return t('business.topology.workspace.idlePool');
      case TopoTreeNodeType.Biz:
      default:
        return t('business.topology.workspace.business');
    }
  })();
  
  const badgeClass = `badge-${selectedNode?.type?.toLowerCase() || 'biz'}`;

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
        <div className="node-context-strip">
          <div className="context-left">
            <div className="context-eyebrow">{t('business.topology.workspace.currentNode')}</div>
            <div className="context-title">
              <span className={`node-badge ${badgeClass}`}>{nodeTypeLabel}</span>
              <span className="context-name">{panelTitle}</span>
            </div>
          </div>
          <div className="context-right">
            <div className="biz-switcher-wrapper" ref={bizMenuRef}>
              <button
                type="button"
                className="biz-switcher-btn"
                data-testid="topology-business-switcher"
                onClick={() => setBizMenuOpen((open) => !open)}
              >
                {currentBusiness?.name || t('business.topology.workspace.noBusiness')}
                <span className="biz-switcher-arrow">▾</span>
              </button>
              {bizMenuOpen && (
                <div className="biz-switcher-dropdown">
                  {businessList.map((biz) => (
                    <button
                      key={biz.id}
                      type="button"
                      className={`biz-dropdown-item${biz.id === currentBusiness?.id ? ' active' : ''}`}
                      onClick={() => handleBusinessSwitch(biz)}
                    >
                      {biz.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedNode && (
              <span className="context-tab-desc">
                {t(`business.topology.workspace.${activeTab}`)}
              </span>
            )}
            <div className="breadcrumb" data-testid="topology-node-breadcrumb">
              {breadcrumbItems.map((item, index) => (
                <span key={index}>{item}</span>
              ))}
            </div>
          </div>
        </div>
        
        <Tabs activeKey={activeTab} onChange={handleTabChange} items={items} className="topology-tabs" />
      </div>
    </div>
  );
};

export default BusinessTopology;
