import React, { useState, useEffect } from 'react';
import { Button, Tree } from 'antd';
import { businessData2, idleCluster2 } from '@/mock/business';
import CreateModal from '../CreateModal';
import { TailEleType, TopoTreeNodeType, TreeData } from '@/pages/Business/Types';
import './style.css';

interface Props {
    selectedNode: TreeData | null;
    onSelectNode: (node: TreeData) => void;
    tailEleType?: TailEleType;
    searchValue?: string;
    onSearchDataChange?: (data: TreeData[]) => void;
}

function buildTreeData(searchValue?: string): TreeData[] {
    // Helper function to check if a node matches the search term
    const nodeMatches = (node: any, searchTerm: string): boolean => {
        return node.bk_inst_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            node.bk_set_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            node.bk_module_name?.toLowerCase().includes(searchTerm.toLowerCase());
    };

    // Helper function to build all children (when parent matches or we need full subtree)
    const buildAllChildren = (children: any[], bizId: number): TreeData[] => {
        return children.map(child => ({
            title: child.bk_inst_name,
            key: `${child.bk_obj_id}-${child.bk_inst_id}`,
            type: getNodeType(child.bk_obj_id),
            objName: child.bk_obj_name,
            children: child.child && child.child.length > 0
                ? buildAllChildren(child.child, bizId)
                : undefined
        }));
    };

    // Helper function to check if node or any descendant matches
    const hasMatchingDescendant = (node: any, searchTerm: string): boolean => {
        if (nodeMatches(node, searchTerm)) return true;
        if (node.child && node.child.length > 0) {
            return node.child.some((child: any) => hasMatchingDescendant(child, searchTerm));
        }
        return false;
    };

    // Helper function to filter tree while maintaining hierarchy
    const filterTreeWithHierarchy = (nodes: any[], searchTerm: string, bizId: number): TreeData[] => {
        return nodes.map(node => {
            const nodeMatch = nodeMatches(node, searchTerm);
            const hasMatchingChild = node.child && node.child.length > 0 &&
                node.child.some((child: any) => hasMatchingDescendant(child, searchTerm));

            if (nodeMatch || hasMatchingChild) {
                return {
                    title: node.bk_inst_name,
                    key: `${node.bk_obj_id}-${node.bk_inst_id}`,
                    type: getNodeType(node.bk_obj_id),
                    objName: node.bk_obj_name,
                    children: nodeMatch
                        ? buildAllChildren(node.child || [], bizId) // If node matches, include all children
                        : filterTreeWithHierarchy(node.child || [], searchTerm, bizId) // Otherwise filter children
                };
            }
            return null;
        }).filter(Boolean) as TreeData[];
    };

    // If searching, return filtered tree structure
    if (searchValue && searchValue.trim()) {
        const searchTerm = searchValue.trim();
        const results: TreeData[] = [];

        // Process each business
        businessData2.forEach(biz => {
            const bizChildren: TreeData[] = [];
            const bizMatches = nodeMatches(biz, searchTerm);

            // Check idle cluster and its modules
            const idleMatches = nodeMatches(idleCluster2, searchTerm);
            const idleHasMatchingModules = idleCluster2.module.some(mod => nodeMatches(mod, searchTerm));

            if (idleMatches || idleHasMatchingModules) {
                const idleModules = idleMatches
                    ? idleCluster2.module.map(mod => ({ // If idle cluster matches, include all modules
                        title: mod.bk_module_name,
                        key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
                        type: TopoTreeNodeType.Idle
                    }))
                    : idleCluster2.module // Otherwise only include matching modules
                        .filter(mod => nodeMatches(mod, searchTerm))
                        .map(mod => ({
                            title: mod.bk_module_name,
                            key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
                            type: TopoTreeNodeType.Idle
                        }));

                bizChildren.push({
                    title: idleCluster2.bk_set_name,
                    key: `${TopoTreeNodeType.Set}-${idleCluster2.bk_set_id}`,
                    type: TopoTreeNodeType.Idle,
                    children: idleModules
                });
            }

            // Process regular children
            if (biz.child && biz.child.length > 0) {
                if (bizMatches) {
                    // If business matches, include ALL children
                    bizChildren.push(...buildAllChildren(biz.child, biz.bk_inst_id));
                } else {
                    // If business doesn't match, filter children but maintain hierarchy
                    const filteredChildren = filterTreeWithHierarchy(biz.child, searchTerm, biz.bk_inst_id);
                    bizChildren.push(...filteredChildren);
                }
            }

            // If business matches or has matching children, include it
            const hasRegularMatches = biz.child && biz.child.length > 0 &&
                biz.child.some((child: any) => hasMatchingDescendant(child, searchTerm));

            if (bizMatches || idleMatches || idleHasMatchingModules || hasRegularMatches) {
                // If business matches, also include idle cluster with all modules (if not already added)
                if (bizMatches && !idleMatches && !idleHasMatchingModules) {
                    bizChildren.unshift({ // Add to beginning
                        title: idleCluster2.bk_set_name,
                        key: `${TopoTreeNodeType.Set}-${idleCluster2.bk_set_id}`,
                        type: TopoTreeNodeType.Idle,
                        children: idleCluster2.module.map(mod => ({
                            title: mod.bk_module_name,
                            key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
                            type: TopoTreeNodeType.Idle
                        }))
                    });
                }

                results.push({
                    title: biz.bk_inst_name,
                    key: `${biz.bk_obj_id}-${biz.bk_inst_id}`,
                    type: getNodeType(biz.bk_obj_id),
                    objName: biz.bk_obj_name,
                    children: bizChildren
                });
            }
        });

        return results;
    }

    // Normal tree structure when not searching
    return businessData2.map(biz => ({
        title: biz.bk_inst_name,
        key: `${biz.bk_obj_id}-${biz.bk_inst_id}`,
        type: getNodeType(biz.bk_obj_id),
        objName: biz.bk_obj_name,
        children: [
            {
                title: idleCluster2.bk_set_name,
                key: `${TopoTreeNodeType.Set}-${idleCluster2.bk_set_id}`,
                type: TopoTreeNodeType.Idle,
                children: idleCluster2.module.map(mod => ({
                    title: mod.bk_module_name,
                    key: `${TopoTreeNodeType.Module}-${mod.bk_module_id}`,
                    type: TopoTreeNodeType.Idle,
                })),
            },
            ...buildChildrenFromData(biz.child || [], biz.bk_inst_id)
        ]
    }));
}

function buildChildrenFromData(children: any[], bizId: number): TreeData[] {
    return children.map(child => ({
        title: child.bk_inst_name,
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

const TopologyTree: React.FC<Props> = ({
    selectedNode,
    onSelectNode,
    tailEleType = TailEleType.All,
    searchValue,
    onSearchDataChange
}) => {
    const [treeData, setTreeData] = useState<TreeData[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [selectedKey, setSelectedKey] = useState<string>();
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    // State for creating set and module
    const [modalVisible, setModalVisible] = useState(false);
    const [createType, setCreateType] = useState<TopoTreeNodeType>(TopoTreeNodeType.Set);

    useEffect(() => {
        const newIsSearching = !!(searchValue && searchValue.trim());

        const newTreeData = buildTreeData(searchValue);
        setTreeData(newTreeData);

        // Notify parent about search data changes
        if (onSearchDataChange) {
            onSearchDataChange(newTreeData);
        }

        if (!newIsSearching) {
            // Normal tree mode - set default expansion
            setExpandedKeys([newTreeData[0]?.key].filter(Boolean));
        } else {
            // Search mode - expand all results for better visibility
            const allKeys = newTreeData.map(node => node.key);
            setExpandedKeys(allKeys);
        }
    }, [searchValue]);

    const handleSelect = (keys: React.Key[], node: TreeData) => {
        if (keys.length) {
            setSelectedKey(keys[0] as string);
            onSelectNode(node);
        }
    };

    const handleCreate = (node: TreeData) => {
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
                <span className={`suffix-count ${isSelected ? 'selected' : ''}`}>0</span>
            </span>
        }

        if (tailEleType === TailEleType.All) {
            const isHovered = hoveredKey === node.key;
            return (
                <span className="right-wrapper">
                    {isHovered && node.type !== TopoTreeNodeType.Idle && node.type !== TopoTreeNodeType.Module
                        ? <Button type="primary" size="small" onClick={() => handleCreate(node)}>新建</Button>
                        : <span className={`suffix-count ${isSelected ? 'selected' : ''}`}>0</span>
                    }
                </span>
            );
        }

        return null;
    };

    const renderTitle = (node: TreeData) => {
        const isSelected = selectedKey === node.key;

        // Normal tree display (same for both search and normal mode)
        return (
            <span
                className="title-wrapper"
                onMouseEnter={() => setHoveredKey(node.key)}
                onMouseLeave={() => setHoveredKey(null)}
            >
                <span className="left-wrapper">
                    {renderNodeTypePrefix(isSelected, node.objName)}
                    {node.title}
                </span>
                {renderTailElement(node, hoveredKey!, isSelected)}
            </span>
        );
    };

    const renderNodeTypePrefix = (isSelected: boolean, objName?: string) => {
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
                selectedKeys={selectedKey ? [selectedKey] : []}
                onSelect={(selectedKeys, { node }) => handleSelect(selectedKeys, node)}
                expandedKeys={expandedKeys}
                onExpand={keys => setExpandedKeys(keys as string[])}
                className="topology-tree"
            />
            {/* Modal for creating set and module*/}
            <CreateModal
                visible={modalVisible}
                type={createType}
                selectedNode={selectedNode}
                onClose={() => setModalVisible(false)}
            />
        </>
    );
};

export default TopologyTree;
