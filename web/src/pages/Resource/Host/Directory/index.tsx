import React, { useState, useRef } from "react";
import { Input, Tooltip, Dropdown, Modal, Tree, MenuProps } from "antd";
import { PlusOutlined, FolderOutlined, MoreOutlined, RightOutlined, LeftOutlined } from "@ant-design/icons";
import { hostDirectoryMock } from "@/mock/resource";
import "./style.css";
import { DirectoryData } from "../../Types";

const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 210;
const MAX_WIDTH = 480;

// The host pool and idle hosts cannot be modified
const unmodifiableDirIds: number[] = [0, 1];

const Directory: React.FC<{
    selectedId: number | null;
    onSelect: (id: number | null) => void;
}> = ({ selectedId, onSelect }) => {
    // The directory state
    const [dirs, setDirs] = useState(hostDirectoryMock);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [newDir, setNewDir] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [delId, setDelId] = useState<number | null>(null);
    const [hoverId, setHoverId] = useState<number | null>(null);
    const inputRef = useRef<any>(null);
    // The sidebar state
    const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_WIDTH);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isHover, setIsHover] = useState<boolean>(false);
    const dragging = useRef<boolean>(false);
    // The collapsed state
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

    // Pin the current directory item to the top
    const handlePin = (id: number) => {
        // TODO: api
        const idx = dirs.findIndex(d => d.bk_module_id === id);
        if (idx > -1) {
            const newDirs = [...dirs];
            const [item] = newDirs.splice(idx, 1);
            // The idle host directory is always at the first position
            newDirs.splice(1, 0, item);
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

    const handleMenuClick = (key: string, id: number, name: string) => {
        if (key === 'rename') {
            handleRename(id, name);
        } else if (key === 'delete') {
            handleDelete(id);
        }
    }

    const items: MenuProps['items'] = [
        {
            key: 'rename',
            label: "重命名",
        },
        {
            key: 'delete',
            label: "删除",
        }
    ]

    const renderTitle = (dir: DirectoryData) => {
        const isSelected = selectedId === dir.key;
        return (
            <>
                {editingId === dir.key ? (
                    <Input
                        ref={inputRef}
                        size="small"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onPressEnter={() => handleRenameConfirm(dir.key)}
                        onBlur={() => setEditingId(null)}
                    />
                ) : (
                    <div
                        className="title-wrapper"
                        onMouseEnter={() => setHoverId(dir.key)}
                        onMouseLeave={() => setHoverId(null)}
                    >
                        <span className="left-wrapper">
                            <FolderOutlined className="folder-icon" />
                            <span>{dir.title}</span>
                            {editingId === dir.key ? (
                                <Input
                                    ref={inputRef}
                                    size="small"
                                    value={inputValue}
                                    onChange={e => setInputValue(e.target.value)}
                                    onPressEnter={() => handleRenameConfirm(dir.key)}
                                    onBlur={() => setEditingId(null)}
                                />
                            ) : (
                                <span>{dir.title}</span>
                            )}
                        </span>
                        <span className="right-wrapper">
                            {hoverId === dir.key && !unmodifiableDirIds.includes(dir.key) && (
                                <span className="right-operation">
                                    <Tooltip title="置顶">
                                        <span
                                            className="pin-to-top"
                                            onClick={e => { e.stopPropagation(); handlePin(dir.key) }}
                                        >
                                            不
                                        </span>
                                    </Tooltip>
                                    <Dropdown
                                        menu={{
                                            items: items,
                                            onClick: (e) => handleMenuClick(e.key, dir.key, dir.title as string)
                                        }}
                                        trigger={['click']}
                                    >
                                        <MoreOutlined className="more-operation" />
                                    </Dropdown>
                                </span>
                            )}
                            <span className={`right-count ${isSelected ? 'selected' : ''}`}>
                                {dir.key === 0 ? dirs.reduce((sum, d) => sum + (d.host_count || 0), 0) : dir.count}
                            </span>
                        </span>
                    </div>
                )}
            </>
        )
    }

    const getDirectoryData = (): DirectoryData[] => {
        const [idle, ...rest] = dirs;

        // Idle directory
        const children: DirectoryData[] = [
            {
                key: idle.bk_module_id,
                title: idle.bk_module_name,
                count: idle.host_count
            }
        ];

        // New directory input field
        if (newDir) {
            children.push({
                key: Date.now(),
                title: (
                    <Input
                        ref={inputRef}
                        size="small"
                        value={inputValue}
                        placeholder="请输入目录名称，回车结束"
                        onChange={e => setInputValue(e.target.value)}
                        onPressEnter={handleAddConfirm}
                        onBlur={() => setNewDir(false)}
                    />
                ),
            });
        }

        // Other directories
        rest.forEach(dir => {
            children.push({
                key: dir.bk_module_id,
                title: dir.bk_module_name,
                count: dir.host_count
            });
        });

        return [
            {
                key: 0,
                title: "主机池",
                children,
            }
        ];
    };

    return (
        <div className="directory-wrapper"
            style={{
                width: collapsed ? 0 : sidebarWidth,
                minWidth: collapsed ? 0 : MIN_WIDTH,
                maxWidth: collapsed ? 0 : MAX_WIDTH,
                marginRight: collapsed ? 0 : 20,
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
                treeData={getDirectoryData()}
                defaultExpandAll={true}
                showLine={true}
                blockNode={true}
                selectedKeys={selectedId ? [selectedId] : []}
                onSelect={keys => { keys.length && onSelect(keys[0] as number) }}
                titleRender={renderTitle}
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
