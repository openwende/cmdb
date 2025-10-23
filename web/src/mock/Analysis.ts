// Mock data for Analysis module

export const mockAuditData = {
  host: [
    {
      id: 1,
      operationObject: '主机',
      action: '删除',
      targetBusiness: '10.0.0.2',
      target: '10.0.0.2',
      operationTime: '2025-10-21 01:13:03',
      operator: 'bk-cmdb',
    },
    {
      id: 2,
      operationObject: '主机',
      action: '新增',
      targetBusiness: '10.0.0.8',
      target: '10.0.0.8',
      operationTime: '2025-10-21 01:12:44',
      operator: 'bk-cmdb',
    },
  ],
  business: [
    {
      id: 3,
      operationObject: '业务拓扑',
      action: '修改',
      targetBusiness: '示例业务1',
      target: '应用模块A',
      operationTime: '2025-10-21 02:15:30',
      operator: 'admin',
    },
    {
      id: 4,
      operationObject: '服务模板',
      action: '新增',
      targetBusiness: '示例业务2',
      target: 'Web服务模板',
      operationTime: '2025-10-21 01:45:20',
      operator: 'user1',
    },
  ],
  resource: [
    {
      id: 5,
      operationObject: '资源目录',
      action: '新增',
      targetBusiness: '公共资源',
      target: '开发环境目录',
      operationTime: '2025-10-21 03:20:15',
      operator: 'admin',
    },
    {
      id: 6,
      operationObject: '项目',
      action: '修改',
      targetBusiness: '项目管理',
      target: 'CMDB项目',
      operationTime: '2025-10-21 02:30:45',
      operator: 'project_manager',
    },
  ],
};

// Mock data for audit operation details
export const mockOperationDetails = [
  {
    "id": 2,
    "audit_type": "host",
    "bk_supplier_account": "0",
    "user": "bk-cmdb",
    "resource_type": "host",
    "action": "create",
    "operate_from": "user",
    "operation_detail": {
      "details": {
        "pre_data": null,
        "cur_data": {
          "bk_cloud_id": 90000001,
          "bk_host_id": 1,
          "bk_host_innerip": "10.0.0.8"
        },
        "update_fields": null
      },
      "bk_obj_id": "host"
    },
    "operation_time": "2025-10-23 01:05:20",
    "bk_biz_id": 1,
    "resource_id": 1,
    "resource_name": "10.0.0.8",
    "rid": "cc0000d3snuk1al4qs2b4n23o0",
    "extend_resource_name": ""
  },
  {
    "id": 1,
    "audit_type": "host",
    "bk_supplier_account": "0",
    "user": "bk-cmdb",
    "resource_type": "host",
    "action": "update",
    "operate_from": "user",
    "operation_detail": {
      "details": {
        "pre_data": {
          "bk_host_innerip": "10.0.0.2"
        },
        "cur_data": {
          "bk_host_innerip": "10.0.0.8"
        },
        "update_fields": ["bk_host_innerip"]
      },
      "bk_obj_id": "host"
    },
    "operation_time": "2025-10-21 01:13:03",
    "bk_biz_id": 1,
    "resource_id": 1,
    "resource_name": "10.0.0.8",
    "rid": "cc0000d3snuk1al4qs2b4n23o1",
    "extend_resource_name": ""
  },
  {
    "id": 3,
    "audit_type": "host",
    "bk_supplier_account": "0",
    "user": "admin",
    "resource_type": "host",
    "action": "delete",
    "operate_from": "user",
    "operation_detail": {
      "details": {
        "pre_data": {
          "bk_cloud_id": 0,
          "bk_host_id": 3,
          "bk_host_innerip": "192.168.1.100"
        },
        "cur_data": null,
        "update_fields": null
      },
      "bk_obj_id": "host"
    },
    "operation_time": "2025-10-21 02:15:30",
    "bk_biz_id": 1,
    "resource_id": 3,
    "resource_name": "192.168.1.100",
    "rid": "cc0000d3snuk1al4qs2b4n23o2",
    "extend_resource_name": ""
  }
]
