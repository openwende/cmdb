import React from 'react';
import { Tag } from 'antd';

interface StatusTagProps {
  /** Status value */
  status: string;
  /** Map of status values to display labels and colors */
  statusMap?: Record<string, { label: string; color: string }>;
}

const defaultStatusMap: Record<string, { label: string; color: string }> = {
  online: { label: '已上线', color: 'green' },
  testing: { label: '测试中', color: 'blue' },
  offline: { label: '已下线', color: 'default' },
  running: { label: '运行中', color: 'green' },
  stopped: { label: '已停止', color: 'default' },
  terminated: { label: '已终止', color: 'red' },
  abnormal: { label: '异常', color: 'red' },
};

const StatusTag: React.FC<StatusTagProps> = ({ status, statusMap }) => {
  const map = statusMap || defaultStatusMap;
  const config = map[status];

  if (!config) {
    return <Tag>{status}</Tag>;
  }

  return <Tag color={config.color}>{config.label}</Tag>;
};

export default StatusTag;
