// src/mock/businessMock.ts

// 左侧导航栏选项
export const bizInfo = {
  "count": 3,
  "info": [
      {
          "bk_biz_id": 2,
          "bk_biz_name": "蓝鲸"
      },
      {
          "bk_biz_id": 3,
          "bk_biz_name": "project1"
      },
      {
          "bk_biz_id": 4,
          "bk_biz_name": "project2"
      }
  ]
};
export const bizInfo2 = {
  "info": [
      {
          "bk_biz_set_id": 9991001,
          "bk_biz_set_name": "BlueKing"
      },
      {
          "bk_biz_set_id": 9992001,
          "bk_biz_set_name": "全业务-蓝盾测试部署专用"
      }
  ],
  "count": 0
};


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

// 树状结构数据
export const businessData2 = [
  {
    "bk_inst_id": 4,
    "bk_inst_name": "project2",
    "bk_obj_id": "biz",
    "bk_obj_name": "业务",
    "default": 0,
    "child": [
      {
        "bk_inst_id": 6,
        "bk_inst_name": "2",
        "bk_obj_id": "set",
        "bk_obj_name": "集群",
        "default": 0,
        "child": [
          {
            "bk_inst_id": 15,
            "bk_inst_name": "game",
            "bk_obj_id": "module",
            "bk_obj_name": "模块",
            "default": 0,
            "host_apply_enabled": false,
            "host_apply_rule_count": 0,
            "child": []
          }
        ]
      }
    ]
  }
];
export const idleCluster2 = {
  "bk_set_id": 5,
  "bk_set_name": "空闲机池",
  "module": [
    {
      "bk_module_id": 14,
      "bk_module_name": "待回收",
      "default": 3,
      "host_apply_enabled": false,
      "host_apply_rule_count": 0
    },
    {
      "bk_module_id": 13,
      "bk_module_name": "故障机",
      "default": 2,
      "host_apply_enabled": false,
      "host_apply_rule_count": 0
    },
    {
      "bk_module_id": 12,
      "bk_module_name": "空闲机",
      "default": 1,
      "host_apply_enabled": false,
      "host_apply_rule_count": 0
    }
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

export const allHosts2 =  [
  {
      "biz": [
          {
              "bk_biz_developer": "",
              "bk_biz_id": 4,
              "bk_biz_maintainer": "bk-cmdb",
              "bk_biz_name": "project2",
              "bk_biz_productor": "",
              "bk_biz_tester": "",
              "bk_created_at": "2025-05-18T13:00:01.276Z",
              "bk_created_by": "bk-cmdb",
              "bk_supplier_account": "0",
              "bk_updated_at": "2025-05-18T13:00:01.276Z",
              "bk_updated_by": "",
              "create_time": "2025-05-18T13:00:01.276Z",
              "default": 0,
              "language": "1",
              "last_time": "2025-05-18T13:00:01.276Z",
              "life_cycle": "2",
              "operator": "",
              "time_zone": "Asia/Shanghai"
          }
      ],
      "host": {
          "bk_cloud_id": [
              {
                  "id": "90000001",
                  "bk_obj_id": "plat",
                  "bk_obj_icon": "",
                  "bk_inst_id": 90000001,
                  "bk_obj_name": "",
                  "bk_inst_name": "未分配"
              }
          ],
          "bk_host_id": 1,
          "bk_host_innerip": "192.168.0.2",
          "bk_host_innerip_v6": ""
      },
      "module": [
          {
              "bk_module_id": 15,
              "bk_module_name": "game",
              "default": 0,
              "topo_module_name": "project2##2##game"
          }
      ],
      "set": [
          {
              "bk_set_id": 6,
              "bk_set_name": "2",
              "default": 0,
              "topo_module_name": "project2##2"
          }
      ]
  }
]

// 新建集群时对应的集群模板
export const setTemplate = [
  {
      "set_instance_count": 0,
      "set_template": {
          "id": 1,
          "name": "set_template1",
          "bk_biz_id": 4,
          "creator": "bk-cmdb",
          "modifier": "bk-cmdb",
          "create_time": "2025-05-23T02:07:09.054Z",
          "last_time": "2025-05-23T02:07:09.054Z",
          "bk_supplier_account": "0"
      }
  }
];
// 新建模块对应的所属服务分类
export const serviceCategoryMock = [
  {
      "category": {
          "bk_biz_id": 0,
          "id": 16,
          "name": "Apache",
          "bk_root_id": 14,
          "bk_parent_id": 14,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 19,
          "name": "Ceph",
          "bk_root_id": 18,
          "bk_parent_id": 18,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 1,
          "name": "Default",
          "bk_root_id": 1,
          "bk_parent_id": 0,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 2,
          "name": "Default",
          "bk_root_id": 1,
          "bk_parent_id": 1,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 5
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 9,
          "name": "Etcd",
          "bk_root_id": 3,
          "bk_parent_id": 3,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 14,
          "name": "HTTP 服务",
          "bk_root_id": 14,
          "bk_parent_id": 0,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 12,
          "name": "Kafka",
          "bk_root_id": 11,
          "bk_parent_id": 11,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 8,
          "name": "MongoDB",
          "bk_root_id": 3,
          "bk_parent_id": 3,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 4,
          "name": "Mysql",
          "bk_root_id": 3,
          "bk_parent_id": 3,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 20,
          "name": "NFS",
          "bk_root_id": 18,
          "bk_parent_id": 18,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 15,
          "name": "Nginx",
          "bk_root_id": 14,
          "bk_parent_id": 14,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 6,
          "name": "Oracle",
          "bk_root_id": 3,
          "bk_parent_id": 3,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 13,
          "name": "RabbitMQ",
          "bk_root_id": 11,
          "bk_parent_id": 11,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 5,
          "name": "Redis",
          "bk_root_id": 3,
          "bk_parent_id": 3,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 7,
          "name": "SQLServer",
          "bk_root_id": 3,
          "bk_parent_id": 3,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 17,
          "name": "Tomcat",
          "bk_root_id": 14,
          "bk_parent_id": 14,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 10,
          "name": "Zookeeper",
          "bk_root_id": 3,
          "bk_parent_id": 3,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 18,
          "name": "存储",
          "bk_root_id": 18,
          "bk_parent_id": 0,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 3,
          "name": "数据库",
          "bk_root_id": 3,
          "bk_parent_id": 0,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  },
  {
      "category": {
          "bk_biz_id": 0,
          "id": 11,
          "name": "消息队列",
          "bk_root_id": 11,
          "bk_parent_id": 0,
          "bk_supplier_account": "0",
          "is_built_in": true
      },
      "usage_amount": 0
  }
];
// 新建模块时对应的服务模板
export const serviceTemplate = [
  {
      "bk_biz_id": 4,
      "id": 1,
      "name": "template1",
      "service_category_id": 2,
      "creator": "bk-cmdb",
      "modifier": "bk-cmdb",
      "create_time": "2025-05-23T02:02:27.853Z",
      "last_time": "2025-05-23T02:02:27.853Z",
      "bk_supplier_account": "0",
      "host_apply_enabled": false
  }
];

// 服务实例
export const serviceInst = [
  {
      "bk_obj_id": "module",
      "bk_inst_id": 15,
      "host_count": 1,
      "service_instance_count": 0
  }
];
