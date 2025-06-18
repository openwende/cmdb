import React, { useState, useEffect } from 'react';
import { Button, Tree } from 'antd';
import { businessData2, idleCluster2 } from '@/mock/business';
import CreateModal from '../CreateModal';
import { TailEleType, TopoTreeNodeType, TreeData } from '@/pages/Business/Types';
import './style.css';

interface Props {
    selectedNodes: TreeData[];
    onSelectNode: (node: TreeData) => void;
    tailEleType?: TailEleType;
    searchValue?: string;
    onSearchDataChange?: (data: TreeData[]) => void;
    onlyLeafSelectable?: boolean;
    selectedKeys?: string[];
    expandedKeys?: string[];
    onExpand?: (keys: string[]) => void;
    customTreeData?: TreeData[];
    customTitlePrefix?: (node: TreeData, isSelected: boolean) => React.ReactNode;
}

interface RawNodeData {
    bk_inst_name?: string;
    bk_set_name?: string;
    bk_module_name?: string;
    bk_obj_id?: string;
    bk_inst_id?: number;
    bk_set_id?: number;
    bk_module_id?: number;
    bk_obj_name?: string;
    child?: RawNodeData[];
    module?: RawNodeData[];
}

function buildTreeData(searchValue?: string): TreeData[] {
    const nodeMatches = (node: RawNodeData, searchTerm: string): boolean => {
        return (node.bk_inst_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (node.bk_set_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (node.bk_module_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    };

    const buildAllChildren = (children: RawNodeData[], bizId: number): TreeData[] => {
        return children.map((child) => ({
            title: child.bk_inst_name || '',
            key: `${child.bk_obj_id}-${child.bk_inst_id}`,
            type: getNodeType(child.bk_obj_id),
            objName: child.bk_obj_name,
            children: child.child && child.child.length > 0
                ? buildAllChildren(child.child, bizId)
                : undefined
        }));
    };

    const hasMatchingDescendant = (node: RawNodeData, searchTerm: string): boolean => {
        if (nodeMatches(node, searchTerm)) return true;
        if (node.child && node.child.length > 0) {
            return node.child.some((child) => hasMatchingDescendant(child, searchTerm));
        }
        return false;
    };

    const filterTreeWithHierarchy = (nodes: RawNodeData[], searchTerm: string, bizId: number): TreeData[] => {
        return nodes.map((node) => {
            const nodeMatch = nodeMatches(node, searchTerm);
            const hasMatchingChild = node.child && node.child.length > 0 &&
                node.child.some((child) => hasMatchingDescendant(child, searchTerm));

            if (nodeMatch || hasMatchingChild) {
                return {
                    title: node.bk_inst_name || '',
                    key: `${node.bk_obj_id}-${node.bk_inst_id}`,
                    type: getNodeType(node.bk_obj_id),
                    objName: node.bk_obj_name,
                    children: nodeMatch
                        ? buildAllChildren(node.child || [], bizId)
                        : filterTreeWithHierarchy(node.child || [], searchTerm, bizId)
                };
            }
            return null;
        }).filter(Boolean) as TreeData[];
    };

    if (searchValue && searchValue.trim()) {
        const searchTerm = searchValue.trim();
        const results: TreeData[] = [];

        businessData2.forEach((biz: RawNodeData) => {
            const bizChildren: TreeData[] = [];
            const bizMatches = nodeMatches(biz, searchTerm);

            const idleMatches = nodeMatches(idleCluster2, searchTerm);
            const idleHasMatchingModules = idleCluster2.module ? idleCluster2.module.some((mod: RawNodeData) => nodeMatches(mod, searchTerm)) : false;

            if (idleMatches || idleHasMatchingModules) {
                const idleModules = idleMatches
                    ? (idleCluster2.module || []).map(mod => ({
                        title: mod.bk_module_name || '',
                        key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
                        type: TopoTreeNodeType.Idle
                    }))
                    : (idleCluster2.module || [])
                        .filter(mod => nodeMatches(mod, searchTerm))
                        .map(mod => ({
                            title: mod.bk_module_name || '',
                            key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
                            type: TopoTreeNodeType.Idle
                        }));

                bizChildren.push({
                    title: idleCluster2.bk_set_name || '',
                    key: `${TopoTreeNodeType.Set}-${idleCluster2.bk_set_id}`,
                    type: TopoTreeNodeType.Idle,
                    children: idleModules
                });
            }

            if (biz.child && biz.child.length > 0) {
                if (bizMatches) {
                    bizChildren.push(...buildAllChildren(biz.child, biz.bk_inst_id!));
                } else {
                    const filteredChildren = filterTreeWithHierarchy(biz.child, searchTerm, biz.bk_inst_id!);
                    bizChildren.push(...filteredChildren);
                }
            }

            const hasRegularMatches = biz.child && biz.child.length > 0 &&
                biz.child.some((child: RawNodeData) => hasMatchingDescendant(child, searchTerm));

            if (bizMatches || idleMatches || idleHasMatchingModules || hasRegularMatches) {
                if (bizMatches && !idleMatches && !idleHasMatchingModules) {
                    bizChildren.unshift({
                        title: idleCluster2.bk_set_name || '',
                        key: `${TopoTreeNodeType.Set}-${idleCluster2.bk_set_id}`,
                        type: TopoTreeNodeType.Idle,
                        children: (idleCluster2.module || []).map(mod => ({
                            title: mod.bk_module_name || '',
                            key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
                            type: TopoTreeNodeType.Idle
                        }))
                    });
                }

                results.push({
                    title: biz.bk_inst_name || '',
                    key: `${biz.bk_obj_id}-${biz.bk_inst_id}`,
                    type: getNodeType(biz.bk_obj_id),
                    objName: biz.bk_obj_name,
                    children: bizChildren
                });
            }
        });

        return results;
    }

    return businessData2.map((biz: RawNodeData) => ({
        title: biz.bk_inst_name || '',
        key: `${biz.bk_obj_id}-${biz.bk_inst_id}`,
        type: getNodeType(biz.bk_obj_id),
        objName: biz.bk_obj_name,
        children: [
            {
                title: idleCluster2.bk_set_name || '',
                key: `${TopoTreeNodeType.Set}-${idleCluster2.bk_set_id}`,
                type: TopoTreeNodeType.Idle,
                children: (idleCluster2.module || []).map(mod => ({
                    title: mod.bk_module_name || '',
                    key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
                    type: TopoTreeNodeType.Idle,
                })),
            },
            ...buildChildrenFromData(biz.child || [], biz.bk_inst_id!)
        ]
    }));
}

function buildChildrenFromData(children: RawNodeData[], bizId: number): TreeData[] {
    return children.map(child => ({
        title: child.bk_inst_name || '',
        key: `${child.bk_obj_id}-${child.bk_inst_id}`,
        type: getNodeType(child.bk_obj_id),
        objName: child.bk_obj_name,
        children: child.child && child.child.length > 0
            ? buildChildrenFromData(child.child, bizId)
            : undefined
    }));
}

function getNodeType(bkObjId?: string): TopoTreeNodeType {
    let nodeType: TopoTreeNodeType | null = null;
    switch (bkObjId) {
        case 'biz':
            nodeType = TopoTreeNodeType.Biz;
            break;
        case 'set':
            nodeType = TopoTreeNodeType.Set;
            break;
        case 'module':
            nodeType = TopoTreeNodeType.Module;
            break;
        default:
            nodeType = TopoTreeNodeType.Idle;
    }
    return nodeType;
}

function filterTree(tree: TreeData[], keyword: string): TreeData[] {
    if (!keyword) return tree;
    return tree.map(node => {
        const titleStr = String(node.title ?? '');
        if (titleStr.includes(keyword)) {
            return { ...node };
        }
        if (node.children) {
            const filteredChildren = filterTree(node.children, keyword);
            if (filteredChildren.length > 0) {
                return { ...node, children: filteredChildren };
            }
        }
        return null;
    }).filter(Boolean) as TreeData[];
}

const TopologyTree: React.FC<Props> = ({
    selectedNodes,
    onSelectNode,
    tailEleType = TailEleType.All,
    searchValue,
    onSearchDataChange,
    onlyLeafSelectable = false,
    selectedKeys: controlledSelectedKeys,
    expandedKeys: controlledExpandedKeys,
    onExpand,
    customTreeData,
    customTitlePrefix
}) => {
    const [treeData, setTreeData] = useState<TreeData[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [createType, setCreateType] = useState<TopoTreeNodeType>(TopoTreeNodeType.Set);

    useEffect(() => {
        const baseTree = customTreeData || buildTreeData();
        const filtered = filterTree(baseTree, searchValue || '');
        setTreeData(filtered);
        if (onSearchDataChange) {
            onSearchDataChange(filtered);
        }
        if (!searchValue) {
            setExpandedKeys([filtered[0]?.key].filter(Boolean));
        } else {
            const allKeys = filtered.map(node => node.key);
            setExpandedKeys(allKeys);
        }
    }, [customTreeData, searchValue, onSearchDataChange]);

    useEffect(() => {
        if (controlledSelectedKeys && controlledSelectedKeys.length > 0) {
          setSelectedKeys(controlledSelectedKeys);
        }
      }, [controlledSelectedKeys]);

    const isNodeSelected = (key: string) => {
        return (controlledSelectedKeys ?? selectedKeys).some(Item => Item === key);
    }

    const handleSelect = (keys: React.Key[], node: TreeData) => {
        if (keys.length) {
            if (onlyLeafSelectable && node.children && node.children.length > 0) {
                return;
            }
            setSelectedKeys(keys);
            onSelectNode(node);
        }
    };

    const handleCreate = (e: React.MouseEvent<HTMLElement, MouseEvent>, node: TreeData) => {
        e.stopPropagation();
        if (node.type === TopoTreeNodeType.Biz) {
            setCreateType(TopoTreeNodeType.Set);
        } else if (node.type === TopoTreeNodeType.Set) {
            setCreateType(TopoTreeNodeType.Module);
        }
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

    const handleNodeTitleClick = (node: TreeData) => {
        const key = node.key;
        const isSelected = isNodeSelected(key);
        const isParent = node.children && node.children.length > 0;
        if (!isParent) {
            // Child nodes are selectable only
            setSelectedKeys([key]);
            onSelectNode(node);
            return;
        }
        if (onlyLeafSelectable) {
            // Parent nodes are not selectable but can be expanded or collapsed
            const currentExpanded = controlledExpandedKeys || expandedKeys;
            const idx = currentExpanded.indexOf(key);
            let newExpanded;
            if (idx > -1) {
                newExpanded = currentExpanded.filter(k => k !== key);
            } else {
                newExpanded = [...currentExpanded, key];
            }
            if (onExpand) onExpand(newExpanded);
            if (!controlledExpandedKeys) setExpandedKeys(newExpanded);
            return;
        }
        if (!isSelected) {
            setSelectedKeys([key]);
            onSelectNode(node);
        } else {
            // Toggle expand/collapse when the node is already selected
            const currentExpanded = controlledExpandedKeys || expandedKeys;
            const idx = currentExpanded.indexOf(key);
            let newExpanded;
            if (idx > -1) {
                newExpanded = currentExpanded.filter(k => k !== key);
            } else {
                newExpanded = [...currentExpanded, key];
            }
            if (onExpand) onExpand(newExpanded);
            if (!controlledExpandedKeys) setExpandedKeys(newExpanded);
        }
    };

    const renderTitle = (node: TreeData) => {
        const isSelected = isNodeSelected(node.key);
        const isParent = node.children && node.children.length > 0;

        return (
            <span
                className={`title-wrapper ${isSelected ? ' selected' : ''}`}
                onMouseEnter={() => setHoveredKey(node.key)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={isParent ? (e) => { e.stopPropagation(); handleNodeTitleClick(node); } : undefined}
                style={isParent ? { cursor: 'pointer' } : undefined}
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

    return (
        <>
            <Tree
                treeData={treeData}
                blockNode={true}
                titleRender={renderTitle}
                selectedKeys={controlledSelectedKeys ?? selectedKeys}
                onSelect={(selectedKeys, { node }) => handleSelect(selectedKeys, node)}
                expandedKeys={controlledExpandedKeys || expandedKeys}
                onExpand={keys => {
                    if (onExpand) onExpand(keys as string[]);
                    if (!controlledExpandedKeys) setExpandedKeys(keys as string[]);
                }}
                className="topology-tree"
            />
            {/* Modal for creating set and module*/}
            <CreateModal
                visible={modalVisible}
                type={createType}
                selectedNode={selectedNodes[0]}
                onClose={() => setModalVisible(false)}
            />
        </>
    );
};

export default TopologyTree;
