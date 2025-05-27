// business topology
export enum CreateType {
    Set = "set",
    Module = "module"
}
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
    More = "more"
}
export enum TransferMenuItemKey {
    IdlePool = "idlePool",
    Business = "business",
    HostPool = "hostPool",
    Other = "other",
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
