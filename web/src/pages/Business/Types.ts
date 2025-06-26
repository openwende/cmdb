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
export type TransferHostType = keyof typeof TransferMenuItemType | AppendMenuItemKey | 'addHost';
export enum AppendMenuItemKey {
    AppendToBusinessModule = "AppendToBusinessModule"
}
export enum RemoveMenuItemKey {
    Current = "current"
}
// "Copy" dropdown menu item type
export enum CopyMenuItemKey {
    Id = 'id',
    IPv4 = 'ipv4',
    IPv6 = 'ipv6',
    CloudIdIPv4 = 'cloud_id_ipv4',
    CloudIdIPv6 = 'cloud_id_ipv6',
    CloudIdIpIPv4First = 'cloud_id_ip_ipv4_first',
    CloudIdIpIPv6First = 'cloud_id_ip_ipv6_first',
    CloudRegion = 'cloud_region',
    ModuleName = 'module_name',
    SetName = 'set_name'
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
}
