export const businessListMock = Array.from({ length: 20 }).map((_, i) => ({
  id: i + 1,
  name: i === 0 ? "蓝鲸" : `business${i}`,
  operator: i === 0 ? "admin" : "bk-cmdb",
  createTime: `2025-05-15 18:${(10 + i).toString().padStart(2, "0")}:00`,
  creator: i === 0 ? "--" : "bk-cmdb"
}));

// 主机
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
    bk_module_name: "DBA",
    default: 4,
    host_count: 0,
    children: []
  },
  {
    bk_module_id: 11,
    bk_module_name: "Developer",
    default: 4,
    host_count: 0,
    children: []
  }
];

// 业务列表
export const bizListMock = [
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

// 主机列表 mock
export const idleHostMock = [
  {
    "biz": [
      {
        "bk_biz_developer": "",
        "bk_biz_id": 1,
        "bk_biz_maintainer": "admin",
        "bk_biz_name": "资源池",
        "bk_biz_productor": "admin",
        "bk_biz_tester": "",
        "bk_created_at": "2025-05-18T12:49:14.053Z",
        "bk_supplier_account": "0",
        "bk_updated_at": "2025-05-18T12:49:14.053Z",
        "create_time": "2025-05-18T12:49:14.053Z",
        "default": 1,
        "language": "1",
        "last_time": "2025-05-18T12:49:14.053Z",
        "life_cycle": "2",
        "operator": "",
        "time_zone": "Asia/Shanghai"
      }
    ],
    "host": {
      "bk_cloud_host_status": null,
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
      "bk_host_innerip": "10.0.0.2",
      "bk_host_innerip_v6": ""
    },
    "module": [
      {
        "bk_bak_operator": "",
        "bk_biz_id": 1,
        "bk_created_at": "2025-05-18T12:49:14.056Z",
        "bk_module_id": 1,
        "bk_module_name": "空闲机",
        "bk_module_type": "1",
        "bk_parent_id": 1,
        "bk_set_id": 1,
        "bk_supplier_account": "0",
        "bk_updated_at": "2025-05-18T12:49:14.056Z",
        "create_time": "2025-05-18T12:49:14.056Z",
        "default": 1,
        "host_apply_enabled": false,
        "last_time": "2025-05-18T12:49:14.056Z",
        "operator": "",
        "service_category_id": 2,
        "service_template_id": 0,
        "set_template_id": 0,
        "topo_module_name": "资源池##空闲机池##空闲机"
      }
    ],
    "set": [
      {
        "bk_biz_id": 1,
        "bk_capacity": null,
        "bk_created_at": "2025-05-18T12:49:14.054Z",
        "bk_parent_id": 1,
        "bk_service_status": "1",
        "bk_set_desc": "",
        "bk_set_env": "3",
        "bk_set_id": 1,
        "bk_set_name": "空闲机池",
        "bk_supplier_account": "0",
        "bk_updated_at": "2025-05-18T12:49:14.054Z",
        "create_time": "2025-05-18T12:49:14.054Z",
        "default": 1,
        "description": "",
        "last_time": "2025-05-18T12:49:14.054Z",
        "set_template_id": 0,
        "topo_module_name": "资源池##空闲机池"
      }
    ]
  },
  {
    "biz": [
      {
        "bk_biz_developer": "",
        "bk_biz_id": 1,
        "bk_biz_maintainer": "admin",
        "bk_biz_name": "资源池",
        "bk_biz_productor": "admin",
        "bk_biz_tester": "",
        "bk_created_at": "2025-05-18T12:49:14.053Z",
        "bk_supplier_account": "0",
        "bk_updated_at": "2025-05-18T12:49:14.053Z",
        "create_time": "2025-05-18T12:49:14.053Z",
        "default": 1,
        "language": "1",
        "last_time": "2025-05-18T12:49:14.053Z",
        "life_cycle": "2",
        "operator": "",
        "time_zone": "Asia/Shanghai"
      }
    ],
    "host": {
      "bk_cloud_host_status": null,
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
      "bk_host_innerip": "10.0.0.3",
      "bk_host_innerip_v6": ""
    },
    "module": [
      {
        "bk_bak_operator": "",
        "bk_biz_id": 1,
        "bk_created_at": "2025-05-18T12:49:14.056Z",
        "bk_module_id": 1,
        "bk_module_name": "空闲机",
        "bk_module_type": "1",
        "bk_parent_id": 1,
        "bk_set_id": 1,
        "bk_supplier_account": "0",
        "bk_updated_at": "2025-05-18T12:49:14.056Z",
        "create_time": "2025-05-18T12:49:14.056Z",
        "default": 1,
        "host_apply_enabled": false,
        "last_time": "2025-05-18T12:49:14.056Z",
        "operator": "",
        "service_category_id": 2,
        "service_template_id": 0,
        "set_template_id": 0,
        "topo_module_name": "资源池##空闲机池##空闲机"
      }
    ],
    "set": [
      {
        "bk_biz_id": 1,
        "bk_capacity": null,
        "bk_created_at": "2025-05-18T12:49:14.054Z",
        "bk_parent_id": 1,
        "bk_service_status": "1",
        "bk_set_desc": "",
        "bk_set_env": "3",
        "bk_set_id": 1,
        "bk_set_name": "空闲机池",
        "bk_supplier_account": "0",
        "bk_updated_at": "2025-05-18T12:49:14.054Z",
        "create_time": "2025-05-18T12:49:14.054Z",
        "default": 1,
        "description": "",
        "last_time": "2025-05-18T12:49:14.054Z",
        "set_template_id": 0,
        "topo_module_name": "资源池##空闲机池"
      }
    ]
  }
]
// DBA
export const dbaHostMock = [
  {
      "biz": [
          {
              "bk_biz_developer": "",
              "bk_biz_id": 1,
              "bk_biz_maintainer": "admin",
              "bk_biz_name": "资源池",
              "bk_biz_productor": "admin",
              "bk_biz_tester": "",
              "bk_created_at": "2025-05-18T12:49:14.053Z",
              "bk_supplier_account": "0",
              "bk_updated_at": "2025-05-18T12:49:14.053Z",
              "create_time": "2025-05-18T12:49:14.053Z",
              "default": 1,
              "language": "1",
              "last_time": "2025-05-18T12:49:14.053Z",
              "life_cycle": "2",
              "operator": "",
              "time_zone": "Asia/Shanghai"
          }
      ],
      "host": {
          "bk_cloud_host_status": null,
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
          "bk_host_id": 4,
          "bk_host_innerip": "10.0.0.4",
          "bk_host_innerip_v6": ""
      },
      "module": [
          {
              "bk_bak_operator": "",
              "bk_biz_id": 1,
              "bk_created_at": "2025-05-22T06:43:29.311Z",
              "bk_created_by": "bk-cmdb",
              "bk_module_id": 27,
              "bk_module_name": "DBA",
              "bk_module_type": "1",
              "bk_parent_id": 1,
              "bk_set_id": 1,
              "bk_supplier_account": "0",
              "bk_updated_at": "2025-05-22T06:43:29.311Z",
              "bk_updated_by": null,
              "create_time": "2025-05-22T06:43:29.311Z",
              "default": 4,
              "host_apply_enabled": false,
              "last_time": "2025-05-22T06:43:29.311Z",
              "operator": "",
              "service_category_id": 0,
              "service_template_id": 0,
              "set_template_id": 0,
              "topo_module_name": "资源池##空闲机池##DBA"
          }
      ],
      "set": [
          {
              "bk_biz_id": 1,
              "bk_capacity": null,
              "bk_created_at": "2025-05-18T12:49:14.054Z",
              "bk_parent_id": 1,
              "bk_service_status": "1",
              "bk_set_desc": "",
              "bk_set_env": "3",
              "bk_set_id": 1,
              "bk_set_name": "空闲机池",
              "bk_supplier_account": "0",
              "bk_updated_at": "2025-05-18T12:49:14.054Z",
              "create_time": "2025-05-18T12:49:14.054Z",
              "default": 1,
              "description": "",
              "last_time": "2025-05-18T12:49:14.054Z",
              "set_template_id": 0,
              "topo_module_name": "资源池##空闲机池"
          }
      ]
  }
]
// Developer
export const devHostMock = [
  {
      "biz": [
          {
              "bk_biz_developer": "",
              "bk_biz_id": 1,
              "bk_biz_maintainer": "admin",
              "bk_biz_name": "资源池",
              "bk_biz_productor": "admin",
              "bk_biz_tester": "",
              "bk_created_at": "2025-05-18T12:49:14.053Z",
              "bk_supplier_account": "0",
              "bk_updated_at": "2025-05-18T12:49:14.053Z",
              "create_time": "2025-05-18T12:49:14.053Z",
              "default": 1,
              "language": "1",
              "last_time": "2025-05-18T12:49:14.053Z",
              "life_cycle": "2",
              "operator": "",
              "time_zone": "Asia/Shanghai"
          }
      ],
      "host": {
          "bk_cloud_host_status": null,
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
          "bk_host_id": 5,
          "bk_host_innerip": "10.0.0.5",
          "bk_host_innerip_v6": ""
      },
      "module": [
          {
              "bk_bak_operator": "",
              "bk_biz_id": 1,
              "bk_created_at": "2025-05-22T06:45:17.372Z",
              "bk_created_by": "bk-cmdb",
              "bk_module_id": 28,
              "bk_module_name": "Developer",
              "bk_module_type": "1",
              "bk_parent_id": 1,
              "bk_set_id": 1,
              "bk_supplier_account": "0",
              "bk_updated_at": "2025-05-22T06:45:17.372Z",
              "bk_updated_by": null,
              "create_time": "2025-05-22T06:45:17.372Z",
              "default": 4,
              "host_apply_enabled": false,
              "last_time": "2025-05-22T06:45:17.372Z",
              "operator": "",
              "service_category_id": 0,
              "service_template_id": 0,
              "set_template_id": 0,
              "topo_module_name": "资源池##空闲机池##Developer"
          }
      ],
      "set": [
          {
              "bk_biz_id": 1,
              "bk_capacity": null,
              "bk_created_at": "2025-05-18T12:49:14.054Z",
              "bk_parent_id": 1,
              "bk_service_status": "1",
              "bk_set_desc": "",
              "bk_set_env": "3",
              "bk_set_id": 1,
              "bk_set_name": "空闲机池",
              "bk_supplier_account": "0",
              "bk_updated_at": "2025-05-18T12:49:14.054Z",
              "create_time": "2025-05-18T12:49:14.054Z",
              "default": 1,
              "description": "",
              "last_time": "2025-05-18T12:49:14.054Z",
              "set_template_id": 0,
              "topo_module_name": "资源池##空闲机池"
          }
      ]
  }
]
