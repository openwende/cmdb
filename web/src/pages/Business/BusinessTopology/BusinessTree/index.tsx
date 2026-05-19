import React, { Fragment, useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Spin, Tooltip } from 'antd';
import { useAppMessage } from '@/utils/message';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import TopologyTree from '../components/TopologyTree';
import EmptySearchResult from '@/components/common/EmptySearchResult';
import DragHandle from '@/components/common/DragHandle';
import { TreeData } from '../../Types';
import { filterTree, findNodeAndParents, collectAllKeys } from '../../utils';
import { getTopologyTree } from '@/api/services/business';
import { adaptTopologyTree } from '@/api/adapters/topologyAdapter';
import { useBusinessStore } from '@/store/BusinessStore';
import { useMainlineStore } from '@/store/MainlineStore';
import { useResponsive } from '@/utils/useResponsive';
import { useTransferHostStore } from '@/store/TransferHostStore';
import './style.css';

const MIN_WIDTH = 210;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 280;

const findIdleSetNode = (nodes: TreeData[]): TreeData | null => {
  for (const node of nodes) {
    if (node.backendType === 'idle_set') return node;
    if (node.children) {
      const found = findIdleSetNode(node.children);
      if (found) return found;
    }
  }
  return null;
};

interface Props {
  selectedNode: TreeData | null;
  initialSelectedKey?: string | null;
  topologyVersion: number;
  onTopologyChanged: () => void;
  onNodeSelect: (selectedNode: TreeData, parentNodes: TreeData[]) => void;
  currentBusinessName?: string;
  currentBusinessDisplayId?: string;
  businessList?: Array<{ id: number; name: string }>;
  onBusinessSwitch?: (businessId: number) => void;
}

const BusinessTree: React.FC<Props> = ({
  selectedNode,
  initialSelectedKey,
  topologyVersion,
  onTopologyChanged,
  onNodeSelect,
  currentBusinessName,
  currentBusinessDisplayId,
  businessList = [],
  onBusinessSwitch,
}) => {
  const { t } = useTranslation();
  const message = useAppMessage();
  const { currentBusiness } = useBusinessStore();
  const { topologySettings, loadTopologySettings } = useMainlineStore();
  const { isMobile } = useResponsive();
  const setIdleSetID = useTransferHostStore((state) => state.setIdleSetID);
  const [searchValue, setSearchValue] = useState<string>('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [fullTreeData, setFullTreeData] = useState<TreeData[]>([]);
  const [bizMenuOpen, setBizMenuOpen] = useState(false);
  const bizMenuRef = useRef<HTMLDivElement>(null);
  const requestSequenceRef = useRef(0);

  // Auto-collapse on mobile/narrow viewport
  useEffect(() => {
    if (isMobile) {
      setCollapsed(false);
    }
  }, [isMobile]);

  const loadTopologyTree = React.useCallback(async () => {
    if (!currentBusiness) {
      setFullTreeData([]);
      console.warn('No current business selected');
      return;
    }

    const requestSequence = ++requestSequenceRef.current;
    const requestedBusinessID = currentBusiness.id;

    setLoading(true);
    setFullTreeData([]);
    try {
      const response = await getTopologyTree({
        business_id: requestedBusinessID,
        include_hosts: false,
        max_depth: topologySettings?.max_topology_level || 10,
      });

      if (requestSequence !== requestSequenceRef.current) {
        return;
      }

      if (response.code === 0 && response.data) {
        const adaptedTree = adaptTopologyTree(response.data);
        setFullTreeData(adaptedTree);
        const idleSetNode = findIdleSetNode(adaptedTree);
        if (idleSetNode !== null) {
          setIdleSetID(Number(idleSetNode.nodeId));
        }
      } else {
        message.error(response.message || t('business.topology.tree.loadError'));
        setFullTreeData([]);
      }
    } catch (error) {
      if (requestSequence !== requestSequenceRef.current) {
        return;
      }

      console.error('Failed to load topology tree:', error);
      message.error(t('business.topology.tree.loadError'));
      setFullTreeData([]);
    } finally {
      if (requestSequence === requestSequenceRef.current) {
        setLoading(false);
      }
    }
  }, [currentBusiness, setIdleSetID, t, topologySettings?.max_topology_level]);

  useEffect(() => {
    loadTopologySettings();
  }, [loadTopologySettings]);

  useEffect(() => {
    loadTopologyTree();
  }, [loadTopologyTree, topologyVersion]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bizMenuRef.current && !bizMenuRef.current.contains(event.target as Node)) {
        setBizMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredTreeData = useMemo(() => {
    if (!searchValue.trim()) {
      return fullTreeData;
    }
    return filterTree(fullTreeData, searchValue);
  }, [fullTreeData, searchValue]);

  const searchExpandedKeys = useMemo(() => {
    if (!searchValue || filteredTreeData.length === 0) {
      return [];
    }
    return collectAllKeys(filteredTreeData);
  }, [searchValue, filteredTreeData]);

  useEffect(() => {
    if (loading || fullTreeData.length === 0) {
      return;
    }

    if (searchExpandedKeys.length > 0) {
      setExpandedKeys(searchExpandedKeys);
      return;
    }

    if (initialSelectedKey) {
      const { node, parents } = findNodeAndParents(fullTreeData, initialSelectedKey);
      if (node) {
        const parentKeys = parents.map((p) => p.key);
        setSelectedKeys([initialSelectedKey]);
        setExpandedKeys([...parentKeys, initialSelectedKey]);
        onNodeSelect(node, parents);
      }
    } else if (!selectedNode) {
      const firstNode = fullTreeData[0];
      if (firstNode) {
        setSelectedKeys([firstNode.key]);
        setExpandedKeys([firstNode.key]);
        onNodeSelect(firstNode, []);
      }
    }
  }, [initialSelectedKey, searchExpandedKeys, fullTreeData, loading]);

  const handleNodeSelect = (selectedNode: TreeData, parentNodes: TreeData[]) => {
    setSelectedKeys([selectedNode.key]);
    onNodeSelect(selectedNode, parentNodes);
  };

  const handleClearSearch = () => {
    setSearchValue('');
  };

  const isEmptySearchResult = filteredTreeData.length === 0 && searchValue;
  const isEmptyTree = fullTreeData.length === 0 && !loading;
  const topologyNodeCount = useMemo(() => collectAllKeys(fullTreeData).length, [fullTreeData]);

  return (
    <div
      className="topo-navigator"
      style={{
        width: collapsed ? 0 : sidebarWidth,
        minWidth: collapsed ? 0 : MIN_WIDTH,
        maxWidth: collapsed ? 0 : MAX_WIDTH,
      }}
    >
      {!collapsed && (
        <Fragment>
          <div className="biz-header">
            <div className="biz-header-switcher" ref={bizMenuRef}>
              <button
                type="button"
                className="biz-header-trigger"
                data-testid="topology-business-switcher"
                onClick={() => setBizMenuOpen((open) => !open)}
              >
                <span className="biz-header-trigger__label">
                  🏢 {currentBusinessName || currentBusiness?.name || t('business.topology.workspace.noBusiness')}
                </span>
                <span className="biz-header-trigger__arrow">▾</span>
              </button>
              {bizMenuOpen && (
                <div className="biz-header-dropdown">
                  {businessList.map((biz) => (
                    <button
                      key={biz.id}
                      type="button"
                      className={`biz-header-dropdown__item${
                        biz.name === (currentBusinessName || currentBusiness?.name) ? ' active' : ''
                      }`}
                      onClick={() => {
                        setBizMenuOpen(false);
                        onBusinessSwitch?.(biz.id);
                      }}
                    >
                      {biz.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="biz-header-desc">
              <span className="stat-badge">{topologyNodeCount} {t('business.topology.tree.nodes', '节点')}</span>
              {(currentBusinessDisplayId || currentBusiness?.id) && (
                <span className="stat-badge">#{currentBusinessDisplayId || currentBusiness?.id}</span>
              )}
            </div>
          </div>

          <div className="topo-search">
            <Input.Search
              id="business-topology-search"
              name="business_topology_search"
              className="search-input"
              placeholder={t('business.topology.tree.search', '搜索节点名称...')}
              allowClear
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value.trim())}
              onClear={() => setSearchValue('')}
              disabled={loading}
              style={{ padding: 0 }}
            />
          </div>
          
          <div className="topo-tree-container">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '50px 0' }}>
                <Spin />
                <div style={{ marginTop: 8, color: 'var(--color-text-tertiary)', fontSize: 13 }}>{t('common.loading')}</div>
              </div>
            ) : isEmptyTree ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--color-text-tertiary)' }}>
                {t('business.topology.tree.noData')}
              </div>
            ) : isEmptySearchResult ? (
              <EmptySearchResult onClearFilter={handleClearSearch} />
            ) : (
              <div className="topo-tree">
                <TopologyTree
                  treeData={filteredTreeData}
                  selectedKeys={selectedKeys}
                  expandedKeys={expandedKeys}
                  searchValue={searchValue}
                  onTopologyChanged={onTopologyChanged}
                  onNodeSelect={handleNodeSelect}
                />
              </div>
            )}
          </div>

          <DragHandle
            minWidth={MIN_WIDTH}
            maxWidth={MAX_WIDTH}
            currentWidth={sidebarWidth}
            onWidthChange={setSidebarWidth}
            className="no-grabber"
          />
        </Fragment>
      )}
      
      <Tooltip
        title={collapsed ? t('business.topology.tree.expandPanel', '展开拓扑树') : t('business.topology.tree.collapsePanel', '收起拓扑树')}
        placement="right"
      >
        <button
          type="button"
          className="collapsed-button"
          style={{
            position: 'absolute',
            right: -15,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 16,
            height: 100,
          }}
          onClick={() => setCollapsed((c) => !c)}
          aria-label={
            collapsed
              ? t('business.topology.tree.expandPanel', '展开拓扑树')
              : t('business.topology.tree.collapsePanel', '收起拓扑树')
          }
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <RightOutlined className="collapsed-icon" />
          ) : (
            <LeftOutlined className="collapsed-icon" />
          )}
        </button>
      </Tooltip>
    </div>
  );
};

export default BusinessTree;
