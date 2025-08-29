import React, { useState, useEffect, useMemo } from 'react';
import { Button, Tree } from 'antd';
import CreateNodeModal from '../CreateNodeModal';
import { TailEleType, TopoTreeNodeType, TreeData } from '@/pages/Business/Types';
import './style.css';
import { findNodeAndParents } from '@/pages/Business/utils';

interface Props {
    treeData: TreeData[];
    tailEleType?: TailEleType;
    searchValue?: string;
    onlyLeafSelectable?: boolean;
    selectedKeys?: string[];
    expandedKeys?: string[];
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
    onNodeSelect,
    customTitlePrefix
}) => {
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    // State for creating node
    const [modalVisible, setModalVisible] = useState(false);
    const [createType, setCreateType] = useState<TopoTreeNodeType>(TopoTreeNodeType.Set);
    const [targetNodeKey, setTargetNodeKey] = useState<string | null>(null);

    useEffect(() => {
        // Handle expanded keys logic
        if (controlledExpandedKeys && controlledExpandedKeys.length > 0) {
            setExpandedKeys(controlledExpandedKeys);
        } else if (searchValue && treeData.length > 0) {
            // Auto expand all nodes when searching
            const allKeys = treeData.map(node => node.key);
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
            newExpanded = expandedKeys.filter(k => k !== key);
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

        if (node.type === TopoTreeNodeType.Biz) {
            setCreateType(TopoTreeNodeType.Set);
        } else if (node.type === TopoTreeNodeType.Set) {
            setCreateType(TopoTreeNodeType.Module);
        }

        setTargetNodeKey(node.key);
        setModalVisible(true);
    };

    const renderTailElement = (node: TreeData, hoveredKey: string, isSelected: boolean) => {
        if (tailEleType === TailEleType.Count) {
            return <span className="right-wrapper">
                <span className={`suffix-count ${isSelected ? ' selected' : ''}`}>0</span>
            </span>
        }

        if (tailEleType === TailEleType.All) {
            const isHovered = hoveredKey === node.key;
            return (
                <span className="right-wrapper">
                    {isHovered && node.type !== TopoTreeNodeType.Idle && node.type !== TopoTreeNodeType.Module
                        ? <Button type="primary" size="small" onClick={e => handleCreate(e, node)}>新建</Button>
                        : <span className={`suffix-count ${isSelected ? 'selected' : ''}`}>0</span>
                    }
                </span>
            );
        }

        return null;
    };

    const renderTitle = (node: TreeData) => {
        const isSelected = selectedKeys.some(Item => Item === node.key);

        return (
            <span
                className="title-wrapper"
                onMouseEnter={() => setHoveredKey(node.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={(e) => handleNodeTitleClick(e, node)}
                style={{ cursor: 'pointer' }}
            >
                <span className="left-wrapper">
                    {
                        customTitlePrefix
                            ? customTitlePrefix(node, isSelected)
                            : renderTitlePrefix(isSelected, node.objName)
                    }
                    {node.title}
                </span>
                {renderTailElement(node, hoveredKey!, isSelected)}
            </span>
        );
    };

    const renderTitlePrefix = (isSelected: boolean, objName?: string) => {
        if (objName) {
            return <span className={`title-prefix ${isSelected ? 'selected' : ''}`}>
                {objName.charAt(0)}
            </span>;
        }
        return null;
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
                onExpand={keys => setExpandedKeys(keys as string[])}
                className="topology-tree"
            />
            {/* Modal for creating set and module*/}
            {targetNode && (
                <CreateNodeModal
                    visible={modalVisible}
                    type={createType}
                    selectedNode={targetNode}
                    parentNodes={parentNodes}
                    onClose={() => setModalVisible(false)}
                />
            )}
        </>
    );
};

export default TopologyTree;
