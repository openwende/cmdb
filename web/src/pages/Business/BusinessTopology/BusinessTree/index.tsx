import React, { Fragment, useEffect, useRef, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Input, Tree } from "antd";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { businessData, idleCluster } from "../../../../mock/business";
// import { getTopologyTree } from "@/api";
import HostSvg from '@/assets/icons/host.svg';
import FaultHostSvg from '@/assets/icons/faultHost.svg';
import "./style.css";

const MIN_WIDTH = 210;
const MAX_WIDTH = 480;

interface Props {
    selectedKey: string | null;
    onSelect: (key: string | null) => void;
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

const BusinessTree: React.FC<Props> = ({ selectedKey, onSelect }) => {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [search, setSearch] = useState<string>("");
    // the tree state
    const [treeData, setTreeData] = useState<TreeData[]>([]);
    const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    // the sidebar state
    const [sidebarWidth, setSidebarWidth] = useState<number>(320);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isHover, setIsHover] = useState<boolean>(false);
    const dragging = useRef<boolean>(false);
    // the collapsed state
    const [collapsed, setCollapsed] = useState<boolean>(false);

    useEffect(() => {
        // getTopologyTree().then(res => {
        //     console.log(res);
        // }).catch(err => {
        //     console.log(err)
        // })
        const treeData = buildTreeData();
        setTreeData(treeData);
        onSelect(treeData[0].key);
        setExpandedKeys([treeData[0].key]);
    }, [businessData])

    const createNode = (type: string) => {
        if (type === 'business') {
            // TODO: create business
        } else if (type === 'cluster') {
            // TODO: create cluster
        } else if (type === 'module') {
            // TODO: create module
        }
    }

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

    const renderTitle = (node: TreeData) => {
        const isSelected = selectedKey === node.key;
        return (
            <span className="title-wrapper">
                <span className="left-wrapper">
                    {node.type === 'business' && <span className={`title-prefix ${isSelected ? 'selected' : ''}`}>业</span>}
                    {node.type === 'cluster' && <span className={`title-prefix ${isSelected ? 'selected' : ''}`}>集</span>}
                    {node.type === 'module' && <span className={`title-prefix ${isSelected ? 'selected' : ''}`}>模</span>}
                    {node.title}
                </span>
                <span className="right-wrapper"
                    onMouseEnter={() => setHoveredKey(node.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                >
                    {/* TODO: count */}
                    {hoveredKey === node.key && node.type !== 'idle'
                        ? <Button type="primary" size="small" onClick={() => createNode(node.type)}>新建</Button>
                        : <span className={`suffix-count ${isSelected ? 'selected' : ''}`}>0</span>
                    }
                </span>
            </span>
        )
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
                        blockNode={true}
                        titleRender={renderTitle}
                        // showIcon={true}
                        selectedKeys={selectedKey ? [selectedKey] : []}
                        onSelect={keys => { keys.length && onSelect(keys[0] as string) }}
                        expandedKeys={expandedKeys}
                        onExpand={keys => setExpandedKeys(keys as string[])}
                        className="ant-tree"
                    />
                    {/* the dragger */}
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