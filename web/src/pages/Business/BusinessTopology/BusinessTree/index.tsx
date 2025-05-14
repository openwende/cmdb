import React, { Fragment, useMemo, useRef, useState } from "react";
import { useTranslation } from 'react-i18next';
import { Input, Tree } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { businessData, idleCluster } from "../../../../mock/business";
import { getTopologyTree } from "@/api";
import "./style.css";

const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

interface Props {
    selectedKey: string | null;
    onSelect: (key: string | null) => void;
}

function buildTreeData() {
    return businessData.map(biz => ({
        title: biz.name,
        key: `business-${biz.id}`,
        children: [
            {
                title: idleCluster.name,
                key: `cluster-${idleCluster.id}-${biz.id}`,
                children: idleCluster.modules.map(mod => ({
                    title: mod.name,
                    key: `module-${mod.id}-${idleCluster.id}-${biz.id}`
                }))
            },
            ...biz.clusters.map(cluster => ({
                title: cluster.name,
                key: `cluster-${cluster.id}-${biz.id}`,
                children: cluster.modules.map(mod => ({
                    title: mod.name,
                    key: `module-${mod.id}-${cluster.id}-${biz.id}`
                }))
            }))
        ]
    }));
}

const BusinessTree: React.FC<Props> = ({ selectedKey, onSelect }) => {
    const { t } = useTranslation();
    const treeData = useMemo(() => buildTreeData(), []);
    const [search, setSearch] = useState("");
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isDragging, setIsDragging] = useState(false);
    const [isHover, setIsHover] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const dragging = useRef(false);

    // the dragger event
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
            {/* the search input and tree*/}
            {
                !collapsed && <Fragment>
                    <div className="search-wrapper">
                        <Input.Search
                            placeholder={t("business.topology.tree.search")}
                            allowClear
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    <Tree
                        treeData={treeData}
                        defaultExpandAll={true}
                        blockNode={true}
                        onSelect={keys => onSelect(keys[0] as string)}
                        selectedKeys={selectedKey ? [selectedKey] : []}
                        className="ant-tree"
                    />
                    {/* the dragger */}
                    <div
                        style={{
                            position: "absolute",
                            right: 0,
                            top: 0,
                            width: 6,
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
            }
            {/* the collapsed button */}
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