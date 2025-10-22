// Mock data for Analysis module

export const mockAuditData = {
  host: [
    {
      id: '1',
      operationObject: '主机',
      action: '删除',
      targetBusiness: '10.0.0.2',
      target: '10.0.0.2',
      operationTime: '2025-10-21 01:13:03',
      operator: 'bk-cmdb',
    },
    {
      id: '2',
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
      id: '3',
      operationObject: '业务拓扑',
      action: '修改',
      targetBusiness: '示例业务1',
      target: '应用模块A',
      operationTime: '2025-10-21 02:15:30',
      operator: 'admin',
    },
    {
      id: '4',
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
      id: '5',
      operationObject: '资源目录',
      action: '新增',
      targetBusiness: '公共资源',
      target: '开发环境目录',
      operationTime: '2025-10-21 03:20:15',
      operator: 'admin',
    },
    {
      id: '6',
      operationObject: '项目',
      action: '修改',
      targetBusiness: '项目管理',
      target: 'CMDB项目',
      operationTime: '2025-10-21 02:30:45',
      operator: 'project_manager',
    },
  ],
};
