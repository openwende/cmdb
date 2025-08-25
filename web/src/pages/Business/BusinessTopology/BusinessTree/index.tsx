import React, { Fragment, useState } from "react";
import { Input } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import TopologyTree from "../components/TopologyTree";
import EmptySearchResult from "@/components/common/EmptySearchResult";
import DragHandle from "@/components/common/DragHandle";
import "./style.css";
import { useTranslation } from "react-i18next";
import { TreeData } from "../../Types";

const MIN_WIDTH = 210;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 320;

interface Props {
    selectedKeys?: string[];
    expandedKeys?: string[];
    onSelectNode: (node: TreeData) => void;
    onSearchDataChange?: (data: TreeData[]) => void;
}

const BusinessTree: React.FC<Props> = ({ selectedKeys, expandedKeys, onSelectNode, onSearchDataChange }) => {
    const { t } = useTranslation();
    const [searchValue, setSearchValue] = useState<string>("");
    const [hasSearchResults, setHasSearchResults] = useState<boolean>(true);
    // The sidebar state
    const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_WIDTH);
    // The collapsed state
    const [collapsed, setCollapsed] = useState<boolean>(false);

    // Handle search data changes from TopologyTree
    const handleSearchDataChange = (data: any[]) => {
        setHasSearchResults(data.length > 0);
    };

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
                            onSelectNode={onSelectNode}
                            searchValue={searchValue}
                            onSearchDataChange={onSearchDataChange}
                            selectedKeys={selectedKeys}
                            expandedKeys={expandedKeys}
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