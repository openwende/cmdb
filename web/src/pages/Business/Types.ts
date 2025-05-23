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
