import React, { Fragment, useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Spin, message } from 'antd';
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
import './style.css';

const MIN_WIDTH = 210;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 280;

interface Props {
  selectedNode: TreeData | null;
  initialSelectedKey?: string | null;
  topologyVersion: number;
  onTopologyChanged: () => void;
  onNodeSelect: (selectedNode: TreeData, parentNodes: TreeData[]) => void;
}

const BusinessTree: React.FC<Props> = ({
  selectedNode,
  initialSelectedKey,
  topologyVersion,
  onTopologyChanged,
  onNodeSelect,
}) => {
  const { t } = useTranslation();
  const { currentBusiness } = useBusinessStore();
  const { topologySettings, loadTopologySettings } = useMainlineStore();
  const [searchValue, setSearchValue] = useState<string>('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [fullTreeData, setFullTreeData] = useState<TreeData[]>([]);
  const requestSequenceRef = useRef(0);

  const loadTopologyTree = React.useCallback(async () => {
    if (!currentBusiness) {
      setFullTreeData([]);
      console.warn('No current business selected');
      return;
    }

    const requestSequence = ++requestSequenceRef.current;
    const requestedBusinessID = currentBusiness.id.toString();

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
        setFullTreeData(adaptTopologyTree(response.data));
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
  }, [currentBusiness, t, topologySettings?.max_topology_level]);

  useEffect(() => {
    loadTopologySettings();
  }, [loadTopologySettings]);

  useEffect(() => {
    loadTopologyTree();
  }, [loadTopologyTree, topologyVersion]);

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
            <div className="biz-header-title">
              <span>🏢 {currentBusiness?.name || t('business.topology.workspace.noBusiness')}</span>
            </div>
            <div className="biz-header-desc">
              <span className="stat-badge">{topologyNodeCount} {t('business.topology.tree.nodes', '节点')}</span>
              {currentBusiness?.displayId && <span className="stat-badge">#{currentBusiness.displayId}</span>}
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
                <Spin tip={t('common.loading')} />
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
      
      <div
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
      >
        {collapsed ? (
          <RightOutlined className="collapsed-icon" />
        ) : (
          <LeftOutlined className="collapsed-icon" />
        )}
      </div>
    </div>
  );
};

export default BusinessTree;
