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
      "bk_biz_name": "business2"
    },
    {
      "bk_biz_id": 4,
      "bk_biz_name": "project2"
    }
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
        "bk_inst_name": "set2",
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
          },
          {
            "bk_inst_id": 16,
            "bk_inst_name": "game2",
            "bk_obj_id": "module",
            "bk_obj_name": "模块",
            "default": 0,
            "host_apply_enabled": false,
            "host_apply_rule_count": 0,
            "child": []
          }
        ]
      },
      {
        "bk_inst_id": 7,
        "bk_inst_name": "set4",
        "bk_obj_id": "set",
        "bk_obj_name": "集群",
        "default": 0,
        "child": []
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
// 业务拓扑->主机列表
export const allHosts2 = [
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
      "bk_host_innerip_v6": "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
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
  },
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
      "bk_host_id": 2,
      "bk_host_innerip": "192.0.0.1",
      "bk_host_innerip_v6": "2001:0db8:85a3:0000:0000:8a2e:0370:7334"
    },
    "module": [
      {
        "bk_module_id": 16,
        "bk_module_name": "game",
        "default": 0,
        "topo_module_name": "project2##2##game"
      }
    ],
    "set": [
      {
        "bk_set_id": 5,
        "bk_set_name": "2",
        "default": 0,
        "topo_module_name": "project2##2"
      }
    ]
  },
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
      "bk_host_id": 3,
      "bk_host_innerip": "10.0.0.2",
      "bk_host_innerip_v6": ""
    },
    "module": [
      {
        "bk_module_id": 16,
        "bk_module_name": "game",
        "default": 0,
        "topo_module_name": "project2##2##game"
      }
    ],
    "set": [
      {
        "bk_set_id": 5,
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

// 业务拓扑：服务实例
export const serviceInst = [
  {
    "bk_biz_id": 4,
    "bk_host_id": 1,
    "bk_module_id": 15,
    "bk_supplier_account": "0",
    "create_time": "2025-05-27T06:52:15.748Z",
    "creator": "bk-cmdb",
    "id": 1,
    "labels": {
      "dba": "test",
      "dev": "test"
    },
    "last_time": "2025-05-27T06:52:15.748Z",
    "modifier": "bk-cmdb",
    "name": "192.168.0.2_devTest",
    "process_count": 1,
    "service_template_id": 0
  }
];
// 业务拓扑：进程实例
export const processInst = [
  {
    "property": {
      "auto_start": false,
      "bind_info": [],
      "bk_biz_id": 4,
      "bk_created_at": "2025-05-27T06:52:15.757Z",
      "bk_created_by": "bk-cmdb",
      "bk_func_name": "devTest",
      "bk_process_id": 1,
      "bk_process_name": "devTest",
      "bk_start_check_secs": null,
      "bk_start_param_regex": "",
      "bk_supplier_account": "0",
      "bk_updated_at": "2025-05-27T06:52:15.757Z",
      "bk_updated_by": "",
      "create_time": "2025-05-27T06:52:15.757Z",
      "description": "",
      "face_stop_cmd": "",
      "last_time": "2025-05-27T06:52:15.757Z",
      "pid_file": "",
      "priority": null,
      "proc_num": null,
      "reload_cmd": "",
      "restart_cmd": "",
      "service_instance_id": 1,
      "start_cmd": "",
      "stop_cmd": "",
      "timeout": null,
      "user": "",
      "work_path": ""
    },
    "relation": {
      "bk_biz_id": 4,
      "bk_process_id": 1,
      "service_instance_id": 1,
      "process_template_id": 0,
      "bk_host_id": 1,
      "bk_supplier_account": "0"
    }
  }
];
// 点击查看、编辑时的进程详情
export const processDetail = [
  {
    "process_id": 1,
    "service_instance_name": "192.168.0.2_devTest",
    "property": {
      "auto_start": false,
      "bind_info": [],
      "bk_biz_id": 4,
      "bk_created_at": "2025-05-27T06:52:15.757Z",
      "bk_created_by": "bk-cmdb",
      "bk_func_name": "devTest",
      "bk_process_id": 1,
      "bk_process_name": "devTest",
      "bk_start_check_secs": null,
      "bk_start_param_regex": "",
      "bk_supplier_account": "0",
      "bk_updated_at": "2025-05-27T06:52:15.757Z",
      "bk_updated_by": "",
      "create_time": "2025-05-27T06:52:15.757Z",
      "description": "",
      "face_stop_cmd": "",
      "last_time": "2025-05-27T06:52:15.757Z",
      "pid_file": "",
      "priority": null,
      "proc_num": null,
      "reload_cmd": "",
      "restart_cmd": "",
      "service_instance_id": 1,
      "start_cmd": "",
      "stop_cmd": "",
      "timeout": null,
      "user": "",
      "work_path": ""
    },
    "relation": {
      "bk_biz_id": 4,
      "bk_process_id": 1,
      "service_instance_id": 1,
      "process_template_id": 0,
      "bk_host_id": 1,
      "bk_supplier_account": "0"
    }
  }
];
// 业务拓扑->服务实例->进程->进程别名表格
export const processInfo = [
  {
    "bk_process_name": "devTest",
    "process_ids": [
      1
    ]
  }
];
// 业务拓扑->服务实例->进程->进程别名表格->所属实例
export const processInstanceDetail = [
  {
    "process_id": 1,
    "service_instance_name": "192.168.0.2_devTest",
    "property": {
      "auto_start": false,
      "bind_info": [],
      "bk_biz_id": 4,
      "bk_created_at": "2025-05-27T06:52:15.757Z",
      "bk_created_by": "bk-cmdb",
      "bk_func_name": "devTest",
      "bk_process_id": 1,
      "bk_process_name": "devTest",
      "bk_start_check_secs": null,
      "bk_start_param_regex": "",
      "bk_supplier_account": "0",
      "bk_updated_at": "2025-05-27T06:52:15.757Z",
      "bk_updated_by": "",
      "create_time": "2025-05-27T06:52:15.757Z",
      "description": "",
      "face_stop_cmd": "",
      "last_time": "2025-05-27T06:52:15.757Z",
      "pid_file": "",
      "priority": null,
      "proc_num": null,
      "reload_cmd": "",
      "restart_cmd": "",
      "service_instance_id": 1,
      "start_cmd": "",
      "stop_cmd": "",
      "timeout": null,
      "user": "",
      "work_path": ""
    },
    "relation": {
      "bk_biz_id": 4,
      "bk_process_id": 1,
      "service_instance_id": 1,
      "process_template_id": 0,
      "bk_host_id": 1,
      "bk_supplier_account": "0"
    }
  }
];
// 业务拓扑：业务节点信息
export const bizNodeInfo = [
  {
    "bk_biz_developer": "",
    "bk_biz_id": 4,
    "bk_biz_maintainer": "bk-cmdb",
    "bk_biz_name": "business",
    "bk_biz_productor": "",
    "bk_biz_tester": "",
    "bk_created_at": "2025-07-25T01:43:49.8Z",
    "bk_created_by": "bk-cmdb",
    "bk_supplier_account": "0",
    "bk_updated_at": "2025-07-25T01:43:49.8Z",
    "bk_updated_by": "",
    "create_time": "2025-07-25T01:43:49.8Z",
    "default": 0,
    "language": "1",
    "last_time": "2025-07-25T01:43:49.8Z",
    "life_cycle": "2",
    "operator": "",
    "time_zone": "Asia/Shanghai"
  }
];
// 业务拓扑：集群节点信息
export const setNodeInfo = [
  {
    "bk_biz_id": 4,
    "bk_capacity": null,
    "bk_created_at": "2025-07-25T01:57:33.464Z",
    "bk_created_by": "bk-cmdb",
    "bk_parent_id": 4,
    "bk_service_status": "1",
    "bk_set_desc": "",
    "bk_set_env": "3",
    "bk_set_id": 5,
    "bk_set_name": "set2",
    "bk_supplier_account": "0",
    "bk_updated_at": "2025-07-25T01:57:33.464Z",
    "bk_updated_by": null,
    "create_time": "2025-07-25T01:57:33.464Z",
    "default": 0,
    "description": "",
    "last_time": "2025-07-25T01:57:33.464Z",
    "set_template_id": 0,
    "set_template_version": null
  }
];
// 业务拓扑：节点信息
export const moduleNodeInfo = [
  {
    "bk_bak_operator": null,
    "bk_biz_id": 4,
    "bk_created_at": "2025-05-18T13:02:33.698Z",
    "bk_created_by": "bk-cmdb",
    "bk_module_id": 15,
    "bk_module_name": "game",
    "bk_module_type": "1",
    "bk_parent_id": 6,
    "bk_set_id": 6,
    "bk_supplier_account": "0",
    "bk_updated_at": "2025-05-18T13:02:33.698Z",
    "bk_updated_by": null,
    "create_time": "2025-05-18T13:02:33.698Z",
    "default": 0,
    "host_apply_enabled": false,
    "last_time": "2025-05-18T13:02:33.698Z",
    "operator": null,
    "service_category_id": 2,
    "service_template_id": 0,
    "set_template_id": 0
  }
];
export const instLabels = {
  "dba": [
    "test"
  ],
  "dev": [
    "test"
  ]
};
// 业务拓扑->主机列表->转移至（主机池）
export const resourceDir = {
  "count": 1,
  "info": [
    {
      "bk_module_id": 1,
      "bk_module_name": "空闲机",
      "default": 1,
      "host_count": 1
    }
  ]
};
// 从serviceCategoryMock中提取serviceCategory数据
export const serviceCategory = serviceCategoryMock.map(item => item.category);
// 添加主机到模块preview时的“转移到”的拓扑结构
export const transferTarget = {
  "nodes": [
    {
      "bk_biz_id": 3,
      "topo_node": {
        "bk_obj_id": "module",
        "bk_inst_id": 14
      },
      "topo_path": [
        {
          "bk_obj_id": "module",
          "bk_inst_id": 14,
          "bk_inst_name": "待回收"
        },
        {
          "bk_obj_id": "set",
          "bk_inst_id": 5,
          "bk_inst_name": "空闲机池"
        },
        {
          "bk_obj_id": "biz",
          "bk_inst_id": 3,
          "bk_inst_name": "business2"
        }
      ]
    },
    {
      "bk_biz_id": 3,
      "topo_node": {
        "bk_obj_id": "module",
        "bk_inst_id": 15
      },
      "topo_path": [
        {
          "bk_obj_id": "module",
          "bk_inst_id": 15,
          "bk_inst_name": "game"
        },
        {
          "bk_obj_id": "set",
          "bk_inst_id": 4,
          "bk_inst_name": "set2"
        },
        {
          "bk_obj_id": "biz",
          "bk_inst_id": 3,
          "bk_inst_name": "business2"
        }
      ]
    },
    {
      "bk_biz_id": 3,
      "topo_node": {
        "bk_obj_id": "module",
        "bk_inst_id": 16
      },
      "topo_path": [
        {
          "bk_obj_id": "module",
          "bk_inst_id": 16,
          "bk_inst_name": "game2"
        },
        {
          "bk_obj_id": "set",
          "bk_inst_id": 4,
          "bk_inst_name": "set2"
        },
        {
          "bk_obj_id": "biz",
          "bk_inst_id": 3,
          "bk_inst_name": "business2"
        }
      ]
    },
    {
      "bk_biz_id": 3,
      "topo_node": {
        "bk_obj_id": "module",
        "bk_inst_id": 12
      },
      "topo_path": [
        {
          "bk_obj_id": "module",
          "bk_inst_id": 12,
          "bk_inst_name": "空闲机"
        },
        {
          "bk_obj_id": "set",
          "bk_inst_id": 5,
          "bk_inst_name": "空闲机池"
        },
        {
          "bk_obj_id": "biz",
          "bk_inst_id": 3,
          "bk_inst_name": "business2"
        }
      ]
    }
  ]
};
// 转移主机到空闲机池要删除的服务实例
export const transferWithClearServiceInstance = [
  {
    "bk_host_id": 2,
    "final_modules": [
      15, 16
    ],
    "to_remove_from_modules": [
      {
        "bk_module_id": 15,
        "service_instances": [
          {
            "bk_biz_id": 3,
            "id": 1,
            "name": "10.0.0.4_process2",
            "labels": null,
            "service_template_id": 0,
            "bk_host_id": 2,
            "bk_module_id": 15,
            "creator": "bk-cmdb",
            "modifier": "bk-cmdb",
            "create_time": "2025-06-19T08:08:45.772Z",
            "last_time": "2025-06-19T08:08:45.772Z",
            "bk_supplier_account": "0"
          }
        ]
      }
    ],
    "to_add_to_modules": [],
    "host_apply_plan": {
      "error_code": 0,
      "error_message": "",
      "bk_host_id": 0,
      "cloud_area": {
        "bk_cloud_id": 0,
        "bk_cloud_name": ""
      },
      "bk_module_ids": null,
      "expect_host": null,
      "update_fields": null,
      "conflicts": null,
      "unresolved_conflict_count": 0
    }
  },
  {
    "bk_host_id": 3,
    "final_modules": [
      15, 16
    ],
    "to_remove_from_modules": [
      {
        "bk_module_id": 7,
        "service_instances": []
      }
    ],
    "to_add_to_modules": [],
    "host_apply_plan": {
      "error_code": 0,
      "error_message": "",
      "bk_host_id": 0,
      "cloud_area": {
        "bk_cloud_id": 0,
        "bk_cloud_name": ""
      },
      "bk_module_ids": null,
      "expect_host": null,
      "update_fields": null,
      "conflicts": null,
      "unresolved_conflict_count": 0
    }
  }
];
// 添加主机->添加进程->监听信息->ip
export const listenIPOptions = {
  "options": [
    "127.0.0.1",
    "0.0.0.0",
    "10.0.0.4",
    "::1",
    "::"
  ]
};
