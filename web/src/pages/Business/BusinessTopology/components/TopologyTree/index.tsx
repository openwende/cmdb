import React, { useState, useEffect } from 'react';
import { Button, Tree } from 'antd';
import { businessData2, idleCluster2 } from '@/mock/business';
import CreateModal from '../CreateModal';
import { TailEleType, TopoTreeNodeType, TreeData } from '@/pages/Business/Types';
import './style.css';
import { useTransferHostStore } from '@/store/TransferHostStore';
import { buildTreeData, filterTree } from '@/pages/Business/utils';

interface Props {
    selectedNodes?: TreeData[];
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
    selectedNodes,
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
            // 弹框场景：仅叶子可选，点击父节点只切换展开
            toggleExpand(key);
            return;
        }

        const isExpanded = expandedKeys.includes(key);
        const isAlreadySelected = selectedKeys.includes(key);

        if (!hasChildren) {
            // 叶子节点：直接选中
            setSelectedKeys([key]);
            onSelectNode(node);
            return;
        }

        // 业务场景：带子节点的点击规则
        if (!isExpanded) {
            // 先选中
            setSelectedKeys([key]);
            onSelectNode(node);

            // 下一 tick 再展开，保证 DOM 已根据选中渲染完成
            setTimeout(() => toggleExpand(key), 0);
            return;              // 避免重复 setState
        } else if (isAlreadySelected) {
            // 当前已展开且已选中 → 折叠后返回
            toggleExpand(key);
            // 折叠后不需要额外设置选中，保持原状态
            return;
        }

        // 最后设置选中（确保展开状态已更新）
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

        // 直接委托给 handleNodeSelect，内部已包含完整逻辑
        handleNodeSelect(node);
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

    return (
        <>
            <Tree
                treeData={treeData}
                blockNode={true}
                titleRender={renderTitle}
                selectedKeys={selectedKeys}
                expandedKeys={expandedKeys}
                onSelect={(_, { node }) => handleNodeSelect(node)}
                onExpand={keys => {setExpandedKeys(keys as string[])}}
                className="topology-tree"
            />
            {/* Modal for creating set and module*/}
            {selectedNodes && selectedNodes.length > 0 && (
                <CreateModal
                    visible={modalVisible}
                    type={createType}
                    selectedNode={selectedNodes[0]}
                    onClose={() => setModalVisible(false)}
                />
            )}
        </>
    );
};

export default TopologyTree;
