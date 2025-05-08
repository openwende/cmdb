import React, { useMemo, useRef, useState } from "react";
import { Input, Tree } from "antd";
import { businessData, idleCluster } from "../../../../mock/business";
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
    const treeData = useMemo(() => buildTreeData(), []);
    const [search, setSearch] = useState("");
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isDragging, setIsDragging] = useState(false);
    const [isHover, setIsHover] = useState(false);
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
        <div className="tree-wrapper" style={{
            width: sidebarWidth,
            minWidth: MIN_WIDTH,
            maxWidth: MAX_WIDTH
        }}>
            <div className="search-wrapper">
                <Input.Search
                    placeholder="请输入关键词"
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
        </div>
    );
};

export default BusinessTree;