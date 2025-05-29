import React, { useState, useEffect } from 'react';
import { Button, Tree } from 'antd';
import { businessData, idleCluster } from '@/mock/business';
import HostSvg from '@/assets/icons/host.svg';
import FaultHostSvg from '@/assets/icons/faultHost.svg';
import CreateModal from '../CreateModal';
import { CreateType, TailEleType } from '@/pages/Business/Types';

interface Props {
    selectedKey?: string | null;
    onSelect?: (key: string | null, node?: any) => void;
    tailEleType?: TailEleType;
}

interface TreeData {
    title: React.ReactNode;
    key: string;
    type: string;
    children?: TreeData[];
    icon?: React.ReactNode;
}

function buildTreeData() {
    return businessData.map(biz => ({
        title: biz.name,
        key: `business-${biz.id}`,
        type: 'business',
        children: [
            {
                title: idleCluster.name,
                key: `cluster-${idleCluster.id}-${biz.id}`,
                type: 'idle',
                icon: <HostSvg />,
                children: idleCluster.modules.map(mod => ({
                    title: mod.name,
                    key: `module-${mod.id}-${idleCluster.id}-${biz.id}`,
                    type: 'idle',
                    icon: mod.id === 'fault' ? <FaultHostSvg /> : <HostSvg />
                })),
            },
            ...biz.clusters.map(cluster => ({
                title: cluster.name,
                key: `cluster-${cluster.id}-${biz.id}`,
                type: 'cluster',
                children: cluster.modules.map(mod => ({
                    title: mod.name,
                    key: `module-${mod.id}-${cluster.id}-${biz.id}`,
                    type: 'module',
                }))
            }))
        ]
    }));
}

const TopologyTree: React.FC<Props> = ({
    selectedKey,
    onSelect,
    tailEleType = TailEleType.All,
}) => {
    const [treeData, setTreeData] = useState<TreeData[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
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
        const treeData = buildTreeData();
        setTreeData(treeData);
        if (!selectedKey && onSelect) {
            onSelect(treeData[0].key);
        }
        setExpandedKeys([treeData[0].key]);
    }, [businessData]);


    const handleSelect = (keys: React.Key[], info: any) => {
        if (keys.length && onSelect) {
            onSelect(keys[0] as string, info.node);
        }
    };

    const renderTailElement = (node: TreeData, hoveredKey: string, isSelected: boolean) => {
        if (tailEleType === TailEleType.All) {
            return (
                <span className="right-wrapper">
                    {hoveredKey === node.key && node.type !== 'idle' && node.type !== 'module'
                        ? <Button type="primary" size="small" onClick={() => handleCreate(node)}>新建</Button>
                        : <span className={`suffix-count ${isSelected ? 'selected' : ''}`}>0</span>
                    }
                </span>
            );
        } else if (tailEleType === TailEleType.Count) {
            return (
                <span className="right-wrapper">
                    <span className={`suffix-count ${isSelected ? 'selected' : ''}`}>0</span>
                </span>
            );
        }
        return null;
    }

    const renderTitle = (node: TreeData) => {
        const isSelected = selectedKey === node.key;
        return (
            <span
                className="title-wrapper"
                onMouseEnter={() => setHoveredKey(node.key)}
                onMouseLeave={() => setHoveredKey(null)}
            >
                <span className="left-wrapper">
                    {
                        node.type === 'business' && (
                            <span className={`title-prefix ${isSelected ? 'selected' : ''}`}>业</span>
                        )}
                    {
                        node.type === 'cluster' && (
                            <span className={`title-prefix ${isSelected ? 'selected' : ''}`}>集</span>
                        )}
                    {
                        node.type === 'module' && (
                            <span className={`title-prefix ${isSelected ? 'selected' : ''}`}>模</span>
                        )}
                    {node.title}
                </span>
                {renderTailElement(node, hoveredKey!, isSelected)}
            </span>
        )
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
                className="ant-tree"
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
