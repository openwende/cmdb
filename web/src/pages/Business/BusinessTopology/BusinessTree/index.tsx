import React, { Fragment, useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import TopologyTree from "../components/TopologyTree";
import EmptySearchResult from "@/components/common/EmptySearchResult";
import DragHandle from "@/components/common/DragHandle";
import { TreeData } from "../../Types";
import { buildTreeData, filterTree, findNodeAndParents, collectAllKeys } from "../../utils";
import { businessData2, idleCluster2 } from "@/mock/business";
import "./style.css";

const MIN_WIDTH = 210;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 320;

interface Props {
    selectedNode: TreeData | null;
    initialSelectedKey?: string | null;
    onNodeSelect: (selectedNode: TreeData, parentNodes: TreeData[]) => void;
}

const BusinessTree: React.FC<Props> = ({ selectedNode, initialSelectedKey, onNodeSelect }) => {
    const { t } = useTranslation();
    const [searchValue, setSearchValue] = useState<string>("");
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    // The sidebar state
    const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_WIDTH);
    // The collapsed state
    const [collapsed, setCollapsed] = useState<boolean>(false);

    const fullTreeData = useMemo(() => {
        // Build complete tree data
        return buildTreeData(businessData2, idleCluster2);
    }, []);

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
                const parentKeys = parents.map(p => p.key);
                setSelectedKeys([initialSelectedKey]);
                setExpandedKeys([...parentKeys, initialSelectedKey]);
                onNodeSelect(node, parents);
            }
        } else if (!selectedNode) {
            // Select first node if no specific node is provided
            const firstNode = fullTreeData[0];
            setSelectedKeys([firstNode.key]);
            setExpandedKeys([firstNode.key]);
            onNodeSelect(firstNode, []);
        }
    }, [initialSelectedKey, searchExpandedKeys]);

    const handleNodeSelect = (selectedNode: TreeData, parentNodes: TreeData[]) => {
        setSelectedKeys([selectedNode.key]);
        onNodeSelect(selectedNode, parentNodes);
    };

    const handleClearSearch = () => {
        setSearchValue('');
    };

    const isEmptySearchResult = filteredTreeData.length === 0 && searchValue;

    return (
        <div className="business-tree-wrapper"
            style={{
                width: collapsed ? 0 : sidebarWidth,
                minWidth: collapsed ? 0 : MIN_WIDTH,
                maxWidth: collapsed ? 0 : MAX_WIDTH,
                marginLeft: collapsed ? 0 : 20
            }}
        >
            {/* The search input and tree*/}
            {!collapsed && (
                <Fragment>
                    <div className="search-wrapper">
                        <Input.Search
                            placeholder={t("business.topology.tree.search")}
                            allowClear
                            value={searchValue}
                            onChange={e => setSearchValue(e.target.value.trim())}
                            onClear={() => setSearchValue('')}
                        />
                    </div>
                    {isEmptySearchResult ? (
                        <EmptySearchResult onClearFilter={handleClearSearch} />
                    ) : (
                        <TopologyTree
                            treeData={filteredTreeData}
                            selectedKeys={selectedKeys}
                            expandedKeys={expandedKeys}
                            searchValue={searchValue}
                            onNodeSelect={handleNodeSelect}
                        />
                    )}
                    {/* The dragger */}
                    <DragHandle
                        minWidth={MIN_WIDTH}
                        maxWidth={MAX_WIDTH}
                        currentWidth={sidebarWidth}
                        onWidthChange={setSidebarWidth}
                    />
                </Fragment>
            )}
            {/* The collapsed button */}
            <div
                className="collapsed-button"
                style={{
                    position: "absolute",
                    right: -15,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 16,
                    height: 100
                }}
                onClick={() => setCollapsed(c => !c)}
            >
                {collapsed ? <RightOutlined /> : <LeftOutlined />}
            </div>
        </div>
    );
};

export default BusinessTree;