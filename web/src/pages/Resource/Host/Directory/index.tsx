import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { Input, Tooltip, Dropdown, Modal, Tree, MenuProps, message, InputRef } from "antd";
import { PlusOutlined, FolderOutlined, MoreOutlined, RightOutlined, LeftOutlined, ExclamationCircleFilled, PushpinOutlined } from "@ant-design/icons";
import { hostDirectoryMock } from "@/mock/resource";
import { DirectoryData, DirMenuKey } from "../../Types";
import "./style.css";

// The width of the directory tree sidebar
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 210;
const MAX_WIDTH = 480;

// The host pool and idle hosts cannot be modified
const unmodifiableDirIds: number[] = [0, 1];
// The new directory key
const newDirId = -1;

const Directory: React.FC<{
    selectedId: number | null;
    onSelect: (id: number | null) => void;
}> = ({ selectedId, onSelect }) => {
    const { t } = useTranslation();
    const { confirm } = Modal;
    const [dirs, setDirs] = useState(hostDirectoryMock);
    // State for adding and editing directories
    const [editDirId, setEditDirId] = useState<number | null>(null);
    const [newDir, setNewDir] = useState<boolean>(false);
    const inputRef = useRef<InputRef>(null);
    const [inputValue, setInputValue] = useState<string>("");
    const [messageStatus, setMessageStatus] = useState<{ type: "error" | "success"; content: string }>();
    // State for the pinned directory
    const [pinnedDirs, setPinnedDirs] = useState(hostDirectoryMock);
    const [hoverId, setHoverId] = useState<number | null>(null);
    const [pinnedOrder, setPinnedOrder] = useState<number[]>([]);
    // State for the sidebar
    const [sidebarWidth, setSidebarWidth] = useState<number>(DEFAULT_WIDTH);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [isHover, setIsHover] = useState<boolean>(false);
    const dragging = useRef<boolean>(false);
    // State for the collapsed
    const [collapsed, setCollapsed] = useState<boolean>(false);

    // Trigger the message inside an effect
    // to avoid the uncertainty caused by React's concurrent rendering.
    useEffect(() => {
        if (messageStatus) {
            message.open({
                type: messageStatus.type,
                content: messageStatus.content,
            });
        }
    }, [messageStatus]);

    // Directory to be created
    const handleAdd = () => {
        setNewDir(true);
        setEditDirId(null);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    // Confirm the creation of a new directory
    const handleAddConfirm = () => {
        // Trigger the error message
        if (inputValue.trim() === "") {
            setMessageStatus({
                type: "error",
                content: t("host.directory.message.correct_name"),
            });
            return;
        }

        if (!isInputValueAvailable()) {
            setMessageStatus({
                type: "error",
                content: t("host.directory.message.exist_name"),
            });
            return;
        }

        // TODO: api
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
        setPinnedDirs([
            // Idle host
            pinnedDirs[0],
            {
                bk_module_id: Date.now(),
                bk_module_name: inputValue,
                default: 4,
                host_count: 0,
                children: []
            },
            ...pinnedDirs.slice(1)
        ])

        setNewDir(false);
        setInputValue("");
        setMessageStatus({
            type: "success",
            content: t("host.directory.message.add_success"),
        });
    };

    // Directory to be renamed
    const handleRename = (id: number, name: string) => {
        setEditDirId(id);
        setInputValue(name);
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    // Confirm the renaming of a directory
    const handleRenameConfirm = (id: number) => {
        if (inputValue.trim() === "") {
            setMessageStatus({
                type: "error",
                content: t("host.directory.message.correct_name")
            });
            return;
        }

        if (!isInputValueAvailable()) {
            setMessageStatus({
                type: "error",
                content: t("host.directory.message.exist_name"),
            });
            return;
        }

        setDirs(dirs.map(d => d.bk_module_id === id ? { ...d, bk_module_name: inputValue } : d));
        setEditDirId(null);
        setInputValue("");
        setMessageStatus({
            type: "success",
            content: t("host.directory.message.rename_success"),
        });
    };

    // Check if the input value is available
    const isInputValueAvailable = () => {
        const isAvailable = dirs.filter(d => d.bk_module_id !== editDirId)
            .every(d => d.bk_module_name !== inputValue);
        if (isAvailable) {
            return true;
        }
        return false;
    }

    const handleInputPress = (id: number) => {
        if (id === newDirId) {
            handleAddConfirm();
        } else if (id === editDirId) {
            handleRenameConfirm(id);
        }
    }

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
            title: t("host.directory.confirm.title"),
            icon: <ExclamationCircleFilled />,
            content: t("host.directory.confirm.content"),
            okText: t("common.confirm"),
            cancelText: t("common.cancel"),
            onOk() {
                // TODO: api
                setDirs(dirs.filter(d => d.bk_module_id !== id));
                setPinnedDirs(pinnedDirs.filter(d => d.bk_module_id !== id));
                if (selectedId === id) onSelect(unmodifiableDirIds[0]);
                setMessageStatus({
                    type: "success",
                    content: t("host.directory.message.delete_success")
                });
            },
            onCancel() { },
        });
    };

    // Pin or unpin the current directory item
    const handlePin = (id: number) => {
        const isPinned = pinnedOrder.includes(id);

        if (isPinned) {
            // unpin
            setDirs(prevDirs => {
                const newDirs = [...prevDirs];
                const currentIndex = newDirs.findIndex(d => d.bk_module_id === id);
                const [item] = newDirs.splice(currentIndex, 1);
                const insertIdx = pinnedDirs.findIndex(d => d.bk_module_id === id);
                newDirs.splice(insertIdx, 0, item);
                return newDirs;
            });
            setPinnedOrder(prev => prev.filter(pinnedId => pinnedId !== id));
            setMessageStatus({
                type: "success",
                content: t("host.directory.message.unpin_success")
            });
        } else {
            // Pin
            setDirs(prevDirs => {
                const newDirs = [...prevDirs];
                const currentIndex = newDirs.findIndex(d => d.bk_module_id === id);
                const [item] = newDirs.splice(currentIndex, 1);
                newDirs.splice(0, 0, item);
                return newDirs;
            });
            setPinnedOrder(prev => [id, ...prev]);
            setMessageStatus({
                type: "success",
                content: t("host.directory.message.pin_success"),
            });
        }
    };

    const handleMenuClick = (key: string, id: number, name: string) => {
        if (key === DirMenuKey.Rename) {
            handleRename(id, name);
        } else if (key === DirMenuKey.Delete) {
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

    // The directory menu items
    const items: MenuProps['items'] = [
        {
            key: DirMenuKey.Rename,
            label: t("common.rename"),
        },
        {
            key: DirMenuKey.Delete,
            label: t("common.delete"),
        }
    ]

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
                        placeholder={t("host.directory.input.placeholder")}
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
                                    <Tooltip title={pinnedOrder.includes(dir.key) ? t("host.directory.unpin") : t("host.directory.pin")}>
                                        <span
                                            className="pin-to-top"
                                            onClick={e => { e.stopPropagation(); handlePin(dir.key) }}
                                        >
                                            {pinnedOrder.includes(dir.key) ? (
                                                <PushpinOutlined style={{ fontSize: 14 }} />
                                            ) : (
                                                "不"
                                            )}
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
        // Get the idle directory
        const idle = dirs.find(d => d.bk_module_id === unmodifiableDirIds[1])!;
        // Get the rest of the directories
        const rest = dirs.filter(d => d.bk_module_id !== unmodifiableDirIds[1]);

        const children: DirectoryData[] = [
            // Pinned directories
            ...pinnedOrder.map(id => {
                const dir = rest.find(d => d.bk_module_id === id)!;
                return {
                    key: dir.bk_module_id,
                    title: dir.bk_module_name,
                    count: dir.host_count
                }
            }),
            // Idle directory
            {
                key: idle.bk_module_id,
                title: idle.bk_module_name,
                count: idle.host_count
            }
        ];

        // New directory
        if (newDir) {
            children.push({
                key: newDirId,
                title: "",
            });
        }

        // The rest of the directory
        rest.filter(dir => !pinnedOrder.includes(dir.bk_module_id))
            .forEach(dir => {
                children.push({
                    key: dir.bk_module_id,
                    title: dir.bk_module_name,
                    count: dir.host_count
                });
            });

        return [
            {
                key: unmodifiableDirIds[0],
                title: t("host.directory.host_pool"),
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
                    placeholder={t("host.directory.grouped")}
                    size="middle"
                />
                <Tooltip title={t("host.directory.add")}>
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
