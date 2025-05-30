import React, { useState, useEffect } from 'react';
import { Button, Tree } from 'antd';
import { businessData2, idleCluster2 } from '@/mock/business';
import CreateModal from '../CreateModal';
import { CreateType, TailEleType } from '@/pages/Business/Types';
import { WalletOutlined } from '@ant-design/icons';
import './style.css';

interface Props {
    selectedKey?: string | null;
    onSelect?: (key: string | null, node?: any) => void;
    tailEleType?: TailEleType;
    searchValue?: string;
    onSearchResult?: (hasResults: boolean) => void;
    onClearSearch?: () => void;
}

interface TreeData {
    title: React.ReactNode;
    key: string;
    type: string;
    children?: TreeData[];
    icon?: React.ReactNode;
    bk_obj_id?: string;
    bk_inst_name?: string;
    searchPath?: string;
}

function buildTreeData(searchValue?: string): TreeData[] {
    const flattenAndFilter = (nodes: any[], searchValue: string): any[] => {
        let result: any[] = [];

        const traverse = (node: any, path: string[] = []) => {
            const currentPath = [...path, node.bk_inst_name];
            const fullPath = currentPath.join(' / ');

            // Check if current node matches search
            if (node.bk_inst_name?.toLowerCase().includes(searchValue.toLowerCase())) {
                result.push({
                    ...node,
                    searchPath: fullPath
                });
            }

            // Recursively check children
            if (node.child && node.child.length > 0) {
                node.child.forEach((child: any) => traverse(child, currentPath));
            }
        };

        nodes.forEach(node => traverse(node));
        return result;
    };

    // If searching, return flattened filtered results
    if (searchValue && searchValue.trim()) {
        const filtered = flattenAndFilter(businessData2, searchValue.trim());
        return filtered.map((node: any) => ({
            title: node.bk_inst_name,
            key: `${node.bk_obj_id}-${node.bk_inst_id}`,
            type: getNodeType(node.bk_obj_id),
            bk_obj_id: node.bk_obj_id,
            bk_inst_name: node.bk_inst_name,
            searchPath: node.searchPath
        }));
    }

    // Normal tree structure when not searching
    return businessData2.map(biz => ({
        title: biz.bk_inst_name,
        key: `${biz.bk_obj_id}-${biz.bk_inst_id}`,
        type: getNodeType(biz.bk_obj_id),
        bk_obj_id: biz.bk_obj_id,
        bk_inst_name: biz.bk_inst_name,
        children: [
            {
                title: idleCluster2.bk_set_name,
                key: `idle-${idleCluster2.bk_set_id}-${biz.bk_inst_id}`,
                type: 'idle',
                children: idleCluster2.module.map(mod => ({
                    title: mod.bk_module_name,
                    key: `idle-module-${mod.bk_module_id}-${idleCluster2.bk_set_id}-${biz.bk_inst_id}`,
                    type: 'idle',
                })),
            },
            ...buildChildrenFromData(biz.child || [], biz.bk_inst_id)
        ]
    }));
}

function buildChildrenFromData(children: any[], bizId: number): TreeData[] {
    return children.map(child => ({
        title: child.bk_inst_name,
        key: `${child.bk_obj_id}-${child.bk_inst_id}-${bizId}`,
        type: getNodeType(child.bk_obj_id),
        bk_obj_id: child.bk_obj_id,
        bk_inst_name: child.bk_inst_name,
        children: child.child && child.child.length > 0
            ? buildChildrenFromData(child.child, bizId)
            : undefined
    }));
}

function getNodeType(bkObjId?: string): string {
    switch (bkObjId) {
        case 'biz':
            return 'business';
        case 'set':
            return 'cluster';
        case 'module':
            return 'module';
        default:
            return 'idle'; // For idle pool nodes that don't have bk_obj_id
    }
}

const TopologyTree: React.FC<Props> = ({
    selectedKey,
    onSelect,
    tailEleType = TailEleType.All,
    searchValue,
    onSearchResult,
}) => {
    const [treeData, setTreeData] = useState<TreeData[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    // State for creating set and module
    const [modalVisible, setModalVisible] = useState(false);
    const [createType, setCreateType] = useState<CreateType>(CreateType.Set);
    const [parentNode, setParentNode] = useState<any>();

    const handleCreate = (node: any) => {
        if (node.type === "business") {
            setCreateType(CreateType.Set);
        } else if (node.type === "cluster") {
            setCreateType(CreateType.Module);
        }
        setParentNode(node);
        setModalVisible(true);
    };

    useEffect(() => {
        const newIsSearching = !!(searchValue && searchValue.trim());
        setIsSearching(newIsSearching);

        const newTreeData = buildTreeData(searchValue);
        setTreeData(newTreeData);

        // Notify parent about search results
        if (onSearchResult) {
            onSearchResult(newTreeData.length > 0);
        }

        if (!newIsSearching) {
            // Normal tree mode - set default selection and expansion
            if (!selectedKey && onSelect && newTreeData.length > 0) {
                onSelect(newTreeData[0].key);
            }
            setExpandedKeys([newTreeData[0]?.key].filter(Boolean));
        } else {
            // Search mode - expand all results for better visibility
            const allKeys = newTreeData.map(node => node.key);
            setExpandedKeys(allKeys);
        }
    }, [searchValue, businessData2]);

    const handleSelect = (keys: React.Key[], info: any) => {
        if (keys.length && onSelect) {
            onSelect(keys[0] as string, info.node);
        }
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
                    {isHovered && node.type !== 'idle' && node.type !== 'module'
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

        // For search results, show the full path
        if (isSearching && node.searchPath) {
            return (
                <span
                    className="title-wrapper search-result"
                    onMouseEnter={() => setHoveredKey(node.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                >
                    <span className="left-wrapper">
                        {renderNodeTypePrefix(node.type, isSelected)}
                        <span className="search-path">{node.searchPath}</span>
                    </span>
                    {renderTailElement(node, hoveredKey!, isSelected)}
                </span>
            );
        }

        // Normal tree display
        return (
            <span
                className="title-wrapper"
                onMouseEnter={() => setHoveredKey(node.key)}
                onMouseLeave={() => setHoveredKey(null)}
            >
                <span className="left-wrapper">
                    {renderNodeTypePrefix(node.type, isSelected)}
                    {node.title}
                </span>
                {renderTailElement(node, hoveredKey!, isSelected)}
            </span>
        );
    };

    const renderNodeTypePrefix = (type: string, isSelected: boolean) => {
        switch (type) {
            case 'business':
                return <span className={`title-prefix ${isSelected ? 'selected' : ''}`}>业</span>;
            case 'cluster':
                return <span className={`title-prefix ${isSelected ? 'selected' : ''}`}>集</span>;
            case 'module':
                return <span className={`title-prefix ${isSelected ? 'selected' : ''}`}>模</span>;
            default:
                return <WalletOutlined className='title-icon' />;
        }
    };

    return (
        <>
            <Tree
                treeData={treeData}
                blockNode={true}
                titleRender={renderTitle}
                selectedKeys={selectedKey ? [selectedKey] : []}
                onSelect={handleSelect}
                expandedKeys={expandedKeys}
                onExpand={keys => setExpandedKeys(keys as string[])}
                className="topology-tree"
            />
            {/* Modal for creating set and module*/}
            <CreateModal
                visible={modalVisible}
                type={createType}
                parentNode={parentNode}
                onClose={() => setModalVisible(false)}
            />
        </>
    );
};

export default TopologyTree;
