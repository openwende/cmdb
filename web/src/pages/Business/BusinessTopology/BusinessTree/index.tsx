import React, { Fragment, useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Input, Spin, message } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import TopologyTree from '../components/TopologyTree';
import EmptySearchResult from '@/components/common/EmptySearchResult';
import DragHandle from '@/components/common/DragHandle';
import { TreeData } from '../../Types';
import { filterTree, findNodeAndParents, collectAllKeys } from '../../utils';
import { getMainlineTopologyTree } from '@/api/services/mainline';
import { adaptTopologyTree } from '@/api/adapters/topologyAdapter';
import { useBusinessStore } from '@/store/BusinessStore';
import { useMainlineStore } from '@/store/MainlineStore';
import './style.css';

const MIN_WIDTH = 210;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 320;

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
  const { topologySettings, mainlineModels, loadTopologySettings, loadMainlineModels } =
    useMainlineStore();
  const [searchValue, setSearchValue] = useState<string>('');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_WIDTH);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [fullTreeData, setFullTreeData] = useState<TreeData[]>([]);

  const loadTopologyTree = React.useCallback(async () => {
    if (!currentBusiness) {
      console.warn('No current business selected');
      return;
    }

    setLoading(true);
    try {
      const response = await getMainlineTopologyTree({
        business_id: currentBusiness.id.toString(),
        include_hosts: false,
        max_depth: topologySettings?.max_topology_level || 10,
      });

      if (response.code === 0 && response.data) {
        setFullTreeData(adaptTopologyTree(response.data, mainlineModels));
      } else {
        message.error(response.message || t('business.topology.tree.loadError'));
        setFullTreeData([]);
      }
    } catch (error) {
      console.error('Failed to load topology tree:', error);
      message.error(t('business.topology.tree.loadError'));
      setFullTreeData([]);
    } finally {
      setLoading(false);
    }
  }, [currentBusiness, mainlineModels, t, topologySettings?.max_topology_level]);

  useEffect(() => {
    loadMainlineModels();
    loadTopologySettings();
  }, [loadMainlineModels, loadTopologySettings]);

  useEffect(() => {
    loadTopologyTree();
  }, [loadTopologyTree, topologyVersion]);

  const filteredTreeData = useMemo(() => {
    if (!searchValue.trim()) {
      return fullTreeData;
    }
    // Filter tree data based on search value
    return filterTree(fullTreeData, searchValue);
  }, [fullTreeData, searchValue]);

  // Generate expanded keys based on search results
  const searchExpandedKeys = useMemo(() => {
    if (!searchValue || filteredTreeData.length === 0) {
      return [];
    }
    return collectAllKeys(filteredTreeData);
  }, [searchValue, filteredTreeData]);

  useEffect(() => {
    // 等待数据加载完成
    if (loading || fullTreeData.length === 0) {
      return;
    }

    // Handle search-based expansion
    if (searchExpandedKeys.length > 0) {
      // When searching, expand all matching nodes
      setExpandedKeys(searchExpandedKeys);
      return;
    }

    // Handle initial selection
    if (initialSelectedKey) {
      const { node, parents } = findNodeAndParents(fullTreeData, initialSelectedKey);
      if (node) {
        const parentKeys = parents.map((p) => p.key);
        setSelectedKeys([initialSelectedKey]);
        setExpandedKeys([...parentKeys, initialSelectedKey]);
        onNodeSelect(node, parents);
      }
    } else if (!selectedNode) {
      // Select first node if no specific node is provided
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

  return (
    <div
      className="business-tree-wrapper"
      style={{
        width: collapsed ? 0 : sidebarWidth,
        minWidth: collapsed ? 0 : MIN_WIDTH,
        maxWidth: collapsed ? 0 : MAX_WIDTH,
        marginLeft: collapsed ? 0 : 20,
      }}
    >
      {/* The search input and tree*/}
      {!collapsed && (
        <Fragment>
          <div className="search-wrapper">
            <Input.Search
              placeholder={t('business.topology.tree.search')}
              allowClear
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value.trim())}
              onClear={() => setSearchValue('')}
              disabled={loading}
            />
          </div>
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
            <TopologyTree
              treeData={filteredTreeData}
              selectedKeys={selectedKeys}
              expandedKeys={expandedKeys}
              searchValue={searchValue}
              onTopologyChanged={onTopologyChanged}
              onNodeSelect={handleNodeSelect}
            />
          )}
          {/* The dragger */}
          <DragHandle
            minWidth={MIN_WIDTH}
            maxWidth={MAX_WIDTH}
            currentWidth={sidebarWidth}
            onWidthChange={setSidebarWidth}
            className="no-grabber"
          />
        </Fragment>
      )}
      {/* The collapsed button */}
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
