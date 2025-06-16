// Business topology
export enum CreateMode {
    Template = "template",
    Direct = "direct"
}
export interface CascaderOption {
    value: string;
    label: string;
    children?: CascaderOption[];
}

/**
 * TypeScript definitions for the Host List tab
 */

// Dropdown menu type
export enum DropdownMenuType {
    Transfer = "transfer",
    Append = "append",
    Remove = "remove",
    Copy = "copy",
    More = "more",
    Instance = "instance"
}
// "Transfer To" dropdown menu item type
export enum TransferMenuItemType {
    idlePool = "idlePool",
    businessModule = "businessModule",
    hostPool = "hostPool",
    otherBusiness = "otherBusiness"
}
export enum AppendMenuItemKey {
    Business = "business"
}
export enum RemoveMenuItemKey {
    Current = "current"
}
export enum MoreMenuItemKey {
    ExportSelected = "exportSelected",
    ExportAll = "exportAll",
    ImportExcel = "importExcel"
}
export enum InstanceMenuItemKey {
    BatchDelete = "batchDelete",
    CopyIP = "copyIP",
    EditLabel = "editLabel"
}
// The type of the tail element in the tree node
export enum TailEleType {
    All = "all",
    Count = "count",
    None = "none"
}
export interface TreeData {
    title: React.ReactNode;
    key: string;
    type: string;
    objName?: string;
    children?: TreeData[];
    parentPath?: string[];
}
export enum TopoTreeNodeType {
    Biz = "biz",
    Set = "set",
    Module = "module",
    Idle = "idle"
}
export interface AddHostItem {
    id: React.Key;
    ip: string;
}
