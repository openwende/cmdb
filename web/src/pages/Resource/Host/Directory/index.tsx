import React, { useState, useRef, useEffect } from "react";
import { Input, Tooltip, Dropdown, Modal, Tree, MenuProps, message } from "antd";
import { PlusOutlined, FolderOutlined, MoreOutlined, RightOutlined, LeftOutlined, ExclamationCircleFilled } from "@ant-design/icons";
import { hostDirectoryMock } from "@/mock/resource";
import "./style.css";
import { DirectoryData } from "../../Types";

// The width of the directory tree sidebar
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 210;
const MAX_WIDTH = 480;

// The host pool and idle hosts cannot be modified
const unmodifiableDirIds: number[] = [0, 1];
// The new directory key
const newDirId = -1;
// The directory menu items
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

const Directory: React.FC<{
    selectedId: number | null;
    onSelect: (id: number | null) => void;
}> = ({ selectedId, onSelect }) => {
    const { confirm } = Modal;
    // The directory state
    const [dirs, setDirs] = useState(hostDirectoryMock);
    const [editDirId, setEditDirId] = useState<number | null>(null);
    const [newDir, setNewDir] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [hoverId, setHoverId] = useState<number | null>(null);
    const inputRef = useRef<any>(null);
    const [inputError, setInputError] = useState(false);
    // The sidebar state
    const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_WIDTH);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isHover, setIsHover] = useState<boolean>(false);
    const dragging = useRef<boolean>(false);
    // The collapsed state
    const [collapsed, setCollapsed] = useState<boolean>(false);

    // Trigger the message inside an effect 
    // to avoid the uncertainty caused by React's concurrent rendering.
    useEffect(() => {
        if (inputError) {
            message.error({
                content: "请输入正确的目录名称",
            });
            setInputError(false);
        }
    }, [inputError]);

    // Create a new directory
    const handleAdd = () => {
        setNewDir(true);
        setEditDirId(null);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    // Confirm the creation of a new directory
    const handleAddConfirm = () => {
        // Trigger the error message
        if (inputValue.trim() === "") {
            setInputError(true);
            return;
        }

        // TODO: api
        if (inputValue.trim()) {
            setDirs([
                // Idle host
                dirs[0],
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

    // Directory to be renamed
    const handleRename = (id: number, name: string) => {
        setEditDirId(id);
        setInputValue(name);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    // Confirm the renaming of a directory
    const handleRenameConfirm = (id: number) => {
        // Trigger the error message
        if (inputValue.trim() === "") {
            setInputError(true);
            return;
        }

        setDirs(dirs.map(d => d.bk_module_id === id ? { ...d, bk_module_name: inputValue } : d));
        setEditDirId(null);
        setInputValue("");
    };

    // The input press enter event
    const handleInputPress = (id: number) => {
        if (id === newDirId) {
            handleAddConfirm();
        } else if (id === editDirId) {
            handleRenameConfirm(id);
        }
    }

    // The input blur event
    const handleInputBlur = (id: number) => {
        if (id === newDirId) {
            setNewDir(false);
        } else if (id === editDirId) {
            setEditDirId(null);
        }
        setInputValue("");
    }

    // Directory to be deleted
    const handleDelete = (id: number) => {
        confirm({
            title: "确认删除目录",
            icon: <ExclamationCircleFilled />,
            content: "即将删除目录",
            okText: "确定",
            cancelText: "取消",
            onOk() {
                // TODO: api
                setDirs(dirs.filter(d => d.bk_module_id !== id));
                if (selectedId === id) onSelect(unmodifiableDirIds[0]);
            },
            onCancel() {},
        });
    };

    // Pin the current directory item to the top
    const handlePin = (id: number) => {
        // TODO: api
        const idx = dirs.findIndex(d => d.bk_module_id === id);
        if (idx > -1) {
            const newDirs = [...dirs];
            const [item] = newDirs.splice(idx, 1);
            // The idle host directory is always at the first position
            newDirs.splice(0, 0, item);
            setDirs(newDirs);
        }
    };

    const handleMenuClick = (key: string, id: number, name: string) => {
        if (key === 'rename') {
            handleRename(id, name);
        } else if (key === 'delete') {
            handleDelete(id);
        }
    }

    // The sidebar dragger event
    const onMouseDown = (e: React.MouseEvent) => {
        dragging.current = true;
        setIsDragging(true);
        const startX = e.clientX;
        const startWidth = sidebarWidth;

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!dragging.current) return;
            // Calculate the width of the sidebar
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

    const renderTitle = (dir: DirectoryData) => {
        const isSelected = selectedId === dir.key;
        return (
            <>
                {/* Edit mode */}
                {dir.key === editDirId || dir.key === newDirId ? (
                    <Input
                        ref={inputRef}
                        size="small"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onPressEnter={() => handleInputPress(dir.key)}
                        onBlur={() => handleInputBlur(dir.key)}
                    />
                ) : (
                    // Normal mode
                    <div
                        className="title-wrapper"
                        onMouseEnter={() => setHoverId(dir.key)}
                        onMouseLeave={() => setHoverId(null)}
                    >
                        <span className="left-wrapper">
                            {
                                dir.key !== unmodifiableDirIds[0] && (
                                    <FolderOutlined className="folder-icon" />
                                )
                            }
                            <span>{dir.title}</span>
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
                key: newDirId,
                title: "",
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
            {/* The search input and the add icon */}
            <div className="directory-header">
                <Input.Search
                    placeholder="分组目录"
                    size="middle"
                />
                <Tooltip title="新建目录">
                    <PlusOutlined className="directory-add" onClick={handleAdd} />
                </Tooltip>
            </div>
            {/* The directory tree */}
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

export default Directory;
