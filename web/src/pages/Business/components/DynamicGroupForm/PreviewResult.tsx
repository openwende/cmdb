import React from 'react';
import { Button, Table, Empty } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

interface PreviewData {
  id: string;
  internalIPv4: string;
  region: string;
  cloudVendor: string;
  cloudVendorID: string;
  cloudBusiness: string;
  createTime: string;
  creator: string;
}

interface PreviewResultProps {
  data: PreviewData[];
  loading: boolean;
  lastUpdateTime: string;
  onRefresh?: () => void;
}

const PreviewResult: React.FC<PreviewResultProps> = ({
  data,
  loading,
  lastUpdateTime,
  onRefresh
}) => {
  const columns: ColumnsType<PreviewData> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      sorter: true,
      width: 100,
      fixed: 'left'
    },
    {
      title: '内网IPv4',
      dataIndex: 'internalIPv4',
      key: 'internalIPv4',
      sorter: true,
      width: 200
    },
    {
      title: '管控区域',
      dataIndex: 'region',
      key: 'region',
      width: 200
    },
    {
      title: '云主机状态',
      dataIndex: 'cloudVendor',
      key: 'cloudVendor',
      sorter: true,
      width: 200
    },
    {
      title: '云主机实例ID',
      dataIndex: 'cloudVendorID',
      key: 'cloudVendorID',
      sorter: true,
      width: 200
    },
    {
      title: '云厂商',
      dataIndex: 'cloudBusiness',
      key: 'cloudBusiness',
      sorter: true,
      width: 200
    },
    {
      title: '创建时间',
      dataIndex: 'createTime',
      key: 'createTime',
      sorter: true,
      width: 200
    },
    {
      title: '创建人',
      dataIndex: 'creator',
      key: 'creator',
      sorter: true,
      width: 200
    },
  ];

  if (!data.length && !lastUpdateTime && !loading) {
    return (
      <div className="preview-result">
        <div className="preview-header">
          <div className="section-title">结果预览</div>
        </div>
        <Empty
          description="请先在左侧设置分组条件"
          className="preview-empty"
        />
      </div>
    );
  }

  return (
    <div className="preview-result">
      <div className="preview-header">
        <div className="section-title">
          结果预览
          {lastUpdateTime && (
            <span className="update-time">
              （生成时间：{lastUpdateTime}）
            </span>
          )}
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={onRefresh}
          loading={loading}
          color="primary"
          variant="outlined"
          size="small"
        >
          刷新
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        scroll={{ x: 'max-content' }}
        pagination={false}
        showSorterTooltip={false}
        size="small"
      />
    </div>
  );
};

export default PreviewResult;
