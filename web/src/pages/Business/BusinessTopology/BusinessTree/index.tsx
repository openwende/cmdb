import React, { Fragment, useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import TopologyTree from "../components/TopologyTree";
import EmptySearchResult from "@/components/common/EmptySearchResult";
import DragHandle from "@/components/common/DragHandle";
import { TreeData } from "../../Types";
import { buildTreeData, filterTree, findNodeAndParents } from "../../utils";
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
    const [hasSearchResults, setHasSearchResults] = useState<boolean>(true);
    const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    // The sidebar state
    const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_WIDTH);
    // The collapsed state
    const [collapsed, setCollapsed] = useState<boolean>(false);

    // Build complete tree data
    const fullTreeData = useMemo(() => {
        return buildTreeData(businessData2, idleCluster2);
    }, []);

    // Filter tree data based on search value
    const filteredTreeData = useMemo(() => {
        if (!searchValue || !searchValue.trim()) {
            return fullTreeData;
        }
        return filterTree(fullTreeData, searchValue);
    }, [fullTreeData, searchValue]);

    useEffect(() => {
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
    }, [initialSelectedKey]);

    // Handle node selection from TopologyTree
    const handleNodeSelect = (selectedNode: TreeData, parentNodes: TreeData[]) => {
        setSelectedKeys([selectedNode.key]);
        onNodeSelect(selectedNode, parentNodes);
    };

    // Update search results status and notify parent
    useMemo(() => {
        const hasResults = filteredTreeData.length > 0;
        setHasSearchResults(hasResults);
    }, [filteredTreeData]);

    // Handle clear search
    const handleClearSearch = () => {
        setSearchValue('');
    };

    return (
        <div className="tree-wrapper"
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
                            onChange={e => setSearchValue(e.target.value)}
                        />
                    </div>
                    {!hasSearchResults && searchValue ? (
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