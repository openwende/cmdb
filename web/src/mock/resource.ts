export const businessListMock = Array.from({ length: 20 }).map((_, i) => ({
  id: i + 1,
  name: i === 0 ? "蓝鲸" : `business${i}`,
  operator: i === 0 ? "admin" : "bk-cmdb",
  createTime: `2025-05-15 18:${(10 + i).toString().padStart(2, "0")}:00`,
  creator: i === 0 ? "--" : "bk-cmdb"
}));
