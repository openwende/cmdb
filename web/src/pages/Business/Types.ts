// business topology
export enum CreateMode {
    Template = "template",
    Direct = "direct"
}
export interface CascaderOption {
    value: string;
    label: string;
    children?: CascaderOption[];
}
export enum DropdownMenuType {
    Transfer = "transfer",
    Append = "append",
    Remove = "remove",
    Copy = "copy",
    More = "more",
    Instance = "instance"
}
export enum TransferMenuItemKey {
    IdlePool = "idlePool",
    Business = "business",
    HostPool = "hostPool",
    Other = "other"
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
