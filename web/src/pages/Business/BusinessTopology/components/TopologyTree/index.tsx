import React, { useState, useEffect, useMemo } from 'react';
import { Button, Tree } from 'antd';
import { InboxOutlined, WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import CreateNodeModal from '../CreateNodeModal';
import { getBusinessTopologyChildModels } from '@/pages/Business/BusinessTopology/modelRules';
import { TailEleType, TopoTreeNodeType, TreeData } from '@/pages/Business/Types';
import { useMainlineStore } from '@/store/MainlineStore';
import './style.css';
import { findNodeAndParents } from '@/pages/Business/utils';
import { useAuthStore } from '@/store/AuthStore';

const getNodeAllowedActions = (node: TreeData): string[] | null => {
  const allowedActions = node.extra?.allowed_actions;
  return Array.isArray(allowedActions)
    ? allowedActions.filter((item) => typeof item === 'string')
    : null;
};

const isIdlePoolNode = (node: TreeData): boolean =>
  node.backendType === 'idle_set' ||
  node.type === TopoTreeNodeType.Idle ||
  String(node.title ?? '').includes('空闲机池');

interface Props {
  treeData: TreeData[];
  tailEleType?: TailEleType;
  searchValue?: string;
  onlyLeafSelectable?: boolean;
  selectedKeys?: string[];
  expandedKeys?: string[];
  onTopologyChanged?: () => void;
  onNodeSelect: (selectedNode: TreeData, parentNodes: TreeData[]) => void;
  customTitlePrefix?: (node: TreeData, isSelected: boolean) => React.ReactNode;
}

const TopologyTree: React.FC<Props> = ({
  treeData,
  tailEleType = TailEleType.All,
  searchValue,
  onlyLeafSelectable = false,
  selectedKeys: controlledSelectedKeys,
  expandedKeys: controlledExpandedKeys,
  onTopologyChanged,
  onNodeSelect,
  customTitlePrefix,
}) => {
  const { t } = useTranslation();
  const { getChildModels } = useMainlineStore();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [targetNodeKey, setTargetNodeKey] = useState<string | null>(null);
  const canWrite = useAuthStore((state) => state.canWrite());

  useEffect(() => {
    // Handle expanded keys logic
    if (controlledExpandedKeys && controlledExpandedKeys.length > 0) {
      setExpandedKeys(controlledExpandedKeys);
    } else if (searchValue && treeData.length > 0) {
      // Auto expand all nodes when searching
      const allKeys = treeData.map((node) => node.key);
      setExpandedKeys(allKeys);
    }
  }, [treeData, searchValue, controlledExpandedKeys]);

  useEffect(() => {
    if (controlledSelectedKeys) {
      setSelectedKeys(controlledSelectedKeys);
    }
  }, [controlledSelectedKeys]);

  const handleNodeSelect = (node: TreeData) => {
    const key = node.key;
    const hasChildren = !!(node.children && node.children.length > 0);

    if (onlyLeafSelectable && hasChildren) {
      // Only leaf nodes are selectable
      // clicking parent nodes only toggles their expansion
      toggleExpand(key);
      return;
    }

    const isExpanded = expandedKeys.includes(key);
    const isSelected = selectedKeys.includes(key);

    // Prepare selection info with parent nodes
    const { parents } = findNodeAndParents(treeData, key);

    if (!hasChildren) {
      // Leaf nodes: Select directly
      setSelectedKeys([key]);
      onNodeSelect(node, parents);
      return;
    }
    if (!isExpanded) {
      // Select first
      setSelectedKeys([key]);
      onNodeSelect(node, parents);
      // Expand on the next tick to ensure the DOM has rendered the selection changes
      setTimeout(() => toggleExpand(key), 0);
      return;
    } else if (isSelected) {
      toggleExpand(key);
      return;
    }

    setSelectedKeys([key]);
    onNodeSelect(node, parents);
  };

  const toggleExpand = (key: string) => {
    const idx = expandedKeys.indexOf(key);
    let newExpanded;
    if (idx > -1) {
      newExpanded = expandedKeys.filter((k) => k !== key);
    } else {
      newExpanded = [...expandedKeys, key];
    }
    setExpandedKeys(newExpanded);
  };

  const handleNodeTitleClick = (e: React.MouseEvent, node: TreeData) => {
    e.stopPropagation();
    handleNodeSelect(node);
  };

  const handleCreate = (e: React.MouseEvent<HTMLElement, MouseEvent>, node: TreeData) => {
    e.stopPropagation();

    if (!canCreateChildren(node)) {
      return;
    }

    setTargetNodeKey(node.key);
    setModalVisible(true);
  };

  const canCreateChildren = (node: TreeData) => {
    if (isIdlePoolNode(node)) {
      return false;
    }

    const allowedActions = getNodeAllowedActions(node);
    if (allowedActions) {
      return allowedActions.includes('create_child');
    }

    const nodeModelUID =
      node.backendType || (node.type === TopoTreeNodeType.Biz ? 'business' : node.type);
    return getBusinessTopologyChildModels(nodeModelUID, getChildModels).length > 0;
  };

  const renderTailElement = (node: TreeData, hoveredKey: string, isSelected: boolean) => {
    const showHostCount = node.type === TopoTreeNodeType.Module;
    const hostCount = Number(node.extra?.host_count ?? 0);
    const childCount = Number(node.extra?.child_count ?? node.children?.length ?? 0);
    const nodeCount = showHostCount ? Math.max(hostCount, childCount) : 0;

    if (tailEleType === TailEleType.Count) {
      if (!showHostCount) {
        return null;
      }
      return (
        <span className="right-wrapper">
          <span className={`suffix-count ${isSelected ? ' selected' : ''}`}>{nodeCount}</span>
        </span>
      );
    }

    if (tailEleType === TailEleType.All) {
      const isHovered = hoveredKey === node.key;
      const canCreateChildrenForNode = canCreateChildren(node);
      return (
        <span className="right-wrapper">
          {isHovered && canWrite && canCreateChildrenForNode ? (
            <Button
              type="primary"
              size="small"
              className="topology-tree-create-button"
              onClick={(e) => handleCreate(e, node)}
            >
              {t('resource.business.actions.create')}
            </Button>
          ) : showHostCount ? (
            <span className={`suffix-count ${isSelected ? 'selected' : ''}`}>{nodeCount}</span>
          ) : null}
        </span>
      );
    }

    return null;
  };

  const renderTitle = (node: TreeData) => {
    const isSelected = selectedKeys.some((Item) => Item === node.key);

    return (
      <span
        className={`title-wrapper ${isSelected ? 'active' : ''}`}
        onMouseEnter={() => setHoveredKey(node.key)}
        onMouseLeave={() => setHoveredKey(null)}
        onClick={(e) => handleNodeTitleClick(e, node)}
        style={{ cursor: 'pointer' }}
      >
        <span className="left-wrapper">
          {customTitlePrefix
            ? customTitlePrefix(node, isSelected)
            : renderNodeBadge(node, isSelected)}
          <span className="title-text">{node.title}</span>
        </span>
        {renderTailElement(node, hoveredKey!, isSelected)}
      </span>
    );
  };

  const renderNodeBadge = (node: TreeData, isSelected: boolean) => {
    const typeStr = node.type?.toLowerCase() || 'biz';
    const title = typeof node.title === 'string' ? node.title : String(node.title ?? '');
    const lifecycle = String(node.extra?.lifecycle ?? '').toLowerCase();
    const isFaultIdleNode = title.includes('故障') || lifecycle.includes('fault');
    const isIdleVisualNode =
      node.backendType === 'idle_set' ||
      node.backendType === 'idle_module' ||
      node.type === TopoTreeNodeType.Idle ||
      title.includes('空闲机池') ||
      title.includes('待回收') ||
      title.includes('空闲机') ||
      isFaultIdleNode;

    if (isIdleVisualNode) {
      const IdleIcon = isFaultIdleNode ? WarningOutlined : InboxOutlined;
      const selectedIconStyle: React.CSSProperties | undefined = isSelected
        ? {
            backgroundColor: '#eff6ff',
            color: '#2563eb',
            borderColor: '#bfdbfe',
            boxShadow: '0 0 0 3px #eff6ff',
          }
        : undefined;
      return (
        <span
          className={`node-badge node-badge--icon badge-idle${
            isFaultIdleNode ? ' badge-idle-fault' : ''
          }${isSelected ? ' selected' : ''}`}
          style={selectedIconStyle}
        >
          <IdleIcon />
        </span>
      );
    }

    let label = '业';
    switch (node.type) {
      case TopoTreeNodeType.Module:
        label = '模';
        break;
      case TopoTreeNodeType.Set:
        label = '集';
        break;
    }

    const selectedCircleStyle: React.CSSProperties | undefined = isSelected
      ? {
          backgroundColor: '#2563eb',
          color: '#ffffff',
          borderColor: '#bfdbfe',
          boxShadow: '0 0 0 3px #eff6ff',
        }
      : undefined;

    return (
      <span
        className={`node-badge node-badge--circle badge-${typeStr}${isSelected ? ' selected' : ''}`}
        style={selectedCircleStyle}
      >
        {label}
      </span>
    );
  };

  const { node: targetNode, parents: parentNodes } = useMemo(() => {
    if (targetNodeKey === null) {
      return { node: null, parents: [] };
    }
    return findNodeAndParents(treeData, targetNodeKey);
  }, [targetNodeKey, treeData]);

  return (
    <>
      <Tree
        treeData={treeData}
        blockNode={true}
        multiple={true}
        titleRender={renderTitle}
        selectedKeys={selectedKeys}
        expandedKeys={expandedKeys}
        onExpand={(keys) => setExpandedKeys(keys as string[])}
        className="topology-tree"
      />
      {/* Modal for creating set and module*/}
      {targetNode && (
        <CreateNodeModal
          visible={modalVisible}
          selectedNode={targetNode}
          parentNodes={parentNodes}
          onCreated={onTopologyChanged || (() => undefined)}
          onClose={() => setModalVisible(false)}
        />
      )}
    </>
  );
};

export default TopologyTree;
