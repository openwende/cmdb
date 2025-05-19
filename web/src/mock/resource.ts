export const businessListMock = Array.from({ length: 20 }).map((_, i) => ({
  id: i + 1,
  name: i === 0 ? "蓝鲸" : `business${i}`,
  operator: i === 0 ? "admin" : "bk-cmdb",
  createTime: `2025-05-15 18:${(10 + i).toString().padStart(2, "0")}:00`,
  creator: i === 0 ? "--" : "bk-cmdb"
}));

// 目录及主机数量 mock
export const hostDirectoryMock = [
  {
    bk_module_id: 1,
    bk_module_name: "空闲机",
    default: 1,
    host_count: 2,
    children: []
  },
  {
    bk_module_id: 16,
    bk_module_name: "host1",
    default: 4,
    host_count: 0,
    children: []
  },
  {
    bk_module_id: 11,
    bk_module_name: "zhuji",
    default: 4,
    host_count: 0,
    children: []
  }
];

// 主机列表 mock
export const hostListMock = [
  {
    id: 2,
    ipv4: "10.0.0.2",
    ipv6: "--",
    region: "未分组[90000001]",
    topo: "资源池 / 空闲机池 / 空闲机",
    cloudStatus: "--"
  },
  {
    id: 3,
    ipv4: "10.0.0.3",
    ipv6: "--",
    region: "未分组[90000001]",
    topo: "资源池 / 空闲机池 / 空闲机",
    cloudStatus: "--"
  }
];
