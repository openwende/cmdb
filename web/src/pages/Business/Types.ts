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
// Data type from api for tree
export interface RawNodeData {
    bk_inst_name?: string;
    bk_set_name?: string;
    bk_module_name?: string;
    bk_obj_id?: string;
    bk_inst_id?: number;
    bk_set_id?: number;
    bk_module_id?: number;
    bk_obj_name?: string;
    child?: RawNodeData[];
    module?: RawNodeData[];
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
export type TransferHostType = keyof typeof TransferMenuItemType | AppendMenuItemKey | RemoveMenuItemKey | 'addHost';
export enum AppendMenuItemKey {
    AppendToBusinessModule = "AppendToBusinessModule"
}
export enum RemoveMenuItemKey {
    CurrentModule = "currentModule"
}
// "Copy" dropdown menu item key
export enum CopyMenuItemKey {
    Id = 'id',
    IPv4 = 'ipv4',
    IPv6 = 'ipv6',
    CloudIdIPv4 = 'cloudIdIpv4',
    CloudIdIPv6 = 'cloudIdIpv6',
    CloudIdIPIPv4First = 'cloudIdIpIpv4First',
    CloudIdIPIPv6First = 'cloudIdIpIpv6First',
    CloudRegion = 'cloudRegion',
    ModuleName = 'moduleName',
    SetName = 'setName'
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
export interface TransferHostItem {
    id: React.Key;
    ip: string;
    inIdlePool?: boolean;
    cloudInfo?: string;
}
