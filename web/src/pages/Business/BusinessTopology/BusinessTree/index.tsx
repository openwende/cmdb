import React, { Fragment, useRef, useState } from "react";
import { Input } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import TopologyTree from "../components/TopologyTree";
import EmptySearchResult from "@/components/common/EmptySearchResult";
import "./style.css";
import { useTranslation } from "react-i18next";
import { TreeData } from "../../Types";

const MIN_WIDTH = 210;
const MAX_WIDTH = 480;

interface Props {
    selectedNodes?: TreeData[];
    onSelectNode: (node: TreeData) => void;
    selectedKeys?: string[];
    expandedKeys?: string[];
    onExpand?: (keys: string[]) => void;
    onSearchDataChange?: (data: TreeData[]) => void;
}

const BusinessTree: React.FC<Props> = ({ selectedNodes, onSelectNode, selectedKeys, expandedKeys, onExpand, onSearchDataChange }) => {
    const { t } = useTranslation();
    const [searchValue, setSearchValue] = useState<string>("");
    const [hasSearchResults, setHasSearchResults] = useState<boolean>(true);
    // The sidebar state
    const [sidebarWidth, setSidebarWidth] = useState<number>(320);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isHover, setIsHover] = useState<boolean>(false);
    const dragging = useRef<boolean>(false);
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

    // The dragger event
    const onMouseDown = (e: React.MouseEvent) => {
        dragging.current = true;
        setIsDragging(true);
        const startX = e.clientX;
        const startWidth = sidebarWidth;

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!dragging.current) return;
            const delta = moveEvent.clientX - startX;
            let newWidth = startWidth + delta;
            if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
            if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
            setSidebarWidth(newWidth);
        };

        const onMouseUp = () => {
            dragging.current = false;
            setIsDragging(false);
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    return (
        <div className="tree-wrapper"
            style={{
                width: collapsed ? 0 : sidebarWidth,
                minWidth: collapsed ? 0 : MIN_WIDTH,
                maxWidth: collapsed ? 0 : MAX_WIDTH,
                margin: collapsed ? 0 : 8,
                marginRight: collapsed ? 0 : 20
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
                            selectedNodes={selectedNodes}
                            onSelectNode={onSelectNode}
                            searchValue={searchValue}
                            onSearchDataChange={onSearchDataChange}
                            selectedKeys={selectedKeys}
                            expandedKeys={expandedKeys}
                            onExpand={onExpand}
                        />
                    )}
                    {/* The dragger */}
                    <div
                        style={{
                            position: "absolute",
                            right: 0,
                            top: 0,
                            width: 2,
                            height: "100%",
                            cursor: "col-resize",
                            zIndex: 10,
                            background: isDragging || isHover ? "#1890ff" : "transparent",
                            borderRadius: 3,
                            transition: "background 0.2s"
                        }}
                        onMouseDown={onMouseDown}
                        onMouseEnter={() => setIsHover(true)}
                        onMouseLeave={() => setIsHover(false)}
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