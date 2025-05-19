import React, { useState, useRef } from "react";
import { Input, Tooltip, Dropdown, Menu, Modal, Tree } from "antd";
import { PlusOutlined, FolderOutlined, MoreOutlined, RightOutlined, LeftOutlined } from "@ant-design/icons";
import { hostDirectoryMock } from "@/mock/resource";
import "./style.css";

const MIN_WIDTH = 210;
const MAX_WIDTH = 480;

const Directory: React.FC<{
    selectedId: number | null;
    onSelect: (id: number | null) => void;
}> = ({ selectedId, onSelect }) => {
    const [dirs, setDirs] = useState(hostDirectoryMock);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [newDir, setNewDir] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [delId, setDelId] = useState<number | null>(null);
    const [hoverId, setHoverId] = useState<number | null>(null);
    const inputRef = useRef<any>(null);
    // the sidebar state
    const [sidebarWidth, setSidebarWidth] = useState<number>(320);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isHover, setIsHover] = useState<boolean>(false);
    const dragging = useRef<boolean>(false);
    // the collapsed state
    const [collapsed, setCollapsed] = useState<boolean>(false);

    // 新建目录
    const handleAdd = () => {
        setNewDir(true);
        setEditingId(null);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    // 确认新建
    const handleAddConfirm = () => {
        if (inputValue.trim()) {
            setDirs([
                dirs[0], // 空闲机
                {
                    bk_module_id: Date.now(),
                    bk_module_name: inputValue,
                    default: 4,
                    host_count: 0,
                    children: []
                },
                ...dirs.slice(1)
            ]);
        }
        setNewDir(false);
        setInputValue("");
    };

    // 目录重命名
    const handleRename = (id: number, name: string) => {
        setEditingId(id);
        setInputValue(name);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    // 确认重命名
    const handleRenameConfirm = (id: number) => {
        setDirs(dirs.map(d => d.bk_module_id === id ? { ...d, bk_module_name: inputValue } : d));
        setEditingId(null);
        setInputValue("");
    };

    // 删除目录
    const handleDelete = (id: number) => {
        setDirs(dirs.filter(d => d.bk_module_id !== id));
        setDelId(null);
        if (selectedId === id) onSelect(null);
    };

    // 置顶
    const handlePin = (id: number) => {
        const idx = dirs.findIndex(d => d.bk_module_id === id);
        if (idx > -1) {
            const newDirs = [...dirs];
            const [item] = newDirs.splice(idx, 1);
            newDirs.splice(1, 0, item); // 空闲机后面
            setDirs(newDirs);
        }
    };

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

    // 目录右侧菜单
    const menu = (dir: any) => (
        <Menu>
            <Menu.Item key="rename" onClick={() => handleRename(dir.bk_module_id, dir.bk_module_name)}>
                重命名
            </Menu.Item>
            <Menu.Item key="delete" onClick={() => setDelId(dir.bk_module_id)}>
                删除
            </Menu.Item>
        </Menu>
    );

    // Tree 数据
    const getTreeData = () => {
        const [idle, ...rest] = dirs;
        const children: any[] = [
            {
                key: idle.bk_module_id,
                title: (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            background: selectedId === idle.bk_module_id ? "#eaf3ff" : undefined,
                            color: selectedId === idle.bk_module_id ? "#1976d2" : undefined,
                            borderRadius: 4,
                            padding: "0 4px"
                        }}
                        onMouseEnter={() => setHoverId(idle.bk_module_id)}
                        onMouseLeave={() => setHoverId(null)}
                        onClick={e => { e.stopPropagation(); onSelect(idle.bk_module_id); }}
                    >
                        <FolderOutlined style={{ marginRight: 6 }} />
                        <span style={{ flex: 1 }}>{idle.bk_module_name}</span>
                        <span style={{
                            marginLeft: 8,
                            background: "#f0f1f5",
                            color: "#888",
                            borderRadius: 8,
                            padding: "0 8px",
                            fontSize: 12
                        }}>{idle.host_count}</span>
                    </div>
                ),
                selectable: false
            }
        ];

        // 新建目录输入框节点
        if (newDir) {
            children.push({
                key: "newDirInput",
                title: (
                    <Input
                        ref={inputRef}
                        size="small"
                        value={inputValue}
                        style={{ margin: "4px 0 2px 0", width: 120 }}
                        placeholder="请输入目录名称，回车结束"
                        onChange={e => setInputValue(e.target.value)}
                        onPressEnter={handleAddConfirm}
                        onBlur={() => setNewDir(false)}
                    />
                ),
                selectable: false
            });
        }

        // 其他目录
        rest.forEach(dir => {
            children.push({
                key: dir.bk_module_id,
                title: (
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            background: selectedId === dir.bk_module_id ? "#eaf3ff" : undefined,
                            color: selectedId === dir.bk_module_id ? "#1976d2" : undefined,
                            borderRadius: 4,
                            padding: "0 4px"
                        }}
                        onMouseEnter={() => setHoverId(dir.bk_module_id)}
                        onMouseLeave={() => setHoverId(null)}
                        onClick={e => { e.stopPropagation(); onSelect(dir.bk_module_id); }}
                    >
                        <FolderOutlined style={{ marginRight: 6 }} />
                        {editingId === dir.bk_module_id ? (
                            <Input
                                ref={inputRef}
                                size="small"
                                value={inputValue}
                                style={{ width: 80 }}
                                onChange={e => setInputValue(e.target.value)}
                                onPressEnter={() => handleRenameConfirm(dir.bk_module_id)}
                                onBlur={() => setEditingId(null)}
                            />
                        ) : (
                            <span style={{ flex: 1 }}>{dir.bk_module_name}</span>
                        )}
                        <span style={{
                            marginLeft: 8,
                            background: "#f0f1f5",
                            color: "#888",
                            borderRadius: 8,
                            padding: "0 8px",
                            fontSize: 12
                        }}>{dir.host_count}</span>
                        {hoverId === dir.bk_module_id && (
                            <>
                                <Tooltip title="置顶">
                                    <span
                                        style={{
                                            marginLeft: 8,
                                            color: "#1976d2",
                                            background: "#fff",
                                            borderRadius: "50%",
                                            width: 24,
                                            height: 24,
                                            display: "inline-flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer",
                                            border: "1px solid #eaf3ff"
                                        }}
                                        onClick={e => { e.stopPropagation(); handlePin(dir.bk_module_id); }}
                                    >不</span>
                                </Tooltip>
                                <Dropdown
                                    overlay={menu(dir)}
                                    trigger={['click']}
                                    placement="bottomRight"
                                >
                                    <MoreOutlined style={{ marginLeft: 4, fontSize: 16, color: "#888", cursor: "pointer" }} />
                                </Dropdown>
                            </>
                        )}
                    </div>
                ),
                selectable: false
            });
        });

        return [
            {
                key: "root",
                title: (
                    <div style={{ display: "flex", alignItems: "center", color: "#1976d2", fontWeight: 500 }}>
                        主机池
                        <span style={{
                            marginLeft: "auto",
                            background: "#eaf3ff",
                            color: "#1976d2",
                            borderRadius: 8,
                            padding: "0 8px",
                            fontSize: 12
                        }}>
                            {dirs.reduce((sum, d) => sum + (d.host_count || 0), 0)}
                        </span>
                    </div>
                ),
                children
            }
        ];
    };

    return (
        <div className="directory-wrapper"
            style={{
                width: collapsed ? 0 : sidebarWidth,
                minWidth: collapsed ? 0 : MIN_WIDTH,
                maxWidth: collapsed ? 0 : MAX_WIDTH,
                margin: collapsed ? 0 : 8,
                marginRight: collapsed ? 0 : 20
            }}
        >
            <div className="directory-header">
                <Input.Search
                    placeholder="分组目录"
                    size="middle"
                    style={{ marginRight: 8 }}
                />
                <Tooltip title="新建目录">
                    <PlusOutlined
                        style={{ fontSize: 18, color: "#1976d2", cursor: "pointer" }}
                        className="directory-add"
                        onClick={handleAdd}
                    />
                </Tooltip>
            </div>
            <Tree
                treeData={getTreeData()}
                defaultExpandAll
                selectedKeys={selectedId ? [selectedId] : []}
                showLine={false}
                blockNode={true}
                onSelect={(_, info) => {
                    if (info.node.key === "root") onSelect(null);
                }}
                className="directory-tree"
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
            <Modal
                open={!!delId}
                title="确认删除目录"
                onOk={() => handleDelete(delId!)}
                onCancel={() => setDelId(null)}
                okText="确定"
                cancelText="取消"
            >
                即将删除目录
            </Modal>
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

export default Directory;
