import React, { useState, useEffect, useMemo } from 'react';
import { Button, Tree } from 'antd';
import { businessData2, idleCluster2 } from '@/mock/business';
import CreateNodeModal from '../CreateNodeModal';
import { TailEleType, TopoTreeNodeType, TreeData } from '@/pages/Business/Types';
import './style.css';
import { useTransferHostStore } from '@/store/TransferHostStore';
import { buildTreeData, filterTree, findNodeAndParents } from '@/pages/Business/utils';

interface Props {
    onSelectNode: (node: TreeData) => void;
    tailEleType?: TailEleType;
    searchValue?: string;
    onSearchDataChange?: (data: TreeData[]) => void;
    onlyLeafSelectable?: boolean;
    selectedKeys?: string[];
    expandedKeys?: string[];
    customTreeData?: TreeData[];
    customTitlePrefix?: (node: TreeData, isSelected: boolean) => React.ReactNode;
}

const TopologyTree: React.FC<Props> = ({
    onSelectNode,
    tailEleType = TailEleType.All,
    searchValue,
    onSearchDataChange,
    onlyLeafSelectable = false,
    selectedKeys: controlledSelectedKeys,
    expandedKeys: controlledExpandedKeys,
    customTreeData,
    customTitlePrefix
}) => {
    const { setIdleSetID } = useTransferHostStore();
    const [treeData, setTreeData] = useState<TreeData[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [createType, setCreateType] = useState<TopoTreeNodeType>(TopoTreeNodeType.Set);

    useEffect(() => {
        // TODO: get real data from service
        const idleSetID = idleCluster2.bk_set_id;
        setIdleSetID(idleSetID);
        const baseTree = customTreeData || buildTreeData(businessData2, idleCluster2, searchValue);
        const filtered = filterTree(baseTree, searchValue || '');
        setTreeData(filtered);
        if (onSearchDataChange) {
            onSearchDataChange(filtered);
        }

        if (controlledExpandedKeys && controlledExpandedKeys.length > 0) {
            setExpandedKeys(controlledExpandedKeys);
        } else {
            if (!searchValue) {
                setExpandedKeys([filtered[0]?.key].filter(Boolean));
            } else {
                const allKeys = filtered.map(node => node.key);
                setExpandedKeys(allKeys);
            }
        }
    }, [customTreeData, searchValue, idleCluster2, controlledExpandedKeys, onSearchDataChange]);

    useEffect(() => {
        if (controlledSelectedKeys && controlledSelectedKeys.length > 0) {
            setSelectedKeys(controlledSelectedKeys);
        }
    }, [controlledSelectedKeys]);

    const isNodeSelected = (key: string) => {
        return (controlledSelectedKeys ?? selectedKeys).some(Item => Item === key);
    }

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
        const isAlreadySelected = selectedKeys.includes(key);

        if (!hasChildren) {
            // Leaf nodes: Select directly
            setSelectedKeys([key]);
            onSelectNode(node);
            return;
        }
        if (!isExpanded) {
            // Select first
            setSelectedKeys([key]);
            onSelectNode(node);
            // Expand on the next tick to ensure the DOM has rendered the selection changes
            setTimeout(() => toggleExpand(key), 0);
            return;
        } else if (isAlreadySelected) {
            toggleExpand(key);
            return;
        }

        setSelectedKeys([key]);
        onSelectNode(node);
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

        setSelectedKeys([node.key]);
        onSelectNode(node);
        setModalVisible(true);
    };

    const renderTailElement = (node: TreeData, hoveredKey: string, isSelected: boolean) => {
        if (tailEleType === TailEleType.None) {
            return null;
        }

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
        const isSelected = isNodeSelected(node.key);

        return (
            <span
                className={`title-wrapper ${isSelected ? ' selected' : ''}`}
                onMouseEnter={() => setHoveredKey(node.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={(e) => handleNodeTitleClick(e, node)}
                style={{ cursor: 'pointer' }}
            >
                <span className="left-wrapper">
                    {customTitlePrefix ? customTitlePrefix(node, isSelected) : renderTitlePrefix(isSelected, node.objName)}
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

    const { node: selectedNode, parents: parentNodes } = useMemo(() => {
        if (selectedKeys.length === 0) return { node: null, parents: [] };
        const nodeKey = String(selectedKeys[0]);
        return findNodeAndParents(treeData, nodeKey);
    }, [selectedKeys, treeData]);

    return (
        <>
            <Tree
                treeData={treeData}
                blockNode={true}
                titleRender={renderTitle}
                selectedKeys={selectedKeys}
                expandedKeys={expandedKeys}
                onSelect={(_, { node }) => handleNodeSelect(node)}
                onExpand={keys => { setExpandedKeys(keys as string[]) }}
                className="topology-tree"
            />
            {/* Modal for creating set and module*/}
            {selectedNode && (
                <CreateNodeModal
                    visible={modalVisible}
                    type={createType}
                    selectedNode={selectedNode}
                    parentNodes={parentNodes}
                    onClose={() => setModalVisible(false)}
                />
            )}
        </>
    );
};

export default TopologyTree;
