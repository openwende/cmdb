// src/mock/businessMock.ts

export const businessData = [
    {
      id: "biz1",
      name: "官网业务",
      clusters: [
        {
          id: "cluster2",
          name: "上海区",
          modules: [
            { id: "mod1", name: "模块A" },
            { id: "mod2", name: "模块B" }
          ]
        },
        {
          id: "cluster3",
          name: "广东区",
          modules: [
            { id: "mod3", name: "模块C" }
          ]
        }
      ]
    },
    {
      id: "biz2",
      name: "测试业务",
      clusters: [
        {
          id: "cluster4",
          name: "北京区",
          modules: [
            { id: "mod4", name: "模块D" }
          ]
        }
      ]
    }
  ];
  
  export const idleCluster = {
    id: "idlepool",
    name: "空闲机池",
    modules: [
      { id: "recycle", name: "待回收" },
      { id: "fault", name: "故障机" },
      { id: "idle", name: "空闲机" }
    ]
  };
  
  export const allHosts = [
    { id: "h1", ip: "192.168.1.30", name: "主机1", businessId: "biz1", clusterId: "cluster2", moduleId: "mod1" },
    { id: "h2", ip: "192.168.1.101", name: "主机2", businessId: "biz1", clusterId: "cluster2", moduleId: "mod2" },
    { id: "h3", ip: "192.168.2.30", name: "主机3", businessId: "biz2", clusterId: "cluster4", moduleId: "mod4" },
    // 空闲机池相关
    { id: "h4", ip: "192.168.1.150", name: "主机4", businessId: "biz1", clusterId: "idlepool", moduleId: "idle" },
    { id: "h5", ip: "192.168.1.160", name: "主机5", businessId: "biz1", clusterId: "idlepool", moduleId: "fault" },
    { id: "h6", ip: "192.168.1.196", name: "主机6", businessId: "biz1", clusterId: "idlepool", moduleId: "recycle" }
  ];